const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tripPlanSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  destination: { type: String, required: true },
  budget: { type: Number, required: true },
  days: { type: Number, required: true },
  travelType: { type: String, enum: ['Solo','Couple','Family','Friends'], required: true },
  itinerary: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TripPlan', tripPlanSchema);
