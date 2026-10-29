const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
  listing: {
    type: Schema.Types.ObjectId,
    ref: 'Listing',
    required: true,
  },
  guest: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  checkIn: {
    type: Date,
    required: true,
  },
  checkOut: {
    type: Date,
    required: true,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
    trim: true,
  },
  priceBreakdown: {
    basePricePerNight: Number,
    averageNightlyRate: Number,
    isDynamicPricingActive: { type: Boolean, default: false },
    roomSubtotal: Number,

    weekdayNights: { type: Number, default: 0 },
    weekdayRate: { type: Number, default: 0 },
    weekdayTotal: { type: Number, default: 0 },

    weekendNights: { type: Number, default: 0 },
    weekendRate: { type: Number, default: 0 },
    weekendTotal: { type: Number, default: 0 },

    seasonalNights: { type: Number, default: 0 },
    seasonalRate: { type: Number, default: 0 },
    seasonalTotal: { type: Number, default: 0 },
    seasonalName: { type: String, default: '' },

    holidayNights: { type: Number, default: 0 },
    holidayRate: { type: Number, default: 0 },
    holidayTotal: { type: Number, default: 0 },
    holidayName: { type: String, default: '' },

    baseGuests: { type: Number, default: 2 },
    extraGuests: { type: Number, default: 0 },
    extraGuestFeePerNight: { type: Number, default: 0 },
    extraGuestTotal: { type: Number, default: 0 },

    cleaningFee: { type: Number, default: 500 },
    serviceFee: { type: Number, default: 750 },
    totalPrice: Number,

    nightlyDetails: [
      {
        date: Date,
        rate: Number,
        type: { type: String, default: 'weekday' },
        label: String
      }
    ]
  },
  originalPrice: {
    type: Number,
  },
  discountAmount: {
    type: Number,
    default: 0,
  },
  coupon: {
    code: { type: String, default: '' },
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon' },
    discountType: { type: String, enum: ['percentage', 'fixed', ''] },
    discountValue: { type: Number, default: 0 },
  },
  nights: {
    type: Number,
    required: true,
  },
  guests: {
    type: Number,
    default: 1,
    min: 1,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'refund_pending', 'refunded'],
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'completed', 'Completed', 'failed', 'refund_pending', 'refunded'],
    default: 'pending',
  },
  cancellationPolicy: {
    type: String,
    enum: ['Flexible', 'Moderate', 'Strict'],
    default: 'Flexible',
  },
  cancellation: {
    cancelledAt: Date,
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reason: {
      type: String,
      default: '',
    },
    policyApplied: {
      type: String,
      enum: ['Flexible', 'Moderate', 'Strict', ''],
      default: 'Flexible',
    },
    refundPercentage: {
      type: Number,
      default: 0,
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
    refundStatus: {
      type: String,
      enum: ['none', 'pending', 'processed', 'failed'],
      default: 'none',
    },
    refundId: {
      type: String,
      default: '',
    },
    explanation: {
      type: String,
      default: '',
    },
  },
  razorpayOrderId: {
    type: String,
    default: '',
  },
  razorpayPaymentId: {
    type: String,
    default: '',
  },
  razorpaySignature: {
    type: String,
    default: '',
  },
  paidAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

bookingSchema.virtual('duration').get(function () {
  return this.nights;
});

module.exports = mongoose.model('Booking', bookingSchema);
