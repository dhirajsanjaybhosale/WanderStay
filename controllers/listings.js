// controllers/listings.js

const Listing = require("../models/listing");
const mbxClient = require('@mapbox/mapbox-sdk');
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });


// List all listings
module.exports.index = async (req, res) => {
  const allowedCategories = ['Beach', 'City', 'Mountain', 'Lake', 'Ski', 'Desert', 'Cabin', 'Villa'];
  const { category } = req.query;
  const isValidCategory = category && allowedCategories.includes(category);
  const query = isValidCategory ? { category } : {};

  const allListings = await Listing.find(query);
  res.render("listings/index.ejs", {
    allListings,
    currentCategory: isValidCategory ? category : null,
    categories: allowedCategories,
  });
};

// Show single listing
module.exports.showListing = async (req, res) => {
  const { id } = req.params;

  const listing = await Listing.findById(id)
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("owner");

  if (!listing) {
    req.flash("error", "Listing does not exist!");
    return res.redirect("/listings");
  }

  res.render("listings/show.ejs", { listing });
};

// Render new listing form
module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};

// Create a new listing
module.exports.createListing = async (req, res) => {
  let response= await geocodingClient.forwardGeocode({
  query: req.body.listing.location,
  limit: 1
})
  .send()

  //const {title, description,image,....}= req.body;  this is inefficient
  let url = req.file.path;
  let filename = req.file.filename;
  const newlisting = new Listing(req.body.listing); //here listing is and object with each fields see names new.ejs for reference
  newlisting.owner = req.user._id;
  newlisting.image = { url, filename };
  newlisting.geometry = response.body.features[0].geometry;
  let savedListing=await newlisting.save();
  console.log(savedListing);
  req.flash("success", "New Listing Created!");
  res.redirect("/listings");
};

// Render edit form
module.exports.renderEditForm = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  res.render("listings/edit.ejs", { listing });
};

// Update listing
module.exports.updateListing = async (req, res) => {
let { id } = req.params;
  let listing = await Listing.findByIdAndUpdate(id, {...req.body.listing }, {new:true});
  // Update map
if (req.body.listing.location) {
  let response = await geocodingClient.forwardGeocode({
    query: req.body.listing.location,
    limit: 1
  }).send();
  listing.geometry = response.body.features[0].geometry;
  await listing.save(); // save the new geometry
}


  if (typeof req.file!=="undefined") {
    let url = req.file.path;
    let filename = req.file.filename;
    listing.image = { url, filename };
    await listing.save();
  }

  req.flash("success", "Listing Updated!");
  res.redirect(`/listings/${id}`);
};

// Delete listing
module.exports.destroyListing = async (req, res) => {
  const { id } = req.params;
  const deletedListing = await Listing.findByIdAndDelete(id);

  if (!deletedListing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  req.flash("success", "Listing Deleted!");
  res.redirect("/listings");
};
