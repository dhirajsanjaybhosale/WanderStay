const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },

  description: {
    type: String,
    required: true,
  },

  image: {
    url: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
  },
  photos: [
    {
      url: String,
      filename: String,
    }
  ],
  isAvailable: {
    type: Boolean,
    default: true,
  },
  blockedDates: [
    {
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
      reason: {
        type: String,
        default: "Host blocked",
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  price: {
    type: Number,
    required: true,
  },
  baseCurrency: {
    type: String,
    default: 'INR',
    uppercase: true,
    trim: true,
  },

  pricing: {
    weekendPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    baseGuests: {
      type: Number,
      default: 2,
      min: 1,
    },
    extraGuestFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    seasonalPricing: [
      {
        name: { type: String, trim: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        price: { type: Number, required: true, min: 0 },
      }
    ],
    holidayPricing: [
      {
        name: { type: String, trim: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        price: { type: Number, required: true, min: 0 },
      }
    ],
  },

  location: {
    type: String,
    required: true,
  },

  country: {
    type: String,
    required: true,
  },

  category: {
    type: String,
    enum: [
      "Beach",
      "City",
      "Mountain",
      "Lake",
      "Ski",
      "Desert",
      "Cabin",
      "Villa",
    ],
    required: true,
  },

  amenities: {
    type: [String],
    default: [],
  },

  guests: {
    type: Number,
    default: 2,
    min: 1,
  },

  bedrooms: {
    type: Number,
    default: 1,
    min: 0,
  },

  bathrooms: {
    type: Number,
    default: 1,
    min: 0,
  },

  propertyType: {
    type: String,
    enum: [
      "Entire home",
      "Villa",
      "Apartment",
      "Cabin",
      "Cottage",
      "Chalet",
      "Resort",
      "Private room",
      "Unique stay"
    ],
    default: "Entire home",
  },

  instantBook: {
    type: Boolean,
    default: true,
  },

  cancellationPolicy: {
    type: String,
    enum: ['Flexible', 'Moderate', 'Strict'],
    default: 'Flexible',
  },

  averageRating: {
    type: Number,
    default: 0,
  },

  views: {
    type: Number,
    default: 0,
    min: 0,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  geometry: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },

  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],

  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
});

/* Search & Filter indexes */
listingSchema.index({ geometry: "2dsphere" });
listingSchema.index({ amenities: 1 });
listingSchema.index({ category: 1, price: 1 });
listingSchema.index({ averageRating: -1 });
listingSchema.index({ guests: 1, bedrooms: 1, bathrooms: 1 });
listingSchema.index({ propertyType: 1 });
listingSchema.index({ instantBook: 1 });

/* Cascade delete reviews */
listingSchema.post("findOneAndDelete", async function (listing) {
  if (listing) {
    await Review.deleteMany({ _id: { $in: listing.reviews } });
  }
});

module.exports = mongoose.model("Listing", listingSchema);
