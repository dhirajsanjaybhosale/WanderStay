const User = require('../models/user');
const Listing = require('../models/listing');
const Booking = require('../models/booking');
const Review = require('../models/review');
const Coupon = require('../models/coupon');
const { sendBookingCancellationEmail } = require('../utils/emailService');
const { createNotification } = require('../utils/notificationHelper');

/**
 * Admin Dashboard Main Controller
 * Calculates all statistics live from the database
 */
module.exports.dashboard = async (req, res) => {
  const activeTab = req.query.tab || 'overview';

  // 1. Live Aggregates & Counts (Strictly from real database)
  const [
    totalUsers,
    totalHosts,
    totalGuests,
    totalAdmins,
    totalSuspended,
    totalListings,
    availableListings,
    totalBookings,
    confirmedBookings,
    pendingBookings,
    cancelledBookings,
    completedBookings,
    totalReviews,
    totalSuperhosts
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'host' }),
    User.countDocuments({ role: { $in: ['guest', null] } }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ isSuspended: true }),
    Listing.countDocuments(),
    Listing.countDocuments({ isAvailable: true }),
    Booking.countDocuments(),
    Booking.countDocuments({ status: 'confirmed' }),
    Booking.countDocuments({ status: 'pending' }),
    Booking.countDocuments({ status: 'cancelled' }),
    Booking.countDocuments({ status: 'completed' }),
    Review.countDocuments(),
    User.countDocuments({ role: 'host', 'superhost.isSuperhost': true })
  ]);

  // Live Revenue Calculation (from verified paid bookings)
  const revenueAgg = await Booking.aggregate([
    { $match: { paymentStatus: 'paid' } },
    { $group: { _id: null, total: { $sum: '$totalPrice' } } }
  ]);
  const verifiedRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

  // Total Confirmed Booking Value
  const bookingValueAgg = await Booking.aggregate([
    { $match: { status: { $in: ['confirmed', 'completed'] } } },
    { $group: { _id: null, total: { $sum: '$totalPrice' } } }
  ]);
  const confirmedVolume = bookingValueAgg.length > 0 ? bookingValueAgg[0].total : 0;

  // Platform Average Rating Calculation
  const avgRatingAgg = await Review.aggregate([
    { $group: { _id: null, avgRating: { $avg: '$rating' } } }
  ]);
  const platformAvgRating = avgRatingAgg.length > 0 ? Number(avgRatingAgg[0].avgRating.toFixed(2)) : 0;

  // 2. Fetch Detailed Records for Tabs
  const users = await User.find().sort({ createdAt: -1 });

  const listings = await Listing.find()
    .sort({ createdAt: -1 })
    .populate('owner', 'username email firstName lastName avatar role');

  const bookings = await Booking.find()
    .sort({ createdAt: -1 })
    .populate('listing', 'title image location country price')
    .populate('guest', 'username email firstName lastName');

  const reviews = await Review.find()
    .sort({ createdAt: -1 })
    .populate('author', 'username email firstName lastName avatar');

  // Build mapping from review ID to listing info
  const listingsWithReviews = await Listing.find({ 'reviews.0': { $exists: true } }, 'title reviews').lean();
  const reviewToListingMap = {};
  for (const l of listingsWithReviews) {
    if (l.reviews && Array.isArray(l.reviews)) {
      for (const rId of l.reviews) {
        reviewToListingMap[rId.toString()] = { _id: l._id, title: l.title };
      }
    }
  }

  // Host Verification Requests & Metrics
  const pendingVerifications = await User.countDocuments({
    role: 'host',
    'hostVerification.status': 'pending'
  });
  const verifiedHosts = await User.countDocuments({
    role: 'host',
    'hostVerification.status': 'verified'
  });

  const verificationRequests = await User.find({
    role: 'host',
    'hostVerification.status': { $in: ['pending', 'verified', 'rejected'] }
  })
    .populate('hostVerification.reviewedBy', 'username')
    .sort({ 'hostVerification.submittedAt': -1 });

  // Coupons & Promo Codes Metrics & List
  const coupons = await Coupon.find()
    .populate('createdBy', 'username email')
    .sort({ createdAt: -1 });

  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter(c => c.isActive && (!c.expiryDate || new Date(c.expiryDate) > new Date())).length;
  const totalRedemptions = coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);
  const totalDiscountGiven = coupons.reduce((sum, c) => {
    return sum + (c.usageHistory || []).reduce((hSum, h) => hSum + (h.discountAmount || 0), 0);
  }, 0);

  // Filter stats object
  const stats = {
    totalUsers,
    totalHosts,
    totalGuests,
    totalAdmins,
    totalSuspended,
    totalListings,
    availableListings,
    totalBookings,
    confirmedBookings,
    pendingBookings,
    cancelledBookings,
    completedBookings,
    totalReviews,
    platformAvgRating,
    verifiedRevenue,
    confirmedVolume,
    pendingVerifications,
    verifiedHosts,
    totalSuperhosts,
    totalCoupons,
    activeCoupons,
    totalRedemptions,
    totalDiscountGiven
  };

  res.render('admin/dashboard.ejs', {
    activeTab,
    stats,
    users,
    listings,
    bookings,
    reviews,
    coupons,
    verificationRequests,
    reviewToListingMap,
    currentUser: req.user
  });
};

/**
 * Suspend or Unsuspend User
 */
module.exports.toggleUserSuspend = async (req, res) => {
  const { id } = req.params;

  if (req.user._id.equals(id)) {
    req.flash('error', 'Security rule: You cannot suspend your own administrator account.');
    return res.redirect('/admin?tab=users');
  }

  const user = await User.findById(id);
  if (!user) {
    req.flash('error', 'User not found.');
    return res.redirect('/admin?tab=users');
  }

  user.isSuspended = !user.isSuspended;
  await user.save();

  req.flash(
    'success',
    `User @${user.username} has been ${user.isSuspended ? 'suspended' : 'reactivated'} successfully.`
  );
  res.redirect('/admin?tab=users');
};

/**
 * Update User Role
 */
module.exports.updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['guest', 'host', 'admin'].includes(role)) {
    req.flash('error', 'Invalid role requested.');
    return res.redirect('/admin?tab=users');
  }

  if (req.user._id.equals(id) && role !== 'admin') {
    req.flash('error', 'Security rule: You cannot demote your own administrator account.');
    return res.redirect('/admin?tab=users');
  }

  const user = await User.findByIdAndUpdate(id, { role }, { new: true });
  if (!user) {
    req.flash('error', 'User not found.');
    return res.redirect('/admin?tab=users');
  }

  req.flash('success', `User @${user.username} role updated to "${role}".`);
  res.redirect('/admin?tab=users');
};

/**
 * Permanently Delete User
 */
module.exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  if (req.user._id.equals(id)) {
    req.flash('error', 'Security rule: You cannot delete your own administrator account.');
    return res.redirect('/admin?tab=users');
  }

  const user = await User.findById(id);
  if (!user) {
    req.flash('error', 'User not found.');
    return res.redirect('/admin?tab=users');
  }

  await User.findByIdAndDelete(id);
  req.flash('success', `User account @${user.username} was permanently deleted.`);
  res.redirect('/admin?tab=users');
};

/**
 * Remove Inappropriate Listing
 */
module.exports.deleteListing = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash('error', 'Listing not found.');
    return res.redirect('/admin?tab=listings');
  }

  // Cancel any active bookings for this listing
  await Booking.updateMany(
    { listing: id, status: { $in: ['pending', 'confirmed'] } },
    { status: 'cancelled' }
  );

  // Listing findByIdAndDelete automatically triggers review cleanup hook
  await Listing.findByIdAndDelete(id);

  req.flash('success', `Listing "${listing.title}" has been removed by administrator.`);
  res.redirect('/admin?tab=listings');
};

/**
 * Remove Inappropriate Review
 */
module.exports.deleteReview = async (req, res) => {
  const { id } = req.params;

  const review = await Review.findById(id);
  if (!review) {
    req.flash('error', 'Review not found.');
    return res.redirect('/admin?tab=reviews');
  }

  // Find listing containing this review
  const listing = await Listing.findOne({ reviews: id });
  if (listing) {
    await Listing.findByIdAndUpdate(listing._id, { $pull: { reviews: id } });
    await Review.findByIdAndDelete(id);

    // Recalculate listing averageRating
    const updatedListing = await Listing.findById(listing._id).populate('reviews');
    if (updatedListing) {
      const validRatings = (updatedListing.reviews || [])
        .map(r => (r ? r.rating : null))
        .filter(r => typeof r === 'number' && !isNaN(r));

      updatedListing.averageRating = validRatings.length
        ? Number((validRatings.reduce((sum, val) => sum + val, 0) / validRatings.length).toFixed(1))
        : 0;
      await updatedListing.save();
    }
  } else {
    await Review.findByIdAndDelete(id);
  }

  req.flash('success', 'Inappropriate review has been permanently removed.');
  res.redirect('/admin?tab=reviews');
};

/**
 * Cancel Booking as Admin
 */
module.exports.cancelBooking = async (req, res) => {
  const { id } = req.params;
  const booking = await Booking.findById(id);

  if (!booking) {
    req.flash('error', 'Booking not found.');
    return res.redirect('/admin?tab=bookings');
  }

  booking.status = 'cancelled';
  if (booking.paymentStatus === 'paid') {
    booking.paymentStatus = 'refunded';
  }
  await booking.save();

  // Send cancellation email asynchronously
  Booking.findById(booking._id)
    .populate({ path: 'listing', populate: { path: 'owner' } })
    .populate('guest')
    .then(populated => {
      if (populated) {
        sendBookingCancellationEmail({
          booking: populated,
          listing: populated.listing,
          recipientUser: populated.guest,
          isHost: false,
          refundAmount: populated.paymentStatus === 'refunded' ? populated.totalPrice : 0
        }).catch(err => console.error('Admin cancellation guest email error:', err.message));

        if (populated.listing && populated.listing.owner) {
          sendBookingCancellationEmail({
            booking: populated,
            listing: populated.listing,
            recipientUser: populated.listing.owner,
            isHost: true,
            refundAmount: 0
          }).catch(err => console.error('Admin cancellation host email error:', err.message));
        }

        // --- In-App Notifications ---
        createNotification({
          userId: populated.guest._id,
          type: 'booking_cancelled',
          title: 'Booking Cancelled by Support',
          message: `Reservation #${populated._id.toString().slice(-6).toUpperCase()} at "${populated.listing ? populated.listing.title : 'WanderStay Property'}" was cancelled by support.`,
          link: '/bookings/history'
        });

        if (populated.listing && populated.listing.owner) {
          createNotification({
            userId: populated.listing.owner._id,
            type: 'booking_cancelled',
            title: 'Reservation Cancelled by Support',
            message: `Reservation #${populated._id.toString().slice(-6).toUpperCase()} at "${populated.listing.title}" was cancelled by support.`,
            link: '/dashboards/host'
          });
        }
      }
    })
    .catch(err => console.error('Admin cancellation dispatch error:', err.message));

  req.flash(
    'success',
    `Booking #${booking._id.toString().slice(-6).toUpperCase()} was cancelled and payment status updated to refunded.`
  );
  res.redirect('/admin?tab=bookings');
};

/**
 * Create New Host Account (Admin Tool)
 */
module.exports.createHost = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, bio } = req.body;
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      req.flash('error', 'A user with that username or email already exists.');
      return res.redirect('/admin?tab=users');
    }

    const newHost = new User({
      username,
      email,
      firstName: firstName || '',
      lastName: lastName || '',
      role: 'host',
      bio: bio || '',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'
    });

    await newHost.setPassword(password || 'password123');
    await newHost.save();

    req.flash('success', `Host account @${username} was created successfully!`);
    res.redirect('/admin?tab=users');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin?tab=users');
  }
};

/**
 * Approve Host Verification Request
 */
module.exports.approveHostVerification = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);

  if (!user) {
    req.flash('error', 'Host account not found.');
    return res.redirect('/admin?tab=verifications');
  }

  if (!user.hostVerification) {
    user.hostVerification = {};
  }

  user.hostVerification.status = 'verified';
  user.hostVerification.reviewedAt = new Date();
  user.hostVerification.reviewedBy = req.user._id;
  user.hostVerification.rejectionReason = '';
  await user.save();

  // Dispatch in-app notification to host
  createNotification({
    userId: user._id,
    type: 'system',
    title: 'Host Verification Approved! 🎉',
    message: 'Congratulations! Your identity has been verified by WanderStay Trust & Safety. The "✓ Verified Host" badge is now active across all your listings and public profile.',
    link: '/dashboard/host#verification-section'
  });

  req.flash('success', `Host @${user.username} has been verified successfully. The ✓ Verified Host badge is now live.`);
  res.redirect('/admin?tab=verifications');
};

/**
 * Reject Host Verification Request
 */
module.exports.rejectHostVerification = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const user = await User.findById(id);

  if (!user) {
    req.flash('error', 'Host account not found.');
    return res.redirect('/admin?tab=verifications');
  }

  if (!user.hostVerification) {
    user.hostVerification = {};
  }

  const rejectionReason = (reason && reason.trim()) ? reason.trim() : 'Document illegible or information mismatch.';
  user.hostVerification.status = 'rejected';
  user.hostVerification.reviewedAt = new Date();
  user.hostVerification.reviewedBy = req.user._id;
  user.hostVerification.rejectionReason = rejectionReason;
  await user.save();

  // Dispatch in-app notification to host
  createNotification({
    userId: user._id,
    type: 'system',
    title: 'Host Verification Update',
    message: `Your host verification request was not approved: "${rejectionReason}". You may re-submit with updated documents.`,
    link: '/dashboard/host#verification-section'
  });

  req.flash('warning', `Host @${user.username} verification request was rejected.`);
  res.redirect('/admin?tab=verifications');
};

/**
 * Revoke Host Verification
 */
module.exports.revokeHostVerification = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);

  if (!user) {
    req.flash('error', 'Host account not found.');
    return res.redirect('/admin?tab=verifications');
  }

  if (user.hostVerification) {
    user.hostVerification.status = 'unverified';
    user.hostVerification.rejectionReason = 'Verification revoked by administration.';
    await user.save();
  }

  createNotification({
    userId: user._id,
    type: 'system',
    title: 'Host Verification Revoked',
    message: 'Your host verification status has been revoked by administration. Contact support if you believe this is an error.',
    link: '/dashboard/host#verification-section'
  });

  req.flash('info', `Host @${user.username} verification has been revoked.`);
  res.redirect('/admin?tab=verifications');
};

/**
 * Trigger Data-Driven Superhost Evaluation for All Hosts
 */
module.exports.evaluateSuperhosts = async (req, res) => {
  const { syncAllHostsSuperhostStatus } = require('../utils/superhostHelper');
  const results = await syncAllHostsSuperhostStatus();
  const superhostCount = results.filter(r => r.evaluation && r.evaluation.qualifies).length;
  req.flash('success', `Superhost status recalculated across all ${results.length} host accounts. ${superhostCount} host(s) qualify as Superhost.`);
  res.redirect('/admin?tab=users');
};

/**
 * Trigger Superhost Evaluation for a Single Host
 */
module.exports.evaluateHostSuperhost = async (req, res) => {
  const { id } = req.params;
  const { syncHostSuperhostStatus } = require('../utils/superhostHelper');
  const result = await syncHostSuperhostStatus(id);

  if (!result) {
    req.flash('error', 'Host account not found or user is not a host.');
  } else if (result.evaluation.qualifies) {
    req.flash('success', `Host @${result.user.username} meets all criteria and is awarded ⭐ Superhost! (${result.evaluation.badgeReason})`);
  } else {
    req.flash('info', `Host @${result.user.username} does not currently qualify for Superhost: ${result.evaluation.badgeReason}`);
  }
  res.redirect('/admin?tab=users');
};

/**
 * Create New Coupon / Promo Code
 */
module.exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      maxDiscount,
      minBookingAmount,
      startDate,
      expiryDate,
      usageLimit,
      perUserLimit,
      isActive,
      description
    } = req.body;

    if (!code || !code.trim()) {
      req.flash('error', 'Coupon code is required.');
      return res.redirect('/admin?tab=coupons');
    }

    const cleanCode = code.trim().toUpperCase();

    // Check if code already exists
    const existing = await Coupon.findOne({ code: cleanCode });
    if (existing) {
      req.flash('error', `A coupon with code "${cleanCode}" already exists.`);
      return res.redirect('/admin?tab=coupons');
    }

    const parsedDiscountValue = Number(discountValue);
    if (isNaN(parsedDiscountValue) || parsedDiscountValue <= 0) {
      req.flash('error', 'Discount value must be greater than zero.');
      return res.redirect('/admin?tab=coupons');
    }

    if (discountType === 'percentage' && parsedDiscountValue > 100) {
      req.flash('error', 'Percentage discount cannot exceed 100%.');
      return res.redirect('/admin?tab=coupons');
    }

    if (!expiryDate) {
      req.flash('error', 'Expiry date is required.');
      return res.redirect('/admin?tab=coupons');
    }

    const newCoupon = new Coupon({
      code: cleanCode,
      discountType: discountType === 'fixed' ? 'fixed' : 'percentage',
      discountValue: parsedDiscountValue,
      maxDiscount: maxDiscount && Number(maxDiscount) > 0 ? Number(maxDiscount) : null,
      minBookingAmount: minBookingAmount && Number(minBookingAmount) > 0 ? Number(minBookingAmount) : 0,
      startDate: startDate ? new Date(startDate) : new Date(),
      expiryDate: new Date(expiryDate),
      usageLimit: usageLimit && Number(usageLimit) > 0 ? Number(usageLimit) : null,
      perUserLimit: perUserLimit && Number(perUserLimit) > 0 ? Number(perUserLimit) : 1,
      isActive: isActive === 'on' || isActive === true || isActive === 'true',
      description: description ? description.trim() : '',
      createdBy: req.user._id
    });

    await newCoupon.save();

    req.flash('success', `Coupon "${cleanCode}" created successfully!`);
    res.redirect('/admin?tab=coupons');
  } catch (err) {
    console.error('Error creating coupon:', err);
    req.flash('error', `Failed to create coupon: ${err.message}`);
    res.redirect('/admin?tab=coupons');
  }
};

/**
 * Toggle Coupon Active Status
 */
module.exports.toggleCouponStatus = async (req, res) => {
  const { id } = req.params;
  const coupon = await Coupon.findById(id);

  if (!coupon) {
    req.flash('error', 'Coupon not found.');
    return res.redirect('/admin?tab=coupons');
  }

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  req.flash('success', `Coupon "${coupon.code}" is now ${coupon.isActive ? 'active' : 'inactive'}.`);
  res.redirect('/admin?tab=coupons');
};

/**
 * Delete Coupon
 */
module.exports.deleteCoupon = async (req, res) => {
  const { id } = req.params;
  const coupon = await Coupon.findById(id);

  if (!coupon) {
    req.flash('error', 'Coupon not found.');
    return res.redirect('/admin?tab=coupons');
  }

  await Coupon.findByIdAndDelete(id);

  req.flash('success', `Coupon "${coupon.code}" deleted successfully.`);
  res.redirect('/admin?tab=coupons');
};
