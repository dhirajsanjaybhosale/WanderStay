const Listing = require("../models/listing");
const Review = require("../models/review");

async function updateAverageRating(listingId) {
  const listing = await Listing.findById(listingId).populate('reviews');
  if (!listing) return;
  const ratings = (listing.reviews || [])
    .map((review) => (review ? review.rating : null))
    .filter((r) => typeof r === "number" && !isNaN(r));

  listing.averageRating = ratings.length
    ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1))
    : 0;
  await listing.save();
}

const createReview = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  const newReview = new Review(req.body.review);
  newReview.author = req.user._id;
  await newReview.save();

  if (!listing.reviews) listing.reviews = [];
  listing.reviews.push(newReview);
  await listing.save();

  await updateAverageRating(listing._id);
  req.flash("success", "New Review Created!");
  res.redirect(`/listings/${listing._id}`);
};

const destroyReview = async (req, res) => {
  const { id, reviewId } = req.params;
  await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);
  await updateAverageRating(id);
  req.flash("success", "Review Deleted!");
  res.redirect(`/listings/${id}`);
};

module.exports = {
  createReview,
  creatReview: createReview,
  destroyReview
};