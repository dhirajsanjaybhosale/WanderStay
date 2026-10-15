const Listing = require('../models/listing');
const Booking = require('../models/booking');
const User = require('../models/user');
const Review = require('../models/review');
const { createNotification } = require('../utils/notificationHelper');
const { calculateHostSuperhostMetrics, syncHostSuperhostStatus } = require('../utils/superhostHelper');
const { calculateHostAnalytics } = require('../utils/analyticsHelper');

module.exports.hostDashboard = async (req, res) => {
  const range = req.query.range || '30d';
  const superhostData = await calculateHostSuperhostMetrics(req.user._id);
  await syncHostSuperhostStatus(req.user._id);
  const currentHost = await User.findById(req.user._id);
  const listings = await Listing.find({ owner: req.user._id }).sort({ createdAt: -1 });
  const bookings = await Booking.find({})
    .populate('listing')
    .populate('guest');
  const hostBookings = bookings.filter(
    (booking) => booking.listing && booking.listing.owner && booking.listing.owner.equals(req.user._id)
  );
  
  // Real database analytics & time-series data
  const analytics = await calculateHostAnalytics(req.user._id, range);
  const totalEarnings = analytics.totalRevenue;

  res.render('dashboards/host.ejs', { 
    listings, 
    hostBookings, 
    totalEarnings, 
    currentHost: currentHost || req.user, 
    superhostData,
    analytics,
    selectedRange: range
  });
};

module.exports.getHostAnalyticsData = async (req, res) => {
  const range = req.query.range || '30d';
  const analytics = await calculateHostAnalytics(req.user._id, range);
  return res.json({ success: true, analytics });
};

module.exports.submitHostVerification = async (req, res) => {
  const { legalName, documentType, documentNumber, notes } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    req.flash('error', 'Host account not found.');
    return res.redirect('/dashboard/host');
  }

  // Security: users must never be able to manually set themselves as verified from the frontend
  // Status always strictly transitions to 'pending'
  let docUrl = '';
  if (req.file) {
    docUrl = req.file.path || req.file.url;
  } else if (req.body.documentUrl) {
    docUrl = req.body.documentUrl.trim();
  }

  user.hostVerification = {
    status: 'pending',
    legalName: legalName ? legalName.trim() : (user.fullName || user.username),
    documentType: documentType || 'government_id',
    documentNumber: documentNumber ? documentNumber.trim() : '',
    documentUrl: docUrl,
    notes: notes ? notes.trim() : '',
    submittedAt: new Date(),
    rejectionReason: ''
  };

  await user.save();

  // Create in-app notification for host
  createNotification({
    userId: user._id,
    type: 'system',
    title: 'Verification Request Submitted',
    message: 'Your host verification credentials have been submitted and are pending administrative review.',
    link: '/dashboard/host#verification-section'
  });

  req.flash('success', 'Verification submitted successfully! Our Trust & Safety team will review your application.');
  res.redirect('/dashboard/host#verification-section');
};

module.exports.adminDashboard = async (req, res) => {
  const users = await User.find().sort({ username: 1 });
  const listings = await Listing.find().sort({ createdAt: -1 });
  const reviews = await Review.find().populate('author');
  res.render('dashboards/admin.ejs', { users, listings, reviews });
};

module.exports.updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (['guest', 'host', 'admin'].includes(role)) {
    const user = await User.findByIdAndUpdate(id, { role }, { new: true });
    req.flash('success', `User ${user ? user.username : ''} role updated to ${role}.`);
  } else {
    req.flash('error', 'Invalid role requested.');
  }
  res.redirect('/dashboard/admin');
};

module.exports.createHost = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, bio } = req.body;
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      req.flash('error', 'A user with that username or email already exists.');
      return res.redirect('/dashboard/admin');
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
    req.flash('success', `Host ${username} successfully created!`);
    res.redirect('/dashboard/admin');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/dashboard/admin');
  }
};

