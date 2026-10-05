const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  readBy: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User',
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const conversationSchema = new Schema({
  participants: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    }
  ],
  listing: {
    type: Schema.Types.ObjectId,
    ref: 'Listing',
    required: true,
  },
  booking: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
  },
  lastMessage: {
    content: {
      type: String,
      default: '',
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  messages: [messageSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for fast query of a user's conversations
conversationSchema.index({ participants: 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
