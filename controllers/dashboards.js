const Listing = require('../models/listing');
const Booking = require('../models/booking');
const User = require('../models/user');
const Review = require('../models/review');

module.exports.hostDashboard = async (req, res) => {
  const listings = await Listing.find({ owner: req.user._id }).sort({ createdAt: -1 });
  const bookings = await Booking.find({})
    .populate('listing')
    .populate('guest');
  const hostBookings = bookings.filter(
    (booking) => booking.listing && booking.listing.owner && booking.listing.owner.equals(req.user._id)
  );
  const totalEarnings = hostBookings.reduce((sum, booking) => sum + (booking.status === 'confirmed' ? booking.totalPrice : 0), 0);
  res.render('dashboards/host.ejs', { listings, hostBookings, totalEarnings });
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

