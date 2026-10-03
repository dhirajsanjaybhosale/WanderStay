const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync');
const { isLoggedIn } = require('../middleware');
const bookingsController = require('../controllers/bookings');

router.get('/history', isLoggedIn, wrapAsync(bookingsController.bookingHistory));
router.post('/:bookingId/cancel', isLoggedIn, wrapAsync(bookingsController.cancelBooking));
router.get('/:bookingId/confirmation', isLoggedIn, wrapAsync(bookingsController.bookingConfirmation));

module.exports = router;
