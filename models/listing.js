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

  averageRating: {
    type: Number,
    default: 0,
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

/* Geospatial index for maps */
listingSchema.index({ geometry: "2dsphere" });

/* Cascade delete reviews */
listingSchema.post("findOneAndDelete", async function (listing) {
  if (listing) {
    await Review.deleteMany({ _id: { $in: listing.reviews } });
  }
});

module.exports = mongoose.model("Listing", listingSchema);
