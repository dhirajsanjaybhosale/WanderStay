const Booking = require('../models/booking');
const Listing = require('../models/listing');
const { createRazorpayOrder, verifyPaymentSignature } = require('../razorpayConfig');
const { generateBookingInvoice } = require('../utils/invoiceGenerator');
const {
  sendBookingConfirmationEmail,
  sendPaymentConfirmationEmail,
  sendHostBookingNotificationEmail,
  sendBookingCancellationEmail
} = require('../utils/emailService');
const { createNotification } = require('../utils/notificationHelper');

module.exports.createBooking = async (req, res) => {
  const { id } = req.params;
  const { checkIn, checkOut, guests } = req.body.booking || {};
  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash('error', 'Listing not found.');
    return res.redirect('/listings');
  }

  if (!listing.isAvailable) {
    req.flash('error', 'Listing is not available for booking right now.');
    return res.redirect(`/listings/${id}`);
  }

  if (listing.owner && listing.owner.equals(req.user._id)) {
    req.flash('error', 'You cannot book your own property.');
    return res.redirect(`/listings/${id}`);
  }

  if (!checkIn || !checkOut) {
    req.flash('error', 'Please provide both check-in and check-out dates.');
    return res.redirect(`/listings/${id}`);
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    req.flash('error', 'Invalid date format provided.');
    return res.redirect(`/listings/${id}`);
  }

  // Normalize dates to midnight to prevent timezone boundary issues
  checkInDate.setHours(0, 0, 0, 0);
  checkOutDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (checkInDate < today) {
    req.flash('error', 'Check-in date cannot be in the past.');
    return res.redirect(`/listings/${id}`);
  }

  if (checkOutDate <= checkInDate) {
    req.flash('error', 'Check-out date must be at least 1 night after check-in.');
    return res.redirect(`/listings/${id}`);
  }

  // Backend double-booking prevention: check for overlapping confirmed bookings
  const conflictingBooking = await Booking.findOne({
    listing: listing._id,
    status: 'confirmed',
    checkIn: { $lt: checkOutDate },
    checkOut: { $gt: checkInDate }
  });

  if (conflictingBooking) {
    req.flash('error', 'Selected dates are already booked by another traveler. Please choose different dates.');
    return res.redirect(`/listings/${id}`);
  }

  // Backend host blocked dates check: check if any blocked ranges overlap
  const isBlocked = (listing.blockedDates || []).some(block => {
    const bStart = new Date(block.startDate);
    const bEnd = new Date(block.endDate);
    bStart.setHours(0, 0, 0, 0);
    bEnd.setHours(0, 0, 0, 0);
    return checkInDate < bEnd && checkOutDate > bStart;
  });

  if (isBlocked) {
    req.flash('error', 'Selected dates include dates blocked by the host. Please choose different dates.');
    return res.redirect(`/listings/${id}`);
  }

  const nights = Math.round((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
  const numGuests = Math.max(1, parseInt(guests, 10) || 1);
  const cleaningFee = 500;
  const serviceFee = 750;
  const totalPrice = (nights * listing.price) + cleaningFee + serviceFee;

  // Create Razorpay Order server-side
  const { order } = await createRazorpayOrder({
    amount: totalPrice,
    currency: 'INR',
    receipt: `rcpt_${Date.now().toString().slice(-8)}`,
    notes: {
      listingId: listing._id.toString(),
      guestId: req.user._id.toString()
    }
  });

  const booking = new Booking({
    listing: listing._id,
    guest: req.user._id,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    nights,
    guests: numGuests,
    totalPrice,
    status: 'pending',
    paymentStatus: 'pending',
    razorpayOrderId: order.id
  });

  await booking.save();
  res.redirect(`/bookings/${booking._id}/checkout`);
};

module.exports.renderCheckout = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId).populate('listing').populate('guest');

  if (!booking) {
    req.flash('error', 'Booking reservation not found.');
    return res.redirect('/listings');
  }

  if (!booking.guest._id.equals(req.user._id)) {
    req.flash('error', 'You are not authorized to view this checkout.');
    return res.redirect('/bookings/history');
  }

  // If already confirmed & paid, take directly to confirmation receipt
  if (booking.paymentStatus === 'paid' && booking.status === 'confirmed') {
    req.flash('info', 'This reservation is already paid and confirmed.');
    return res.redirect(`/bookings/${booking._id}/confirmation`);
  }

  if (booking.status === 'cancelled') {
    req.flash('error', 'This booking has been cancelled and cannot be paid.');
    return res.redirect('/bookings/history');
  }

  // Ensure Razorpay Order ID exists on the booking (recreate if missing)
  if (!booking.razorpayOrderId) {
    const { order } = await createRazorpayOrder({
      amount: booking.totalPrice,
      currency: 'INR',
      receipt: `rcpt_${booking._id.toString().slice(-8)}`
    });
    booking.razorpayOrderId = order.id;
    await booking.save();
  }

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_wanderstay_mock';

  res.render('bookings/checkout.ejs', {
    booking,
    listing: booking.listing,
    razorpayKeyId
  });
};

module.exports.verifyPayment = async (req, res) => {
  const { bookingId } = req.params;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const booking = await Booking.findById(bookingId).populate('listing');
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking reservation not found.' });
  }

  if (!booking.guest.equals(req.user._id)) {
    return res.status(403).json({ success: false, message: 'Unauthorized access to reservation.' });
  }

  // Prevent duplicate payment attempt
  if (booking.paymentStatus === 'paid' && booking.status === 'confirmed') {
    return res.json({
      success: true,
      message: 'Payment already completed for this reservation.',
      redirectUrl: `/bookings/${booking._id}/confirmation`
    });
  }

  if (booking.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      message: 'This booking was cancelled and cannot be paid.'
    });
  }

  // Verify Razorpay signature server-side
  const isValidSignature = verifyPaymentSignature({
    razorpay_order_id: razorpay_order_id || booking.razorpayOrderId,
    razorpay_payment_id,
    razorpay_signature
  });

  if (!isValidSignature) {
    booking.paymentStatus = 'failed';
    await booking.save();
    return res.status(400).json({
      success: false,
      message: 'Payment signature verification failed. Your payment could not be authenticated.'
    });
  }

  // Double-booking check right before confirming
  const conflict = await Booking.findOne({
    _id: { $ne: booking._id },
    listing: booking.listing._id,
    status: 'confirmed',
    checkIn: { $lt: booking.checkOut },
    checkOut: { $gt: booking.checkIn }
  });

  if (conflict) {
    booking.status = 'cancelled';
    booking.paymentStatus = 'refunded';
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpaySignature = razorpay_signature;
    await booking.save();
    return res.status(409).json({
      success: false,
      message: 'These dates were confirmed by another traveler. A full refund has been initiated.',
      redirectUrl: `/listings/${booking.listing._id}`
    });
  }

  // Successfully paid and verified!
  booking.status = 'confirmed';
  booking.paymentStatus = 'paid';
  booking.razorpayOrderId = razorpay_order_id || booking.razorpayOrderId;
  booking.razorpayPaymentId = razorpay_payment_id;
  booking.razorpaySignature = razorpay_signature;
  booking.paidAt = new Date();
  await booking.save();

  // Asynchronously dispatch notifications (Safe, never blocks or crashes payment)
  Booking.findById(booking._id)
    .populate({ path: 'listing', populate: { path: 'owner' } })
    .populate('guest')
    .then(populated => {
      if (populated) {
        sendBookingConfirmationEmail({
          booking: populated,
          listing: populated.listing,
          guest: populated.guest,
          host: populated.listing ? populated.listing.owner : null
        }).catch(err => console.error('Booking confirmation email error:', err.message));

        sendPaymentConfirmationEmail({
          booking: populated,
          listing: populated.listing,
          guest: populated.guest
        }).catch(err => console.error('Payment confirmation email error:', err.message));

        if (populated.listing && populated.listing.owner) {
          sendHostBookingNotificationEmail({
            booking: populated,
            listing: populated.listing,
            host: populated.listing.owner,
            guest: populated.guest
          }).catch(err => console.error('Host booking alert email error:', err.message));
        }

        // --- In-App Notifications ---
        // 1. Booking confirmed (for guest)
        createNotification({
          userId: populated.guest._id,
          type: 'booking_confirmed',
          title: 'Booking Confirmed!',
          message: `Your reservation at "${populated.listing ? populated.listing.title : 'WanderStay Property'}" is confirmed for ${populated.nights} night(s).`,
          link: `/bookings/${populated._id}/confirmation`
        });

        // 2. Payment successful (for guest)
        createNotification({
          userId: populated.guest._id,
          type: 'payment_success',
          title: 'Payment Successful',
          message: `Payment of ₹${populated.totalPrice ? populated.totalPrice.toLocaleString('en-IN') : 0} was processed successfully for booking #${populated._id.toString().slice(-6).toUpperCase()}.`,
          link: `/bookings/${populated._id}/invoice`
        });

        // 3. New booking received (for host)
        if (populated.listing && populated.listing.owner) {
          createNotification({
            userId: populated.listing.owner._id,
            type: 'new_booking',
            title: 'New Booking Received!',
            message: `${populated.guest.username || 'A traveler'} booked "${populated.listing.title}" for ${populated.nights} night(s).`,
            link: '/dashboards/host'
          });
        }
      }
    })
    .catch(err => console.error('Notification dispatch error:', err.message));

  req.flash('success', 'Payment verified successfully! Your WanderStay reservation is confirmed.');
  return res.json({
    success: true,
    redirectUrl: `/bookings/${booking._id}/confirmation`
  });
};

module.exports.paymentFailed = async (req, res) => {
  const { bookingId } = req.params;
  const { errorDescription } = req.body;
  const booking = await Booking.findById(bookingId);
  if (booking && booking.guest.equals(req.user._id) && booking.paymentStatus !== 'paid') {
    booking.paymentStatus = 'failed';
    await booking.save();
  }
  res.json({ success: true, message: 'Payment failure recorded.' });
};

module.exports.bookingConfirmation = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId)
    .populate({
      path: 'listing',
      populate: { path: 'owner' }
    })
    .populate('guest');
  if (!booking) {
    req.flash('error', 'Booking not found');
    return res.redirect('/listings');
  }
  res.render('bookings/confirm.ejs', { booking });
};

module.exports.bookingHistory = async (req, res) => {
  const bookings = await Booking.find({ guest: req.user._id })
    .populate('listing')
    .sort({ createdAt: -1 });
  res.render('bookings/history.ejs', { bookings });
};

module.exports.cancelBooking = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    req.flash('error', 'Booking not found');
    return res.redirect('/bookings/history');
  }
  if (!booking.guest.equals(req.user._id)) {
    req.flash('error', 'You do not have permission to cancel this booking.');
    return res.redirect('/bookings/history');
  }
  if (booking.status === 'cancelled') {
    req.flash('error', 'Booking is already cancelled.');
    return res.redirect('/bookings/history');
  }

  const wasPaid = booking.paymentStatus === 'paid';
  booking.status = 'cancelled';
  if (wasPaid) {
    booking.paymentStatus = 'refunded';
  }
  await booking.save();

  // Asynchronously dispatch cancellation emails
  Booking.findById(booking._id)
    .populate({ path: 'listing', populate: { path: 'owner' } })
    .populate('guest')
    .then(populated => {
      if (populated) {
        // Send cancellation notice to Guest
        sendBookingCancellationEmail({
          booking: populated,
          listing: populated.listing,
          recipientUser: populated.guest,
          isHost: false,
          refundAmount: wasPaid ? populated.totalPrice : 0
        }).catch(err => console.error('Guest cancellation email error:', err.message));

        // Send cancellation notice to Host
        if (populated.listing && populated.listing.owner) {
          sendBookingCancellationEmail({
            booking: populated,
            listing: populated.listing,
            recipientUser: populated.listing.owner,
            isHost: true,
            refundAmount: 0
          }).catch(err => console.error('Host cancellation email error:', err.message));
        }

        // --- In-App Notifications ---
        // 1. Cancellation notice for Guest
        createNotification({
          userId: populated.guest._id,
          type: 'booking_cancelled',
          title: 'Booking Cancelled',
          message: `Your reservation #${populated._id.toString().slice(-6).toUpperCase()} at "${populated.listing ? populated.listing.title : 'WanderStay Property'}" has been cancelled.`,
          link: '/bookings/history'
        });

        // 2. Cancellation notice for Host
        if (populated.listing && populated.listing.owner) {
          createNotification({
            userId: populated.listing.owner._id,
            type: 'booking_cancelled',
            title: 'Reservation Cancelled',
            message: `${populated.guest.username || 'A guest'} cancelled reservation #${populated._id.toString().slice(-6).toUpperCase()} at "${populated.listing.title}".`,
            link: '/dashboards/host'
          });
        }
      }
    })
    .catch(err => console.error('Cancellation notification error:', err.message));

  if (wasPaid) {
    req.flash('success', 'Booking cancelled successfully. A full refund has been initiated according to cancellation rules. The dates are now available again.');
  } else {
    req.flash('success', 'Booking cancelled successfully. The dates are now available again.');
  }
  res.redirect('/bookings/history');
};

module.exports.downloadInvoice = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId)
    .populate({
      path: 'listing',
      populate: { path: 'owner' }
    })
    .populate('guest');

  if (!booking) {
    req.flash('error', 'Booking record not found.');
    return res.redirect('/bookings/history');
  }

  // Authorization check: Guest, Host, or Admin
  const isGuest = booking.guest && booking.guest._id.equals(req.user._id);
  const isHost = booking.listing && booking.listing.owner && booking.listing.owner.equals(req.user._id);
  const isAdmin = req.user.role === 'admin';

  if (!isGuest && !isHost && !isAdmin) {
    req.flash('error', 'You are not authorized to view or download this invoice.');
    return res.redirect('/bookings/history');
  }

  const filename = `WanderStay-Invoice-${booking._id.toString().slice(-8).toUpperCase()}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  await generateBookingInvoice(booking, res);
};

module.exports.bookingDetails = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId)
    .populate({
      path: 'listing',
      populate: { path: 'owner' }
    })
    .populate('guest');

  if (!booking) {
    req.flash('error', 'Booking record not found.');
    return res.redirect('/bookings/history');
  }

  const isGuest = booking.guest && booking.guest._id.equals(req.user._id);
  const isHost = booking.listing && booking.listing.owner && booking.listing.owner.equals(req.user._id);
  const isAdmin = req.user.role === 'admin';

  if (!isGuest && !isHost && !isAdmin) {
    req.flash('error', 'You are not authorized to view this booking.');
    return res.redirect('/bookings/history');
  }

  res.render('bookings/show.ejs', { booking });
};
