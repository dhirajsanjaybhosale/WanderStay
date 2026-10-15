/**
 * WanderStay Host Analytics Helper
 * Computes 100% genuine data-driven analytics from the MongoDB database:
 * - Total, Upcoming, Completed, and Cancelled Bookings
 * - Net Realized Revenue
 * - Rating and Review Aggregations
 * - Property Views Tracking
 * - True Occupancy Rate
 * - Time-series buckets for Bookings, Revenue, and Rating Trends
 */

const Listing = require('../models/listing');
const Booking = require('../models/booking');
const Review = require('../models/review');

const RANGE_CONFIGS = {
  '7d': { days: 7, label: 'Last 7 Days', bucketType: 'day' },
  '30d': { days: 30, label: 'Last 30 Days', bucketType: 'day' },
  '3m': { days: 90, label: 'Last 3 Months', bucketType: 'week' },
  '1y': { days: 365, label: 'Last 1 Year', bucketType: 'month' }
};

/**
 * Format date nicely for chart labels
 */
function formatDateLabel(date, bucketType) {
  const d = new Date(date);
  if (bucketType === 'month') {
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  if (bucketType === 'week') {
    return `Wk of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Generate time buckets for the selected range
 */
function generateBuckets(startDate, endDate, bucketType) {
  const buckets = [];
  const curr = new Date(startDate);

  if (bucketType === 'day') {
    curr.setHours(0, 0, 0, 0);
    while (curr <= endDate) {
      const bStart = new Date(curr);
      const bEnd = new Date(curr);
      bEnd.setHours(23, 59, 59, 999);
      buckets.push({
        start: bStart,
        end: bEnd,
        label: formatDateLabel(bStart, 'day'),
        bookings: 0,
        revenue: 0,
        ratings: []
      });
      curr.setDate(curr.getDate() + 1);
    }
  } else if (bucketType === 'week') {
    curr.setHours(0, 0, 0, 0);
    while (curr <= endDate) {
      const bStart = new Date(curr);
      const bEnd = new Date(curr);
      bEnd.setDate(bEnd.getDate() + 7);
      bEnd.setHours(23, 59, 59, 999);
      buckets.push({
        start: bStart,
        end: bEnd > endDate ? new Date(endDate) : bEnd,
        label: formatDateLabel(bStart, 'week'),
        bookings: 0,
        revenue: 0,
        ratings: []
      });
      curr.setDate(curr.getDate() + 7);
    }
  } else if (bucketType === 'month') {
    curr.setDate(1);
    curr.setHours(0, 0, 0, 0);
    while (curr <= endDate) {
      const bStart = new Date(curr);
      const bEnd = new Date(curr.getFullYear(), curr.getMonth() + 1, 0, 23, 59, 59, 999);
      buckets.push({
        start: bStart,
        end: bEnd > endDate ? new Date(endDate) : bEnd,
        label: formatDateLabel(bStart, 'month'),
        bookings: 0,
        revenue: 0,
        ratings: []
      });
      curr.setMonth(curr.getMonth() + 1);
    }
  }

  return buckets;
}

/**
 * Calculates real host performance and time-series charts data
 * @param {ObjectId|string} hostId
 * @param {string} rangeKey - '7d', '30d', '3m', '1y'
 * @returns {Promise<Object>}
 */
async function calculateHostAnalytics(hostId, rangeKey = '30d') {
  const config = RANGE_CONFIGS[rangeKey] || RANGE_CONFIGS['30d'];
  const now = new Date();
  const startDate = new Date(now.getTime() - config.days * 24 * 60 * 60 * 1000);
  startDate.setHours(0, 0, 0, 0);

  // 1. Fetch all listings owned by host
  const listings = await Listing.find({ owner: hostId })
    .populate({
      path: 'reviews',
      populate: { path: 'author', select: 'username firstName lastName avatar' }
    })
    .sort({ createdAt: -1 });

  const totalListings = listings.length;
  const listingIds = listings.map(l => l._id);

  // Handle host with no properties
  if (totalListings === 0) {
    const emptyBuckets = generateBuckets(startDate, now, config.bucketType);
    return {
      rangeKey,
      rangeLabel: config.label,
      totalListings: 0,
      totalBookings: 0,
      rangeBookings: 0,
      upcomingBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      totalRevenue: 0,
      rangeRevenue: 0,
      averageRating: 0,
      totalReviews: 0,
      totalViews: 0,
      occupancyRate: 0,
      hasOccupancyData: false,
      hasViewTracking: true,
      labels: emptyBuckets.map(b => b.label),
      bookingsSeries: emptyBuckets.map(() => 0),
      revenueSeries: emptyBuckets.map(() => 0),
      ratingSeries: emptyBuckets.map(() => null),
      propertyBreakdown: []
    };
  }

  // 2. Fetch all reservations across host's listings
  const bookings = await Booking.find({ listing: { $in: listingIds } })
    .populate('listing', 'title price location views')
    .populate('guest', 'username fullName email')
    .sort({ createdAt: 1 });

  // 3. Extract and aggregate all reviews
  const allReviews = [];
  listings.forEach(l => {
    if (Array.isArray(l.reviews)) {
      l.reviews.forEach(r => {
        if (r && typeof r.rating === 'number') {
          allReviews.push(r);
        }
      });
    }
  });
  allReviews.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  // 4. Calculate Core Metrics
  const totalBookingsAllTime = bookings.length;
  let rangeBookings = 0;
  let upcomingBookings = 0;
  let completedBookings = 0;
  let cancelledBookings = 0;
  let totalRevenueAllTime = 0;
  let rangeRevenue = 0;

  bookings.forEach(b => {
    const bCreated = new Date(b.createdAt || 0);
    const bIn = new Date(b.checkIn);
    const bOut = new Date(b.checkOut);
    const isCancelled = ['cancelled', 'refunded', 'refund_pending'].includes(b.status);

    if (isCancelled) {
      cancelledBookings++;
    } else if (b.status === 'completed' || bOut < now) {
      completedBookings++;
    } else if (b.status === 'confirmed' && bIn >= now) {
      upcomingBookings++;
    }

    // Revenue calculation (only non-cancelled or partial retained)
    const grossPrice = Number(b.totalPrice) || 0;
    const refundGiven = (b.cancellation && b.cancellation.refundAmount) ? Number(b.cancellation.refundAmount) : (b.paymentStatus === 'refunded' ? grossPrice : 0);
    const netEarnings = Math.max(0, grossPrice - refundGiven);

    // Only count revenue for confirmed / completed or paid bookings
    if (b.paymentStatus === 'paid' || b.status === 'confirmed' || b.status === 'completed' || (isCancelled && netEarnings > 0)) {
      totalRevenueAllTime += netEarnings;
      if (bCreated >= startDate && bCreated <= now) {
        rangeRevenue += netEarnings;
      }
    }

    if (bCreated >= startDate && bCreated <= now) {
      rangeBookings++;
    }
  });

  // 5. Total Views across properties
  const totalViews = listings.reduce((sum, l) => sum + (l.views || 0), 0);

  // 6. Average Rating across all properties
  const totalReviews = allReviews.length;
  const averageRating = totalReviews > 0
    ? Number((allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
    : 0;

  // 7. True Occupancy Calculation for Selected Period
  // Formula: (Total Booked Room-Nights in Period) / (Total Listings * Days in Period) * 100
  const totalAvailableNights = totalListings * config.days;
  let bookedNightsInPeriod = 0;

  bookings.forEach(b => {
    // Only confirmed or completed bookings occupy calendar dates
    if (b.status === 'confirmed' || b.status === 'completed') {
      const bIn = new Date(b.checkIn).getTime();
      const bOut = new Date(b.checkOut).getTime();
      const overlapStart = Math.max(bIn, startDate.getTime());
      const overlapEnd = Math.min(bOut, now.getTime());

      if (overlapEnd > overlapStart) {
        const overlapDays = (overlapEnd - overlapStart) / (1000 * 60 * 60 * 24);
        bookedNightsInPeriod += overlapDays;
      }
    }
  });

  const rawOccupancy = totalAvailableNights > 0 ? (bookedNightsInPeriod / totalAvailableNights) * 100 : 0;
  const occupancyRate = Math.min(100, Math.max(0, Math.round(rawOccupancy * 10) / 10)); // 1 decimal place

  // 8. Generate Time-Series Buckets for Charts
  const buckets = generateBuckets(startDate, now, config.bucketType);

  // Populate Bookings and Revenue into buckets
  bookings.forEach(b => {
    const bCreated = new Date(b.createdAt || 0);
    if (bCreated >= startDate && bCreated <= now) {
      const bucket = buckets.find(bk => bCreated >= bk.start && bCreated <= bk.end);
      if (bucket) {
        bucket.bookings += 1;
        const grossPrice = Number(b.totalPrice) || 0;
        const refundGiven = (b.cancellation && b.cancellation.refundAmount) ? Number(b.cancellation.refundAmount) : 0;
        const netEarnings = Math.max(0, grossPrice - refundGiven);
        if (b.paymentStatus === 'paid' || b.status === 'confirmed' || b.status === 'completed') {
          bucket.revenue += netEarnings;
        }
      }
    }
  });

  // Populate Rating Trend (Cumulative Rating trajectory up to each bucket)
  buckets.forEach(bk => {
    const reviewsUpToNow = allReviews.filter(r => new Date(r.createdAt || 0) <= bk.end);
    if (reviewsUpToNow.length > 0) {
      const avg = reviewsUpToNow.reduce((sum, r) => sum + r.rating, 0) / reviewsUpToNow.length;
      bk.cumulativeRating = Number(avg.toFixed(2));
    } else {
      bk.cumulativeRating = averageRating > 0 ? averageRating : null;
    }
  });

  // Extract arrays for Chart.js
  const labels = buckets.map(b => b.label);
  const bookingsSeries = buckets.map(b => b.bookings);
  const revenueSeries = buckets.map(b => b.revenue);
  const ratingSeries = buckets.map(b => b.cumulativeRating);

  // Property Performance Breakdown table
  const propertyBreakdown = listings.map(l => {
    const pBookings = bookings.filter(b => b.listing && b.listing._id && b.listing._id.equals(l._id));
    const pRevenue = pBookings.reduce((sum, b) => {
      if (b.status === 'confirmed' || b.status === 'completed' || b.paymentStatus === 'paid') {
        const refund = (b.cancellation && b.cancellation.refundAmount) ? b.cancellation.refundAmount : 0;
        return sum + Math.max(0, (b.totalPrice || 0) - refund);
      }
      return sum;
    }, 0);

    return {
      id: l._id,
      title: l.title,
      location: l.location,
      price: l.price,
      views: l.views || 0,
      rating: l.averageRating || 0,
      reviewCount: (l.reviews && l.reviews.length) || 0,
      totalBookings: pBookings.length,
      revenue: pRevenue
    };
  });

  return {
    rangeKey,
    rangeLabel: config.label,
    totalListings,
    totalBookings: totalBookingsAllTime,
    rangeBookings,
    upcomingBookings,
    completedBookings,
    cancelledBookings,
    totalRevenue: totalRevenueAllTime,
    rangeRevenue,
    averageRating,
    totalReviews,
    totalViews,
    occupancyRate,
    hasOccupancyData: totalListings > 0,
    hasViewTracking: true,
    labels,
    bookingsSeries,
    revenueSeries,
    ratingSeries,
    propertyBreakdown
  };
}

module.exports = {
  RANGE_CONFIGS,
  calculateHostAnalytics
};
