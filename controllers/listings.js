const Listing = require("../models/listing");
const User = require("../models/user");
const Booking = require("../models/booking");
const mongoose = require('mongoose');
const { createNotification } = require('../utils/notificationHelper');

const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });


function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Show all listings
module.exports.index = async (req, res) => {
  const allowedCategories = [
    'Beach', 'City', 'Mountain', 'Lake',
    'Ski', 'Desert', 'Cabin', 'Villa'
  ];

  const { category, q, minPrice, maxPrice, sortBy } = req.query;
  let query = {};
  let currentCategory = null;
  let searchQuery = q ? q.trim() : "";

  if (category && allowedCategories.includes(category)) {
    query.category = category;
    currentCategory = category;
  } else if (searchQuery) {
    const normalizedQuery = searchQuery.toLowerCase();
    const categoryMatch = allowedCategories.find(
      (cat) => cat.toLowerCase() === normalizedQuery
    );

    if (categoryMatch) {
      query.category = categoryMatch;
      currentCategory = categoryMatch;
    } else {
      const regex = new RegExp(escapeRegex(searchQuery), "i");
      query.$or = [
        { title: regex },
        { description: regex },
        { category: regex },
        { location: regex },
        { country: regex }
      ];
    }
  }

  if (minPrice) {
    query.price = { ...query.price, $gte: Number(minPrice) };
  }
  if (maxPrice) {
    query.price = { ...query.price, $lte: Number(maxPrice) };
  }

  let sort = { createdAt: -1 };
  if (sortBy === 'priceAsc') sort = { price: 1 };
  if (sortBy === 'priceDesc') sort = { price: -1 };
  if (sortBy === 'rating') sort = { averageRating: -1, createdAt: -1 };

  const allListings = await Listing.find(query).sort(sort).populate("owner");

  res.render("listings/index.ejs", {
    allListings,
    currentCategory,
    categories: allowedCategories,
    searchQuery,
    minPrice: minPrice || '',
    maxPrice: maxPrice || '',
    sortBy: sortBy || ''
  });
};

// Render new form
module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};


// Show single listing
module.exports.showListing = async (req, res) => {
  let { id } = req.params;

  // Validate id to avoid Mongoose CastError when id is malformed
  if (!mongoose.Types.ObjectId.isValid(id)) {
    req.flash('error', 'Invalid listing id');
    return res.redirect('/listings');
  }

  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: { path: "author" },
    })
    .populate("owner");

  if (!listing) {
    req.flash("error", "Listing Does Not Exist!");
    return res.redirect("/listings");
  }

  const isWishlisted = req.user && Array.isArray(req.user.wishlist)
    ? req.user.wishlist.some((item) => item.equals(listing._id))
    : false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const confirmedBookings = await Booking.find({
    listing: listing._id,
    status: 'confirmed',
    checkOut: { $gte: today }
  }).select('checkIn checkOut nights guests status');

  res.render("listings/show.ejs", {
    listing,
    isWishlisted,
    confirmedBookings: confirmedBookings || [],
    blockedDates: listing.blockedDates || []
  });
};


// Helper to extract uploaded files safely
function getUploadedPhotos(req) {
  let files = [];
  if (Array.isArray(req.files)) {
    files = req.files;
  } else if (req.files && typeof req.files === "object") {
    for (const key of Object.keys(req.files)) {
      if (Array.isArray(req.files[key])) {
        files = files.concat(req.files[key]);
      }
    }
  } else if (req.file) {
    files = [req.file];
  }
  return files.map((file) => ({
    url: file.path || file.url,
    filename: file.filename || "listingimage",
  }));
}

// Create new listing
module.exports.createListing = async (req, res) => {
  let geometry = {
    type: "Point",
    coordinates: [77.2090, 28.6139], // Default fallback coordinates
  };
  let resolvedLocation = req.body.listing.location;

  try {
    if (mapToken && req.body.listing.location) {
      const response = await geocodingClient.forwardGeocode({
        query: req.body.listing.location,
        limit: 1,
      }).send();

      if (response && response.body && response.body.features && response.body.features.length > 0) {
        const feature = response.body.features[0];
        resolvedLocation = feature.place_name || req.body.listing.location;
        if (feature.geometry && feature.geometry.coordinates) {
          geometry = feature.geometry;
        }
      }
    }
  } catch (geoErr) {
    console.error("Mapbox Geocoding notice:", geoErr.message);
  }

  const newListing = new Listing(req.body.listing);
  newListing.owner = req.user._id;
  newListing.geometry = geometry;
  newListing.location = resolvedLocation;

  const uploadedPhotos = getUploadedPhotos(req);
  if (uploadedPhotos.length > 0) {
    newListing.photos = uploadedPhotos;
    newListing.image = uploadedPhotos[0];
  } else {
    // Default fallback image
    const defaultPhoto = {
      url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
      filename: "default_listing_image",
    };
    newListing.image = defaultPhoto;
    newListing.photos = [defaultPhoto];
  }

  await newListing.save();

  // If creator is guest, promote them to host
  if (req.user && req.user.role === 'guest') {
    await User.findByIdAndUpdate(req.user._id, { role: 'host' });
    req.user.role = 'host';
  }

  // In-app notification for host
  createNotification({
    userId: req.user._id,
    type: 'listing_approved',
    title: 'Listing Published & Live!',
    message: `Your property "${newListing.title}" is now published and active on WanderStay.`,
    link: `/listings/${newListing._id}`
  });

  req.flash('success', 'New Listing Created!');
  res.redirect(`/listings/${newListing._id}`);
};


// Render edit form
module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    req.flash('error', 'Invalid listing id');
    return res.redirect('/listings');
  }

  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing Does Not Exist!");
    return res.redirect("/listings");
  }

  let OrignalImageUrl = (listing.image && listing.image.url) ? listing.image.url : "";
  if (OrignalImageUrl.includes("/upload")) {
    OrignalImageUrl = OrignalImageUrl.replace("/upload", "/upload/h_200,w_250");
  }

  res.render("listings/edit.ejs", { listing, OrignalImageUrl });
};


// Update listing
module.exports.updateListing = async (req, res) => {
  let { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    req.flash('error', 'Invalid listing id');
    return res.redirect('/listings');
  }

  let listing = await Listing.findByIdAndUpdate(
    id,
    { ...req.body.listing },
    { new: true }
  );

  if (!listing) {
    req.flash("error", "Listing Not Found!");
    return res.redirect("/listings");
  }

  // Update geometry if location changed
  if (req.body.listing.location) {
    try {
      if (mapToken) {
        let response = await geocodingClient.forwardGeocode({
          query: req.body.listing.location,
          limit: 1,
        }).send();

        if (response && response.body && response.body.features && response.body.features.length > 0) {
          const feature = response.body.features[0];
          listing.geometry = feature.geometry || listing.geometry;
          listing.location = feature.place_name || req.body.listing.location;
          await listing.save();
        }
      }
    } catch (geoErr) {
      console.error("Geocoding update error:", geoErr.message);
    }
  }

  // Update photos if new files uploaded
  const newPhotos = getUploadedPhotos(req);
  if (newPhotos.length > 0) {
    if (!listing.photos) listing.photos = [];
    listing.photos.push(...newPhotos);
    listing.image = newPhotos[0];
    await listing.save();
  }

  req.flash("success", "Listing Updated!");
  res.redirect(`/listings/${id}`);
};


// Delete listing
module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    req.flash('error', 'Invalid listing id');
    return res.redirect('/listings');
  }

  let deletedListing = await Listing.findByIdAndDelete(id);

  if (!deletedListing) {
    req.flash("error", "Listing Not Found!");
    return res.redirect("/listings");
  }

  console.log(deletedListing);

  req.flash("success", "Listing Deleted!");
  res.redirect("/listings");
};

// Availability JSON endpoint
module.exports.getAvailability = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid listing id" });
  }

  const listing = await Listing.findById(id).select("isAvailable blockedDates title price");
  if (!listing) {
    return res.status(404).json({ error: "Listing not found" });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bookings = await Booking.find({
    listing: id,
    status: "confirmed",
    checkOut: { $gte: today }
  }).select("checkIn checkOut nights status");

  res.json({
    success: true,
    isAvailable: listing.isAvailable,
    bookedRanges: bookings.map((b) => ({
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      nights: b.nights
    })),
    blockedRanges: (listing.blockedDates || []).map((b) => ({
      _id: b._id,
      startDate: b.startDate,
      endDate: b.endDate,
      reason: b.reason
    }))
  });
};

// Host blocks dates manually
module.exports.blockDates = async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate, reason } = req.body;
  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing not found.");
    return res.redirect("/listings");
  }

  if (!startDate || !endDate) {
    req.flash("error", "Please provide both start date and end date.");
    return res.redirect(`/listings/${id}#calendar-section`);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    req.flash("error", "Invalid date format.");
    return res.redirect(`/listings/${id}#calendar-section`);
  }

  if (end <= start) {
    req.flash("error", "End date must be after start date.");
    return res.redirect(`/listings/${id}#calendar-section`);
  }

  // Check if there are confirmed bookings during this time
  const conflict = await Booking.findOne({
    listing: listing._id,
    status: "confirmed",
    checkIn: { $lt: end },
    checkOut: { $gt: start }
  });

  if (conflict) {
    req.flash("error", "Cannot block dates because a guest already has a confirmed reservation in that range.");
    return res.redirect(`/listings/${id}#calendar-section`);
  }

  listing.blockedDates.push({
    startDate: start,
    endDate: end,
    reason: reason ? reason.trim() : "Blocked by host"
  });

  await listing.save();
  req.flash("success", "Selected dates have been blocked from reservations.");
  res.redirect(`/listings/${id}#calendar-section`);
};

// Host unblocks dates
module.exports.unblockDates = async (req, res) => {
  const { id, blockId } = req.params;
  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing not found.");
    return res.redirect("/listings");
  }

  listing.blockedDates = listing.blockedDates.filter((b) => !b._id.equals(blockId));
  await listing.save();
  req.flash("success", "Blocked dates removed and reopened for reservations.");
  res.redirect(`/listings/${id}#calendar-section`);
};

