const Booking = require('../models/booking');
const Listing = require('../models/listing');
const Coupon = require('../models/coupon');
const { createRazorpayOrder, verifyPaymentSignature, processRazorpayRefund } = require('../razorpayConfig');
const { generateBookingInvoice } = require('../utils/invoiceGenerator');
const {
  sendBookingConfirmationEmail,
  sendPaymentConfirmationEmail,
  sendHostBookingNotificationEmail,
  sendBookingCancellationEmail
} = require('../utils/emailService');
const { createNotification } = require('../utils/notificationHelper');
const { syncHostSuperhostStatus } = require('../utils/superhostHelper');
const { calculateRefund, getCancellationPolicy, CANCELLATION_POLICIES } = require('../utils/cancellationHelper');
const { calculateListingPricing } = require('../utils/pricingHelper');

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

  const numGuests = Math.max(1, parseInt(guests, 10) || 1);

  // Securely calculate pricing via dynamic pricing engine
  const pricingResult = calculateListingPricing({
    listing,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    guests: numGuests
  });

  const nights = pricingResult.nights;
  const totalPrice = pricingResult.totalPrice;

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
    originalPrice: totalPrice,
    priceBreakdown: pricingResult,
    discountAmount: 0,
    totalPrice,
    cancellationPolicy: listing.cancellationPolicy || 'Flexible',
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

  const { getCurrencyForCountry } = require('../utils/countries');
  const { SUPPORTED_CURRENCIES, getPriceDisplay, formatCurrency, convertFromINR } = require('../utils/currency');
  if (booking.listing && booking.listing.country) {
    const destCurrency = getCurrencyForCountry(booking.listing.country);
    if (destCurrency && SUPPORTED_CURRENCIES[destCurrency]) {
      res.locals.currentCurrency = destCurrency;
      res.locals.currentCurrencyConfig = SUPPORTED_CURRENCIES[destCurrency];
      res.locals.getPriceDisplay = (amt, custom) => getPriceDisplay(amt, custom || destCurrency);
      res.locals.formatCurrency = (amt, custom) => formatCurrency(amt, custom || destCurrency);
      res.locals.convertCurrency = (amt, custom) => convertFromINR(amt, custom || destCurrency);
    }
  }

  res.render('bookings/checkout.ejs', {
    booking,
    listing: booking.listing,
    razorpayKeyId
  });
};

// Apply Promo Coupon securely at checkout
module.exports.applyCoupon = async (req, res) => {
  const { bookingId } = req.params;
  const { code } = req.body;

  if (!code || typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ success: false, message: 'Please provide a valid coupon code.' });
  }

  const cleanCode = code.trim().toUpperCase();
  const booking = await Booking.findById(bookingId).populate('listing');

  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking reservation not found.' });
  }

  if (!booking.guest.equals(req.user._id)) {
    return res.status(403).json({ success: false, message: 'Unauthorized access to reservation.' });
  }

  if (booking.status !== 'pending' || booking.paymentStatus === 'paid') {
    return res.status(400).json({ success: false, message: 'Coupons cannot be applied to this reservation status.' });
  }

  const coupon = await Coupon.findOne({ code: cleanCode });
  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Coupon code not found. Please verify the code.' });
  }

  const baseAmount = booking.originalPrice || booking.totalPrice;

  // Validate eligibility securely on server
  const eligibility = coupon.validateEligibility({
    userId: req.user._id,
    bookingAmount: baseAmount,
  });

  if (!eligibility.valid) {
    return res.status(400).json({ success: false, message: eligibility.message });
  }

  // Calculate discount securely on the server
  const discount = coupon.calculateDiscount(baseAmount);
  const finalTotal = Math.max(0, baseAmount - discount);

  // Update or generate Razorpay order with the discounted total amount
  let newOrderId = booking.razorpayOrderId;
  try {
    const { order } = await createRazorpayOrder({
      amount: finalTotal,
      currency: 'INR',
      receipt: `rcpt_${booking._id.toString().slice(-8)}`,
      notes: {
        bookingId: booking._id.toString(),
        couponCode: coupon.code,
        discount: discount.toString(),
      },
    });
    newOrderId = order.id;
  } catch (rzpErr) {
    console.error('Razorpay order update with coupon notice:', rzpErr.message);
  }

  booking.originalPrice = baseAmount;
  booking.discountAmount = discount;
  booking.totalPrice = finalTotal;
  booking.razorpayOrderId = newOrderId;
  booking.coupon = {
    code: coupon.code,
    couponId: coupon._id,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
  };

  await booking.save();

  return res.json({
    success: true,
    message: `Coupon "${coupon.code}" applied! You saved ₹${discount.toLocaleString('en-IN')}.`,
    originalPrice: baseAmount,
    discountAmount: discount,
    totalPrice: finalTotal,
    coupon: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      description: coupon.description,
    },
    razorpayOrderId: newOrderId,
  });
};

// Remove applied coupon and restore original price
module.exports.removeCoupon = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking reservation not found.' });
  }

  if (!booking.guest.equals(req.user._id)) {
    return res.status(403).json({ success: false, message: 'Unauthorized access to reservation.' });
  }

  if (booking.status !== 'pending' || booking.paymentStatus === 'paid') {
    return res.status(400).json({ success: false, message: 'Cannot modify this reservation.' });
  }

  const originalAmount = booking.originalPrice || booking.totalPrice;

  // Restore Razorpay order with full original amount
  let newOrderId = booking.razorpayOrderId;
  try {
    const { order } = await createRazorpayOrder({
      amount: originalAmount,
      currency: 'INR',
      receipt: `rcpt_${booking._id.toString().slice(-8)}`,
    });
    newOrderId = order.id;
  } catch (rzpErr) {
    console.error('Razorpay order restore notice:', rzpErr.message);
  }

  booking.totalPrice = originalAmount;
  booking.discountAmount = 0;
  booking.coupon = { code: '', couponId: null, discountType: '', discountValue: 0 };
  booking.razorpayOrderId = newOrderId;

  await booking.save();

  return res.json({
    success: true,
    message: 'Coupon removed successfully.',
    originalPrice: originalAmount,
    discountAmount: 0,
    totalPrice: originalAmount,
    razorpayOrderId: newOrderId,
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

  // If a coupon was applied, record usage history and increment usedCount
  if (booking.coupon && booking.coupon.couponId) {
    try {
      await Coupon.findByIdAndUpdate(booking.coupon.couponId, {
        $inc: { usedCount: 1 },
        $push: {
          usageHistory: {
            user: booking.guest,
            booking: booking._id,
            discountAmount: booking.discountAmount || 0,
            usedAt: new Date(),
          },
        },
      });
    } catch (couponLogErr) {
      console.error('Coupon usage update notice:', couponLogErr.message);
    }
  }

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

        // Recalculate Superhost status for Host
        if (populated.listing && populated.listing.owner) {
          syncHostSuperhostStatus(populated.listing.owner._id || populated.listing.owner)
            .catch(err => console.error('Superhost sync error:', err.message));
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

// Real-time cancellation preview for frontend modals
module.exports.cancellationPreview = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId).populate('listing');

  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking reservation not found.' });
  }

  const isGuest = booking.guest.equals(req.user._id);
  const isAdmin = req.user.role === 'admin';
  if (!isGuest && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Unauthorized access to reservation.' });
  }

  const refundCalc = calculateRefund({
    booking,
    listing: booking.listing,
    cancellationTime: new Date()
  });

  return res.json({
    success: true,
    bookingId: booking._id,
    listingTitle: booking.listing ? booking.listing.title : 'WanderStay Property',
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    totalPaid: refundCalc.totalPaid,
    isPaid: refundCalc.isPaid,
    policyName: refundCalc.policyName,
    policy: refundCalc.policy,
    hoursUntilCheckIn: refundCalc.hoursUntilCheckIn,
    daysUntilCheckIn: refundCalc.daysUntilCheckIn,
    refundPercentage: refundCalc.refundPercentage,
    refundAmount: refundCalc.refundAmount,
    nonRefundableAmount: refundCalc.nonRefundableAmount,
    explanation: refundCalc.explanation
  });
};

module.exports.cancelBooking = async (req, res) => {
  const { bookingId } = req.params;
  const { reason } = req.body;
  const booking = await Booking.findById(bookingId).populate('listing');

  if (!booking) {
    req.flash('error', 'Booking record not found.');
    return res.redirect('/bookings/history');
  }

  // 1. Check booking ownership
  const isGuest = booking.guest.equals(req.user._id);
  const isAdmin = req.user.role === 'admin';
  if (!isGuest && !isAdmin) {
    req.flash('error', 'You do not have permission to cancel this booking.');
    return res.redirect('/bookings/history');
  }

  // 2. Check booking status
  if (booking.status === 'cancelled' || booking.status === 'refunded' || booking.status === 'refund_pending') {
    req.flash('error', 'This reservation is already cancelled.');
    return res.redirect('/bookings/history');
  }

  if (booking.status === 'completed') {
    req.flash('error', 'Completed stays cannot be cancelled.');
    return res.redirect('/bookings/history');
  }

  // 3. Check cancellation rules
  const refundCalc = calculateRefund({
    booking,
    listing: booking.listing,
    cancellationTime: new Date()
  });

  // 4. Calculate refund if payment exists
  const wasPaid = booking.paymentStatus === 'paid';
  const refundAmount = wasPaid ? refundCalc.refundAmount : 0;
  const refundPercentage = wasPaid ? refundCalc.refundPercentage : 0;
  const cancellationReason = (reason && reason.trim()) ? reason.trim() : (isAdmin ? 'Cancelled by administration' : 'Guest requested cancellation');

  // 5. Update booking status
  booking.status = (wasPaid && refundAmount > 0) ? 'refund_pending' : 'cancelled';
  booking.cancellation = {
    cancelledAt: new Date(),
    cancelledBy: req.user._id,
    reason: cancellationReason,
    policyApplied: refundCalc.policyName,
    refundPercentage,
    refundAmount,
    refundStatus: (wasPaid && refundAmount > 0) ? 'pending' : 'none',
    refundId: '',
    explanation: refundCalc.explanation
  };

  let refundGatewaySucceeded = false;
  let gatewayErrorMsg = null;

  // 6. Process refund through existing payment provider if supported
  if (wasPaid && refundAmount > 0) {
    // Initial status is refund_pending while awaiting gateway confirmation
    booking.paymentStatus = 'refund_pending';
    booking.status = 'refund_pending';
    booking.cancellation.refundStatus = 'pending';

    if (booking.razorpayPaymentId) {
      try {
        const refundResult = await processRazorpayRefund({
          paymentId: booking.razorpayPaymentId,
          amount: refundAmount,
          notes: {
            bookingId: booking._id.toString(),
            policy: refundCalc.policyName,
            refundPercentage: `${refundPercentage}%`,
            reason: cancellationReason
          }
        });

        // Do not claim a refund succeeded until payment provider confirmation is received.
        if (refundResult && refundResult.refund && (refundResult.refund.status === 'processed' || refundResult.refund.id)) {
          refundGatewaySucceeded = true;
          booking.status = 'refunded';
          booking.paymentStatus = 'refunded';
          booking.cancellation.refundStatus = 'processed';
          booking.cancellation.refundId = refundResult.refund.id;
          booking.cancellation.explanation = `${refundCalc.explanation} (Payment provider confirmed refund ID: ${refundResult.refund.id})`;
        }
      } catch (gatewayErr) {
        gatewayErrorMsg = gatewayErr.message;
        console.error('Payment provider refund processing notice:', gatewayErr.message);
        // Do not claim a refund succeeded until payment provider confirmation is received.
        booking.status = 'refund_pending';
        booking.paymentStatus = 'refund_pending';
        booking.cancellation.refundStatus = 'pending';
        booking.cancellation.explanation = `${refundCalc.explanation} (Pending gateway confirmation: ${gatewayErr.message})`;
      }
    }
  }

  // 7. Update availability (booking.status is 'cancelled', freeing calendar dates)
  await booking.save();

  // 8. Notify guest and host
  Booking.findById(booking._id)
    .populate({ path: 'listing', populate: { path: 'owner' } })
    .populate('guest')
    .then(populated => {
      if (populated) {
        // Send email to Guest
        sendBookingCancellationEmail({
          booking: populated,
          listing: populated.listing,
          recipientUser: populated.guest,
          isHost: false,
          refundAmount,
          refundPercentage,
          policyName: refundCalc.policyName,
          explanation: refundCalc.explanation
        }).catch(err => console.error('Guest cancellation email error:', err.message));

        // Send email to Host
        if (populated.listing && populated.listing.owner) {
          sendBookingCancellationEmail({
            booking: populated,
            listing: populated.listing,
            recipientUser: populated.listing.owner,
            isHost: true,
            refundAmount: 0,
            refundPercentage: 0,
            policyName: refundCalc.policyName,
            explanation: `${populated.guest ? (populated.guest.fullName || populated.guest.username) : 'Guest'} cancelled reservation.`
          }).catch(err => console.error('Host cancellation email error:', err.message));
        }

        // In-App Notification for Guest
        let guestMsg = `Reservation #${populated._id.toString().slice(-6).toUpperCase()} at "${populated.listing ? populated.listing.title : 'WanderStay Property'}" was cancelled.`;
        if (wasPaid && refundAmount > 0) {
          if (refundGatewaySucceeded) {
            guestMsg += ` A ${refundPercentage}% refund of ₹${refundAmount.toLocaleString('en-IN')} has been processed to your original payment method.`;
          } else {
            guestMsg += ` A ${refundPercentage}% refund of ₹${refundAmount.toLocaleString('en-IN')} is currently pending gateway processing.`;
          }
        } else if (wasPaid) {
          guestMsg += ` In accordance with the ${refundCalc.policyName} policy, this reservation was non-refundable.`;
        }

        createNotification({
          userId: populated.guest._id,
          type: 'booking_cancelled',
          title: 'Booking Cancelled',
          message: guestMsg,
          link: `/bookings/${populated._id}`
        });

        // In-App Notification for Host
        if (populated.listing && populated.listing.owner) {
          createNotification({
            userId: populated.listing.owner._id,
            type: 'booking_cancelled',
            title: 'Reservation Cancelled',
            message: `${populated.guest ? (populated.guest.fullName || populated.guest.username) : 'A traveler'} cancelled reservation #${populated._id.toString().slice(-6).toUpperCase()} at "${populated.listing.title}". The dates are now available again.`,
            link: '/dashboards/host'
          });

          // Recalculate Superhost metrics for host
          syncHostSuperhostStatus(populated.listing.owner._id || populated.listing.owner)
            .catch(err => console.error('Superhost sync error:', err.message));
        }
      }
    })
    .catch(err => console.error('Cancellation notification error:', err.message));

  // User feedback message
  if (wasPaid && refundAmount > 0) {
    if (refundGatewaySucceeded) {
      req.flash('success', `Reservation cancelled. A ${refundPercentage}% refund of ₹${refundAmount.toLocaleString('en-IN')} has been processed by the payment provider.`);
    } else {
      req.flash('info', `Reservation cancelled. Your refund of ₹${refundAmount.toLocaleString('en-IN')} (${refundPercentage}%) is pending payment provider confirmation.`);
    }
  } else if (wasPaid) {
    req.flash('warning', `Reservation cancelled. In accordance with the ${refundCalc.policyName} cancellation policy, no refund is eligible for this timeline.`);
  } else {
    req.flash('success', 'Reservation cancelled successfully. The calendar dates are now open again.');
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

  const refundPreview = calculateRefund({
    booking,
    listing: booking.listing,
    cancellationTime: new Date()
  });

  res.render('bookings/show.ejs', {
    booking,
    refundPreview,
    cancellationPolicy: refundPreview.policy
  });
};
