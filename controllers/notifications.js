const Notification = require('../models/notification');
const { getNotificationMeta } = require('../utils/notificationHelper');

/**
 * Render Full Notifications Page
 */
module.exports.index = async (req, res) => {
  const filter = req.query.filter === 'unread' ? { isRead: false } : {};
  const notifications = await Notification.find({
    user: req.user._id,
    ...filter
  }).sort({ createdAt: -1 });

  const unreadCount = await Notification.countDocuments({
    user: req.user._id,
    isRead: false
  });

  res.render('notifications/index.ejs', {
    notifications,
    unreadCount,
    activeFilter: req.query.filter || 'all',
    getNotificationMeta
  });
};

/**
 * Mark a single notification as read & navigate to its link
 */
module.exports.markAsRead = async (req, res) => {
  const { id } = req.params;
  const notification = await Notification.findOne({
    _id: id,
    user: req.user._id
  });

  if (!notification) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    return res.redirect('/notifications');
  }

  notification.isRead = true;
  await notification.save();

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.json({ success: true, link: notification.link });
  }

  // Navigate directly to the relevant page
  res.redirect(notification.link || '/bookings/history');
};

/**
 * Mark all user notifications as read
 */
module.exports.markAllAsRead = async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { $set: { isRead: true } }
  );

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.json({ success: true, message: 'All notifications marked as read' });
  }

  req.flash('success', 'All notifications marked as read.');
  res.redirect(req.get('Referrer') || '/notifications');
};

/**
 * Delete a notification
 */
module.exports.deleteNotification = async (req, res) => {
  const { id } = req.params;
  await Notification.findOneAndDelete({
    _id: id,
    user: req.user._id
  });

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.json({ success: true, message: 'Notification deleted' });
  }

  req.flash('success', 'Notification removed.');
  res.redirect(req.get('Referrer') || '/notifications');
};

/**
 * JSON Endpoint: Returns unread count and latest 6 notifications for real-time navbar update
 */
module.exports.getUnreadData = async (req, res) => {
  const [unreadCount, recent] = await Promise.all([
    Notification.countDocuments({ user: req.user._id, isRead: false }),
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(6)
  ]);

  const recentWithMeta = recent.map(n => ({
    _id: n._id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    isRead: n.isRead,
    createdAt: n.createdAt,
    meta: getNotificationMeta(n.type)
  }));

  res.json({
    unreadCount,
    recent: recentWithMeta
  });
};
