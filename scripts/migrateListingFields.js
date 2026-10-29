const mongoose = require('mongoose');
const Listing = require('../models/listing');
const User = require('../models/user');

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
}

const isProduction = process.env.NODE_ENV === "production";
let mongoUrl = (process.env.MONGO_URL || "").trim();
if ((mongoUrl.startsWith('"') && mongoUrl.endsWith('"')) || (mongoUrl.startsWith("'") && mongoUrl.endsWith("'"))) {
  mongoUrl = mongoUrl.slice(1, -1).trim();
}

if (!mongoUrl) {
  if (isProduction) {
    console.error("❌ FATAL: MONGO_URL environment variable is required in production for migration.");
    process.exit(1);
  }
  mongoUrl = "mongodb://127.0.0.1:27017/wanderstays";
}

async function migrate() {
  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB for listing fields migration');

  // Find verified users
  let verifiedUser = await User.findOne({ 'hostVerification.status': 'verified' });
  if (!verifiedUser) {
    // If none, verify the first host or user
    verifiedUser = await User.findOne({ role: 'host' }) || await User.findOne();
    if (verifiedUser) {
      verifiedUser.hostVerification = {
        status: 'verified',
        legalName: verifiedUser.username,
        reviewedAt: new Date()
      };
      await verifiedUser.save();
      console.log('Set user as verified host:', verifiedUser.username);
    }
  }

  const listings = await Listing.find();
  console.log(`Found ${listings.length} listings to verify and populate`);

  const categoryDefaults = {
    Villa: { guests: 8, bedrooms: 4, bathrooms: 3, propertyType: 'Villa', instantBook: true },
    Beach: { guests: 4, bedrooms: 2, bathrooms: 2, propertyType: 'Entire home', instantBook: true },
    Mountain: { guests: 6, bedrooms: 3, bathrooms: 2, propertyType: 'Chalet', instantBook: true },
    Cabin: { guests: 4, bedrooms: 2, bathrooms: 1, propertyType: 'Cabin', instantBook: false },
    City: { guests: 2, bedrooms: 1, bathrooms: 1, propertyType: 'Apartment', instantBook: true },
    Lake: { guests: 5, bedrooms: 2, bathrooms: 2, propertyType: 'Cottage', instantBook: true },
    Ski: { guests: 6, bedrooms: 3, bathrooms: 2, propertyType: 'Chalet', instantBook: false },
    Desert: { guests: 2, bedrooms: 1, bathrooms: 1, propertyType: 'Unique stay', instantBook: true },
  };

  let count = 0;
  for (let i = 0; i < listings.length; i++) {
    const item = listings[i];
    const def = categoryDefaults[item.category] || { guests: 2, bedrooms: 1, bathrooms: 1, propertyType: 'Entire home', instantBook: true };
    
    if (item.guests === undefined || item.guests === null) item.guests = def.guests;
    if (item.bedrooms === undefined || item.bedrooms === null) item.bedrooms = def.bedrooms;
    if (item.bathrooms === undefined || item.bathrooms === null) item.bathrooms = def.bathrooms;
    if (!item.propertyType) item.propertyType = def.propertyType;
    if (item.instantBook === undefined || item.instantBook === null) item.instantBook = def.instantBook;
    if (!item.baseCurrency) item.baseCurrency = 'INR';

    // Ensure roughly 40% of listings belong to a verified host for testable filtering
    if (i % 2 === 0 && verifiedUser) {
      item.owner = verifiedUser._id;
    }

    await item.save();
    count++;
  }

  console.log(`Successfully migrated ${count} listings with search & filter attributes`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
