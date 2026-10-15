const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const couponSchema = new Schema({
  code: {
    type: String,
    required: [true, 'Coupon code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  discountType: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed'],
    default: 'percentage',
  },
  discountValue: {
    type: Number,
    required: [true, 'Discount value is required'],
    min: [0.01, 'Discount value must be greater than zero'],
  },
  maxDiscount: {
    type: Number,
    default: null,
    min: [0, 'Max discount cannot be negative'],
  },
  minBookingAmount: {
    type: Number,
    default: 0,
    min: [0, 'Minimum booking amount cannot be negative'],
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required'],
    index: true,
  },
  usageLimit: {
    type: Number,
    default: null, // null or 0 means unlimited
  },
  perUserLimit: {
    type: Number,
    default: 1,
    min: [1, 'Per-user limit must be at least 1'],
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  usedCount: {
    type: Number,
    default: 0,
  },
  usageHistory: [
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      booking: {
        type: Schema.Types.ObjectId,
        ref: 'Booking',
      },
      discountAmount: Number,
      usedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  description: {
    type: String,
    default: '',
    trim: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Validates whether coupon can be applied for a specific user and booking amount.
 * @param {Object} params - { userId, bookingAmount }
 * @returns {Object} - { valid: boolean, message: string }
 */
couponSchema.methods.validateEligibility = function ({ userId, bookingAmount }) {
  const now = new Date();

  // 1. Check Active Status
  if (!this.isActive) {
    return { valid: false, message: 'This coupon code is currently inactive.' };
  }

  // 2. Check Start Date
  if (this.startDate && now < this.startDate) {
    return {
      valid: false,
      message: `This coupon will be valid starting ${new Date(this.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
    };
  }

  // 3. Check Expiration Date
  if (this.expiryDate && now > this.expiryDate) {
    return { valid: false, message: 'This coupon code has expired.' };
  }

  // 4. Check Minimum Booking Amount
  const amount = Number(bookingAmount) || 0;
  if (this.minBookingAmount && amount < this.minBookingAmount) {
    return {
      valid: false,
      message: `Minimum booking amount of ₹${this.minBookingAmount.toLocaleString('en-IN')} is required for this coupon.`,
    };
  }

  // 5. Check Global Usage Limit
  if (this.usageLimit && this.usageLimit > 0 && this.usedCount >= this.usageLimit) {
    return { valid: false, message: 'This coupon has reached its maximum overall usage limit.' };
  }

  // 6. Check Per-User Limit
  if (userId && this.perUserLimit && this.perUserLimit > 0) {
    const userUsageCount = (this.usageHistory || []).filter(
      (h) => h.user && h.user.toString() === userId.toString()
    ).length;

    if (userUsageCount >= this.perUserLimit) {
      return {
        valid: false,
        message: `You have already used this coupon code the maximum allowed (${this.perUserLimit} ${this.perUserLimit === 1 ? 'time' : 'times'}).`,
      };
    }
  }

  return { valid: true, message: 'Coupon is valid!' };
};

/**
 * Calculates discount amount securely on the server.
 * Never trust discount values from the frontend.
 * @param {number} amount - The base booking price
 * @returns {number} - Calculated discount in INR
 */
couponSchema.methods.calculateDiscount = function (amount) {
  const base = Number(amount) || 0;
  if (base <= 0) return 0;

  let discount = 0;
  if (this.discountType === 'percentage') {
    discount = Math.round((base * this.discountValue) / 100);
    if (this.maxDiscount && this.maxDiscount > 0) {
      discount = Math.min(discount, this.maxDiscount);
    }
  } else if (this.discountType === 'fixed') {
    discount = Math.round(this.discountValue);
  }

  // Discount cannot exceed the base price
  return Math.min(base, Math.max(0, discount));
};

module.exports = mongoose.model('Coupon', couponSchema);
