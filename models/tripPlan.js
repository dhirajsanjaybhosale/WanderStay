const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tripPlanSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  destination: { type: String, required: true },
  startDate: { type: Date },
  endDate: { type: Date },
  days: { type: Number, required: true, default: 3 },
  travelers: { type: Number, default: 2 },
  budget: { type: Number, required: true },
  travelStyle: { type: String, default: 'Adventure' },
  travelType: { type: String, default: 'Couple' },
  interests: [{ type: String }],
  suggestedListings: [{ type: Schema.Types.ObjectId, ref: 'Listing' }],
  itinerary: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TripPlan', tripPlanSchema);
