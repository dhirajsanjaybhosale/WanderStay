const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync');
const { isLoggedIn, isAdmin } = require('../middleware');
const adminController = require('../controllers/admin');

// Apply protection: Login + Admin authorization required for all /admin routes
router.use(isLoggedIn, isAdmin);

// Main Admin Dashboard
router.get('/', wrapAsync(adminController.dashboard));

// User Moderation Routes
router.post('/users/:id/suspend', wrapAsync(adminController.toggleUserSuspend));
router.post('/users/:id/role', wrapAsync(adminController.updateUserRole));
router.delete('/users/:id', wrapAsync(adminController.deleteUser));
router.post('/users/:id/delete', wrapAsync(adminController.deleteUser)); // Form fallback

// Listing Moderation Routes
router.delete('/listings/:id', wrapAsync(adminController.deleteListing));
router.post('/listings/:id/delete', wrapAsync(adminController.deleteListing)); // Form fallback

// Review Moderation Routes
router.delete('/reviews/:id', wrapAsync(adminController.deleteReview));
router.post('/reviews/:id/delete', wrapAsync(adminController.deleteReview)); // Form fallback

// Booking Moderation Routes
router.post('/bookings/:id/cancel', wrapAsync(adminController.cancelBooking));

// Quick Host Provisioning
router.post('/hosts', wrapAsync(adminController.createHost));

module.exports = router;
