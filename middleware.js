const Listing = require("./models/listing");
const Review = require("./models/review");
const ExpressError= require("./utils/ExpressError.js");
const { listingSchema, reviewSchema, bookingSchema } = require("./schema.js");



module.exports.isLoggedIn = (req,res,next) =>{
    if(!req.isAuthenticated()){
       req.session.redirectUrl = req.originalUrl;
    req.flash("error","You must be logged in to created listing!")
    return res.redirect("/login")
  }
  next();
};

module.exports.saveRedirectUrl = (req,res,next) =>{
  if(req.session.redirectUrl){
     res.locals.redirectUrl = req.session.redirectUrl;
  }
  next();
}

module.exports.isOwner= async(req,res,next) =>{
  let { id } = req.params;
  let listing = await Listing.findById(id);
  if(!req.user || !listing.owner.equals(req.user._id)){
    req.flash("error","You don't have permission to edit");
    return res.redirect(`/listings/${id}`);
  }
  next();
};


module.exports.validateListing = (req, res, next) => {
  const { error } = listingSchema.validate(req.body);
  if (error) {
    const errMsg = error.details.map(el => el.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

module.exports.validateReview = (req, res, next) => {
  const { error } = reviewSchema.validate(req.body);
  if (error) {
    const errMsg = error.details.map(el => el.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};


module.exports.isReviewAuthor= async(req,res,next) =>{
  let { id,reviewId } = req.params;
  let review = await Review.findById(reviewId);
  if(!req.user || !review.author.equals(req.user._id)){
    req.flash("error","You are not author of this review ");
    return res.redirect(`/listings/${id}`);
  }
  next();
};

module.exports.validateBooking = (req, res, next) => {
  const { error } = bookingSchema.validate(req.body);
  if (error) {
    const errMsg = error.details.map(el => el.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

module.exports.isHost = (req, res, next) => {
  if (!req.user || req.user.role !== 'host') {
    req.flash('error', 'Host access only.');
    return res.redirect('/listings');
  }
  next();
};

module.exports.isAdmin = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash('error', 'You must be logged in as an administrator.');
    return res.redirect('/login');
  }
  if (req.user.role !== 'admin') {
    return res.status(403).render('error.ejs', {
      err: {
        statusCode: 403,
        message: 'Access Denied: Administrator privileges are required to access this resource.'
      }
    });
  }
  next();
};


