const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tripSchema = new Schema({
  title: { type: String, required: true },
  destination: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Trip', tripSchema);
