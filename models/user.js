const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const bcrypt = require("bcrypt");

const userSchema = new Schema({
    email:{
        type:String,
        required:true,
        unique: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    firstName: {
      type: String,
      default: ''
    },
    lastName: {
      type: String,
      default: ''
    },
    role: {
      type: String,
      enum: ['guest','host','admin'],
      default: 'guest'
    },
    preferredLanguage: {
      type: String,
      enum: ['en', 'hi', 'mr'],
      default: 'en'
    },
    preferredCurrency: {
      type: String,
      enum: ['INR', 'USD', 'EUR', 'GBP'],
      default: 'INR'
    },
    isSuspended: {
      type: Boolean,
      default: false
    },
    avatar: {
      type: String,
      default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'
    },
    bio: {
      type: String,
      default: ''
    },
    phone: {
      type: String,
      default: ''
    },
    dateOfBirth: {
      type: Date
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'non-binary', 'other', 'prefer-not-to-say', ''],
      default: ''
    },
    country: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      default: ''
    },
    wishlist: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Listing'
      }
    ],
    resetPasswordToken: {
      type: String
    },
    resetPasswordExpires: {
      type: Date
    },
    isEmailVerified: {
      type: Boolean,
      default: true
    },
    isPhoneVerified: {
      type: Boolean,
      default: false
    },
    hostVerification: {
      status: {
        type: String,
        enum: ['unverified', 'pending', 'verified', 'rejected'],
        default: 'unverified',
        index: true
      },
      legalName: {
        type: String,
        default: ''
      },
      documentType: {
        type: String,
        enum: ['passport', 'national_id', 'drivers_license', 'government_id', 'business_license', 'other', ''],
        default: ''
      },
      documentNumber: {
        type: String,
        default: ''
      },
      documentUrl: {
        type: String,
        default: ''
      },
      submittedAt: {
        type: Date
      },
      reviewedAt: {
        type: Date
      },
      reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      rejectionReason: {
        type: String,
        default: ''
      },
      notes: {
        type: String,
        default: ''
      }
    },
    superhost: {
      isSuperhost: {
        type: Boolean,
        default: false,
        index: true
      },
      badgeReason: {
        type: String,
        default: ''
      },
      evaluatedAt: {
        type: Date
      },
      metrics: {
        completedBookings: { type: Number, default: 0 },
        averageRating: { type: Number, default: 0 },
        cancellationRate: { type: Number, default: 0 },
        responseRate: { type: Number, default: 100 },
        totalReviews: { type: Number, default: 0 }
      }
    },
    hash: {
        type: String,
        required: true
    },
    salt: {
        type: String,
        required: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for Verified Host Status
userSchema.virtual('isVerifiedHost').get(function() {
    return this.role === 'host' && this.hostVerification && this.hostVerification.status === 'verified';
});

// Virtual for Data-Driven Superhost Status
userSchema.virtual('isSuperhost').get(function() {
    return this.role === 'host' && this.superhost && this.superhost.isSuperhost === true;
});

// Virtual for Full Name
userSchema.virtual('fullName').get(function() {
    const first = (this.firstName || '').trim();
    const last = (this.lastName || '').trim();
    if (first && last) return `${first} ${last}`;
    if (first) return first;
    if (last) return last;
    return this.username || 'Traveler';
});

// Virtual for Initials Avatar
userSchema.virtual('initials').get(function() {
    const first = (this.firstName || '').trim();
    const last = (this.lastName || '').trim();
    if (first && last) return (first[0] + last[0]).toUpperCase();
    if (first) return first.slice(0, 2).toUpperCase();
    const u = (this.username || 'WS').trim();
    return u.slice(0, 2).toUpperCase();
});

// Virtual for Member Since date formatting
userSchema.virtual('memberSince').get(function() {
    const date = this.createdAt || (this._id && this._id.getTimestamp ? this._id.getTimestamp() : new Date());
    try {
        return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
    } catch (e) {
        return 'Recently';
    }
});

// Method to set password
userSchema.methods.setPassword = async function(password) {
    this.salt = await bcrypt.genSalt(12);
    this.hash = await bcrypt.hash(password, this.salt);
};

// Method to validate password
userSchema.methods.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.hash);
};

// Method to change password securely
userSchema.methods.changePassword = async function(currentPassword, newPassword) {
    const isValid = await this.validatePassword(currentPassword);
    if (!isValid) {
        throw new Error('Current password does not match.');
    }
    await this.setPassword(newPassword);
    await this.save();
};

module.exports = mongoose.model("User", userSchema);