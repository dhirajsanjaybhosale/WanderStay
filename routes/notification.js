const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync');
const { isLoggedIn } = require('../middleware');
const notificationsController = require('../controllers/notifications');

router.use(isLoggedIn);

router.get('/', wrapAsync(notificationsController.index));
router.get('/api/unread', wrapAsync(notificationsController.getUnreadData));
router.post('/read-all', wrapAsync(notificationsController.markAllAsRead));
router.post('/:id/read', wrapAsync(notificationsController.markAsRead));
router.get('/:id/open', wrapAsync(notificationsController.markAsRead)); // Direct link click fallback
router.delete('/:id', wrapAsync(notificationsController.deleteNotification));
router.post('/:id/delete', wrapAsync(notificationsController.deleteNotification)); // Form fallback

module.exports = router;
