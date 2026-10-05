const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync');
const { isLoggedIn, isHost, isAdmin } = require('../middleware');
const dashboardController = require('../controllers/dashboards');

router.get('/', isLoggedIn, (req, res) => {
  if (req.user.role === 'admin') return res.redirect('/admin');
  if (req.user.role === 'host') return res.redirect('/dashboard/host');
  res.redirect('/bookings/history');
});

router.get('/host', isLoggedIn, isHost, wrapAsync(dashboardController.hostDashboard));
router.get('/admin', isLoggedIn, (req, res) => res.redirect('/admin'));

module.exports = router;
