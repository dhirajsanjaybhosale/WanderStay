const Notification = require('../models/notification');

/**
 * Creates and saves an in-app notification safely
 */
async function createNotification({ userId, type, title, message, link }) {
  try {
    if (!userId) return null;
    const notification = new Notification({
      user: userId,
      type,
      title,
      message,
      link: link || '/bookings/history',
      isRead: false,
      createdAt: new Date()
    });
    await notification.save();
    return notification;
  } catch (err) {
    console.error('❌ [NotificationHelper] Failed to create notification:', err.message);
    return null;
  }
}

/**
 * Returns icon class, badge color, and background class according to notification type
 */
function getNotificationMeta(type) {
  switch (type) {
    case 'booking_confirmed':
      return {
        icon: 'fa-solid fa-calendar-check',
        color: '#10B981',
        bg: '#DCFCE7',
        label: 'Booking Confirmed'
      };
    case 'payment_success':
      return {
        icon: 'fa-solid fa-credit-card',
        color: '#059669',
        bg: '#ECFDF5',
        label: 'Payment Successful'
      };
    case 'new_booking':
      return {
        icon: 'fa-solid fa-house-chimney-user',
        color: '#4F46E5',
        bg: '#EEF2FF',
        label: 'New Reservation'
      };
    case 'new_message':
      return {
        icon: 'fa-regular fa-comment-dots',
        color: '#FF385C',
        bg: '#FFF1F2',
        label: 'New Message'
      };
    case 'booking_cancelled':
      return {
        icon: 'fa-solid fa-ban',
        color: '#DC2626',
        bg: '#FEE2E2',
        label: 'Booking Cancelled'
      };
    case 'review_received':
      return {
        icon: 'fa-solid fa-star',
        color: '#D97706',
        bg: '#FEF3C7',
        label: 'Review Received'
      };
    case 'listing_approved':
      return {
        icon: 'fa-solid fa-circle-check',
        color: '#2563EB',
        bg: '#DBEAFE',
        label: 'Stay Published'
      };
    default:
      return {
        icon: 'fa-solid fa-bell',
        color: '#6B7280',
        bg: '#F3F4F6',
        label: 'Notification'
      };
  }
}

module.exports = {
  createNotification,
  getNotificationMeta
};
