const User = require('../models/user');
const Listing = require('../models/listing');
const Booking = require('../models/booking');
const Review = require('../models/review');
const Conversation = require('../models/conversation');
const { createNotification } = require('./notificationHelper');

// Transparent, Data-Driven Superhost Thresholds
const SUPERHOST_CRITERIA = {
  MIN_COMPLETED_BOOKINGS: 2, // At least 2 completed/confirmed reservations
  MIN_AVERAGE_RATING: 4.7,    // At least 4.7 average review score
  MAX_CANCELLATION_RATE: 10,  // Cancellation rate <= 10%
  MIN_RESPONSE_RATE: 80       // Response rate to guest inquiries >= 80%
};

/**
 * Calculates live Superhost metrics for a given host from actual database records
 */
async function calculateHostSuperhostMetrics(hostId) {
  if (!hostId) return null;

  // 1. Fetch all listings owned by host
  const listings = await Listing.find({ owner: hostId }).select('_id averageRating reviews');
  const listingIds = listings.map(l => l._id);

  // 2. Fetch all bookings for these listings
  const bookings = await Booking.find({ listing: { $in: listingIds } }).select('status checkOut');

  const totalBookings = bookings.length;
  const completedOrConfirmed = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
  const completedCount = completedOrConfirmed.length;
  const cancelledCount = bookings.filter(b => b.status === 'cancelled').length;

  const cancellationRate = totalBookings > 0
    ? Number(((cancelledCount / totalBookings) * 100).toFixed(1))
    : 0;

  // 3. Fetch all reviews for these listings
  const allReviewIds = [];
  listings.forEach(l => {
    if (l.reviews && Array.isArray(l.reviews)) {
      allReviewIds.push(...l.reviews);
    }
  });

  const reviews = await Review.find({ _id: { $in: allReviewIds } }).select('rating');
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0
    ? Number((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews).toFixed(2))
    : 0;

  // 4. Fetch host conversation response rate
  const conversations = await Conversation.find({ participants: hostId });
  let totalInquiries = 0;
  let repliedInquiries = 0;

  conversations.forEach(conv => {
    // Check if conversation has any message from a guest (someone other than this host)
    const guestMessages = (conv.messages || []).filter(m => !m.sender.equals(hostId));
    if (guestMessages.length > 0) {
      totalInquiries++;
      const hostMessages = (conv.messages || []).filter(m => m.sender.equals(hostId));
      if (hostMessages.length > 0) {
        repliedInquiries++;
      }
    }
  });

  // If no guest inquiries exist, default response rate is 100% (not penalized)
  const responseRate = totalInquiries > 0
    ? Math.round((repliedInquiries / totalInquiries) * 100)
    : 100;

  // 5. Evaluate eligibility
  const meetsBookings = completedCount >= SUPERHOST_CRITERIA.MIN_COMPLETED_BOOKINGS;
  const meetsRating = averageRating >= SUPERHOST_CRITERIA.MIN_AVERAGE_RATING;
  const meetsCancellation = cancellationRate <= SUPERHOST_CRITERIA.MAX_CANCELLATION_RATE;
  const meetsResponse = responseRate >= SUPERHOST_CRITERIA.MIN_RESPONSE_RATE;

  const qualifies = meetsBookings && meetsRating && meetsCancellation && meetsResponse;

  // Generate transparent tooltip explanation
  let badgeReason = '';
  if (qualifies) {
    badgeReason = `⭐ Superhost: ${completedCount} completed stays, ${averageRating}★ average rating, ${cancellationRate}% cancellation rate, ${responseRate}% response rate.`;
  } else {
    const missing = [];
    if (!meetsBookings) missing.push(`${completedCount}/${SUPERHOST_CRITERIA.MIN_COMPLETED_BOOKINGS} completed stays`);
    if (!meetsRating) missing.push(`${averageRating || '0.0'}/${SUPERHOST_CRITERIA.MIN_AVERAGE_RATING}★ rating`);
    if (!meetsCancellation) missing.push(`${cancellationRate}% cancellation rate (max ${SUPERHOST_CRITERIA.MAX_CANCELLATION_RATE}%)`);
    if (!meetsResponse) missing.push(`${responseRate}% response rate (min ${SUPERHOST_CRITERIA.MIN_RESPONSE_RATE}%)`);
    badgeReason = `Superhost Progress: ${missing.join(', ')}`;
  }

  return {
    qualifies,
    metrics: {
      completedBookings: completedCount,
      totalBookings,
      cancellationRate,
      averageRating,
      totalReviews,
      responseRate,
      totalInquiries,
      repliedInquiries
    },
    criteria: SUPERHOST_CRITERIA,
    progress: {
      meetsBookings,
      meetsRating,
      meetsCancellation,
      meetsResponse
    },
    badgeReason
  };
}

/**
 * Synchronizes the Superhost status of a single host in MongoDB
 */
async function syncHostSuperhostStatus(hostId) {
  const user = await User.findById(hostId);
  if (!user || user.role !== 'host') return null;

  const evaluation = await calculateHostSuperhostMetrics(hostId);
  if (!evaluation) return null;

  const wasSuperhost = user.superhost && user.superhost.isSuperhost;
  const nowSuperhost = evaluation.qualifies;

  user.superhost = {
    isSuperhost: nowSuperhost,
    badgeReason: evaluation.badgeReason,
    evaluatedAt: new Date(),
    metrics: {
      completedBookings: evaluation.metrics.completedBookings,
      averageRating: evaluation.metrics.averageRating,
      cancellationRate: evaluation.metrics.cancellationRate,
      responseRate: evaluation.metrics.responseRate,
      totalReviews: evaluation.metrics.totalReviews
    }
  };

  await user.save();

  // If status changed to Superhost, celebrate with in-app notification!
  if (!wasSuperhost && nowSuperhost) {
    createNotification({
      userId: user._id,
      type: 'system',
      title: 'Congratulations! You are now a Superhost ⭐',
      message: `Based on your ${evaluation.metrics.completedBookings} completed reservations and outstanding ${evaluation.metrics.averageRating}★ rating, you have earned the official WanderStay Superhost badge.`,
      link: '/dashboard/host'
    });
  } else if (wasSuperhost && !nowSuperhost) {
    createNotification({
      userId: user._id,
      type: 'system',
      title: 'Superhost Status Update',
      message: 'Your Superhost evaluation metrics have shifted below standard thresholds. Check your host dashboard for criteria details.',
      link: '/dashboard/host'
    });
  }

  return {
    user,
    evaluation
  };
}

/**
 * Re-evaluates and synchronizes Superhost status for all hosts across WanderStay
 */
async function syncAllHostsSuperhostStatus() {
  const hosts = await User.find({ role: 'host' }).select('_id');
  const results = [];
  for (const h of hosts) {
    const res = await syncHostSuperhostStatus(h._id);
    if (res) results.push(res);
  }
  return results;
}

module.exports = {
  SUPERHOST_CRITERIA,
  calculateHostSuperhostMetrics,
  syncHostSuperhostStatus,
  syncAllHostsSuperhostStatus
};
