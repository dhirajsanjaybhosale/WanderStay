const User = require('../models/user');
const Listing = require('../models/listing');

module.exports.toggleWishlist = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(req.user._id);
  const index = user.wishlist.findIndex((listingId) => listingId.equals(id));

  if (index === -1) {
    user.wishlist.push(id);
    req.flash('success', 'Added to wishlist');
  } else {
    user.wishlist.splice(index, 1);
    req.flash('success', 'Removed from wishlist');
  }

  await user.save();
  res.redirect(`/listings/${id}`);
};

module.exports.viewWishlist = async (req, res) => {
  const user = await User.findById(req.user._id).populate('wishlist');
  res.render('wishlists/index.ejs', { wishlist: user.wishlist });
};
