const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync');
const { isLoggedIn } = require('../middleware');
const bookingsController = require('../controllers/bookings');

router.get('/history', isLoggedIn, wrapAsync(bookingsController.bookingHistory));
router.get('/:bookingId/checkout', isLoggedIn, wrapAsync(bookingsController.renderCheckout));
router.post('/:bookingId/coupon/apply', isLoggedIn, wrapAsync(bookingsController.applyCoupon));
router.post('/:bookingId/coupon/remove', isLoggedIn, wrapAsync(bookingsController.removeCoupon));
router.post('/:bookingId/verify-payment', isLoggedIn, wrapAsync(bookingsController.verifyPayment));
router.post('/:bookingId/payment-failed', isLoggedIn, wrapAsync(bookingsController.paymentFailed));
router.get('/:bookingId/cancellation-preview', isLoggedIn, wrapAsync(bookingsController.cancellationPreview));
router.post('/:bookingId/cancel', isLoggedIn, wrapAsync(bookingsController.cancelBooking));
router.get('/:bookingId/confirmation', isLoggedIn, wrapAsync(bookingsController.bookingConfirmation));
router.get('/:bookingId/invoice', isLoggedIn, wrapAsync(bookingsController.downloadInvoice));
router.get('/:bookingId', isLoggedIn, wrapAsync(bookingsController.bookingDetails));

module.exports = router;
