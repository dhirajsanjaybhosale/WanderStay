const express = require("express");
const router = express.Router({ mergeParams: true });

const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isOwner, validateListing, validateBooking } = require("../middleware.js");
const listingController = require("../controllers/listings.js");
const bookingsController = require("../controllers/bookings.js");

const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });
const uploadListingImages = upload.fields([
  { name: "listing[image]", maxCount: 5 },
  { name: "listing[images]", maxCount: 5 },
  { name: "image", maxCount: 5 }
]);

// ================== INDEX & CREATE ==================
router.route("/")
  .get(wrapAsync(listingController.index))
  .post(
    isLoggedIn,
    uploadListingImages,
    validateListing,
    wrapAsync(listingController.createListing)
  );


// ================== NEW FORM ==================
router.get("/new", isLoggedIn, listingController.renderNewForm);


// ================== SHOW, UPDATE, DELETE ==================
router.route("/:id")
  .get(wrapAsync(listingController.showListing))
  .put(
    isLoggedIn,
    isOwner,
    uploadListingImages,
    validateListing,
    wrapAsync(listingController.updateListing)
  )
  .delete(
    isLoggedIn,
    isOwner,
    wrapAsync(listingController.destroyListing)
  );

// ================== BOOKING ==================
router.post(
  "/:id/bookings",
  isLoggedIn,
  validateBooking,
  wrapAsync(bookingsController.createBooking)
);


// ================== EDIT FORM ==================
router.get(
  "/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(listingController.renderEditForm)
);


module.exports = router;
