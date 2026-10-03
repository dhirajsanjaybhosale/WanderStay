const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync');
const { isLoggedIn } = require('../middleware');
const wishlistController = require('../controllers/wishlists');

router.post('/:id/toggle', isLoggedIn, wrapAsync(wishlistController.toggleWishlist));
router.get('/', isLoggedIn, wrapAsync(wishlistController.viewWishlist));

module.exports = router;
