const Booking = require('../models/booking');
const Listing = require('../models/listing');

module.exports.createBooking = async (req, res) => {
  const { id } = req.params;
  const { checkIn, checkOut } = req.body.booking;
  const listing = await Listing.findById(id);

  if (!listing || !listing.isAvailable) {
    req.flash('error', 'Listing is not available for booking right now.');
    return res.redirect(`/listings/${id}`);
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  if (checkOutDate <= checkInDate) {
    req.flash('error', 'Check-out must be after check-in.');
    return res.redirect(`/listings/${id}`);
  }

  const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
  const totalPrice = nights * listing.price;

  const booking = new Booking({
    listing: listing._id,
    guest: req.user._id,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    nights,
    totalPrice,
  });

  await booking.save();
  req.flash('success', 'Booking confirmed!');
  res.redirect(`/bookings/${booking._id}/confirmation`);
};

module.exports.bookingConfirmation = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId).populate('listing');
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
  booking.status = 'cancelled';
  await booking.save();
  req.flash('success', 'Booking cancelled successfully.');
  res.redirect('/bookings/history');
};
