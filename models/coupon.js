const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true, uppercase: true, trim: true, index: true },
  type: { type: String, enum: ['percent', 'fixed'], required: true },
  value: { type: Number, required: true, min: 0 }, // percent: 0-100, fixed: currency units
  maxDiscount: { type: Number, default: 0 }, // 0 = no cap
  minOrder: { type: Number, default: 0 },
  startsAt: { type: Date },
  expiresAt: { type: Date },
  usageLimit: { type: Number, default: 0 }, // 0 = unlimited
  perUserLimit: { type: Number, default: 0 }, // 0 = unlimited
  active: { type: Boolean, default: true },
  notes: { type: String },
  usedCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
