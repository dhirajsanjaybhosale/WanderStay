const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const voteSchema = new Schema({
  trip: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  option: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Vote', voteSchema);
