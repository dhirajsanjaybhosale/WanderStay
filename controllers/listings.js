const Listing = require("../models/listing");
const User = require("../models/user");
const Booking = require("../models/booking");
const mongoose = require('mongoose');
const { createNotification } = require('../utils/notificationHelper');
const {
  getAllAmenities,
  getAmenityDetails,
  getCategorizedAmenities
} = require('../utils/amenitiesHelper');
const {
  getCancellationPolicy,
  CANCELLATION_POLICIES
} = require('../utils/cancellationHelper');
const {
  calculateListingPricing,
  sanitizePricing
} = require('../utils/pricingHelper');

const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = (mapToken && mapToken.trim()) ? mbxGeocoding({ accessToken: mapToken }) : null;


function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Show all listings
module.exports.index = async (req, res) => {
  const allowedCategories = [
    'Beach', 'City', 'Mountain', 'Lake',
    'Ski', 'Desert', 'Cabin', 'Villa'
  ];

  const allowedPropertyTypes = [
    'Entire home', 'Villa', 'Apartment', 'Cabin', 'Cottage', 'Chalet', 'Resort', 'Private room', 'Unique stay'
  ];

  const {
    category,
    q,
    destination,
    minPrice,
    maxPrice,
    sortBy,
    amenities,
    guests,
    bedrooms,
    bathrooms,
    propertyType,
    minRating,
    hostVerification,
    instantBook,
    page: pageQuery,
    limit: limitQuery
  } = req.query;
  let query = {};
  let currentCategory = null;
  let searchQuery = (q || destination || "").trim();

  // Normalize selected amenities for filtering
  let selectedAmenities = [];
  if (Array.isArray(amenities)) {
    selectedAmenities = amenities.filter(Boolean);
  } else if (typeof amenities === 'string' && amenities.trim()) {
    selectedAmenities = amenities.includes(',')
      ? amenities.split(',').map(s => s.trim()).filter(Boolean)
      : [amenities.trim()];
  }

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

  // Amenity-based database filtering ($all ensures listing has all selected amenities)
  if (selectedAmenities.length > 0) {
    query.amenities = { $all: selectedAmenities };
  }

  // Price range filtering
  if (minPrice && !isNaN(minPrice) && Number(minPrice) > 0) {
    query.price = { ...(query.price || {}), $gte: Number(minPrice) };
  }
  if (maxPrice && !isNaN(maxPrice) && Number(maxPrice) > 0) {
    query.price = { ...(query.price || {}), $lte: Number(maxPrice) };
  }

  // Rating filter (minRating: e.g. 4.0, 4.5, 4.8)
  if (minRating && !isNaN(minRating) && Number(minRating) > 0) {
    query.averageRating = { $gte: Number(minRating) };
  }

  // Guests filter ($gte)
  if (guests && !isNaN(guests) && Number(guests) > 0) {
    query.guests = { $gte: Number(guests) };
  }

  // Bedrooms filter ($gte)
  if (bedrooms && !isNaN(bedrooms) && Number(bedrooms) > 0) {
    query.bedrooms = { $gte: Number(bedrooms) };
  }

  // Bathrooms filter ($gte)
  if (bathrooms && !isNaN(bathrooms) && Number(bathrooms) > 0) {
    query.bathrooms = { $gte: Number(bathrooms) };
  }

  // Property Type filter
  if (propertyType && propertyType.trim()) {
    query.propertyType = propertyType.trim();
  }

  // Instant booking filter
  if (instantBook === 'true' || instantBook === '1' || instantBook === true) {
    query.instantBook = true;
  }

  // Host verification filter (queries User collection)
  if (hostVerification === 'verified') {
    const verifiedUsers = await User.find({ 'hostVerification.status': 'verified' }).distinct('_id');
    query.owner = { $in: verifiedUsers };
  }

  // Sorting
  let sort = { averageRating: -1, createdAt: -1 }; // Recommended default
  if (sortBy === 'priceAsc') sort = { price: 1 };
  else if (sortBy === 'priceDesc') sort = { price: -1 };
  else if (sortBy === 'rating') sort = { averageRating: -1, price: 1 };
  else if (sortBy === 'newest') sort = { createdAt: -1 };
  else if (sortBy === 'recommended') sort = { averageRating: -1, createdAt: -1 };

  // Calculate active filter count for UI badge
  let activeFilterCount = 0;
  if (searchQuery) activeFilterCount++;
  if (currentCategory) activeFilterCount++;
  if (minPrice || maxPrice) activeFilterCount++;
  if (minRating) activeFilterCount++;
  if (selectedAmenities.length > 0) activeFilterCount += selectedAmenities.length;
  if (guests && Number(guests) > 1) activeFilterCount++;
  if (bedrooms && Number(bedrooms) > 0) activeFilterCount++;
  if (bathrooms && Number(bathrooms) > 0) activeFilterCount++;
  if (propertyType) activeFilterCount++;
  if (hostVerification === 'verified') activeFilterCount++;
  if (instantBook === 'true' || instantBook === '1' || instantBook === true) activeFilterCount++;

  // Pagination
  const page = Math.max(1, parseInt(pageQuery, 10) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(limitQuery, 10) || 12));
  const totalListings = await Listing.countDocuments(query);
  const totalPages = Math.ceil(totalListings / limit) || 1;
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * limit;

  const allListings = await Listing.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate("owner");

  // Get price bounds across entire dataset for realistic price slider ranges
  const priceStats = await Listing.aggregate([
    { $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } }
  ]);
  const dbMinPrice = (priceStats[0] && priceStats[0].min) || 500;
  const dbMaxPrice = (priceStats[0] && priceStats[0].max) || 25000;

  res.render("listings/index.ejs", {
    allListings,
    totalListings,
    currentPage,
    totalPages,
    limit,
    currentCategory,
    categories: allowedCategories,
    propertyTypes: allowedPropertyTypes,
    searchQuery,
    destination: destination || '',
    minPrice: minPrice || '',
    maxPrice: maxPrice || '',
    dbMinPrice,
    dbMaxPrice,
    minRating: minRating || '',
    guests: guests || '',
    bedrooms: bedrooms || '',
    bathrooms: bathrooms || '',
    propertyType: propertyType || '',
    hostVerification: hostVerification || '',
    instantBook: (instantBook === 'true' || instantBook === '1' || instantBook === true) ? 'true' : '',
    sortBy: sortBy || 'recommended',
    allAmenities: getAllAmenities(),
    selectedAmenities,
    activeFilterCount,
    query: req.query
  });
};

// Render new form
module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs", {
    allAmenities: getAllAmenities(),
    categorizedAmenities: getCategorizedAmenities(),
    cancellationPolicies: CANCELLATION_POLICIES
  });
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

  // Real Analytics: Record property view asynchronously without blocking response
  Listing.findByIdAndUpdate(id, { $inc: { views: 1 } })
    .catch(err => console.error("Listing view tracking notice:", err.message));

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

  const { getListingGallery } = require('../utils/imageHelper');
  const galleryPhotos = getListingGallery(listing);

  const cancellationPolicy = getCancellationPolicy(listing.cancellationPolicy || 'Flexible');

  res.render("listings/show.ejs", {
    listing,
    isWishlisted,
    confirmedBookings: confirmedBookings || [],
    blockedDates: listing.blockedDates || [],
    getAmenityDetails,
    galleryPhotos,
    cancellationPolicy,
    allPolicies: CANCELLATION_POLICIES
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

  // Normalize amenities input
  const listingPayload = { ...req.body.listing };
  if (listingPayload.amenities && !Array.isArray(listingPayload.amenities)) {
    listingPayload.amenities = [listingPayload.amenities];
  } else if (!listingPayload.amenities) {
    listingPayload.amenities = [];
  }

  // Sanitize dynamic pricing configuration
  listingPayload.pricing = sanitizePricing(listingPayload.pricing);

  const newListing = new Listing(listingPayload);
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

  res.render("listings/edit.ejs", {
    listing,
    OrignalImageUrl,
    allAmenities: getAllAmenities(),
    categorizedAmenities: getCategorizedAmenities(),
    cancellationPolicies: CANCELLATION_POLICIES
  });
};


// Update listing
module.exports.updateListing = async (req, res) => {
  let { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    req.flash('error', 'Invalid listing id');
    return res.redirect('/listings');
  }

  const updateData = { ...req.body.listing };
  if (!updateData.amenities) {
    updateData.amenities = [];
  } else if (!Array.isArray(updateData.amenities)) {
    updateData.amenities = [updateData.amenities];
  }

  // Sanitize dynamic pricing configuration
  updateData.pricing = sanitizePricing(updateData.pricing);

  let listing = await Listing.findByIdAndUpdate(
    id,
    updateData,
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

// Real-time Pricing Quote API for listing details page
module.exports.getPricingQuote = async (req, res) => {
  const { id } = req.params;
  const { checkIn, checkOut, guests } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid listing ID' });
  }

  const listing = await Listing.findById(id);
  if (!listing) {
    return res.status(404).json({ success: false, message: 'Listing not found' });
  }

  if (!checkIn || !checkOut) {
    return res.status(400).json({ success: false, message: 'Please select both check-in and check-out dates' });
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid date values' });
  }

  checkInDate.setHours(0, 0, 0, 0);
  checkOutDate.setHours(0, 0, 0, 0);

  if (checkOutDate <= checkInDate) {
    return res.status(400).json({ success: false, message: 'Check-out date must be after check-in date' });
  }

  const numGuests = Math.max(1, parseInt(guests, 10) || 1);

  const quote = calculateListingPricing({
    listing,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    guests: numGuests
  });

  return res.json({
    success: true,
    pricing: quote
  });
};

