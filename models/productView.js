const mongoose = require('mongoose');

const ProductViewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    ipHash: { type: String, index: true },
    uaHash: { type: String, index: true },
    visitorIdHash: { type: String, index: true },
    referer: { type: String },
    dateKey: { type: Date, index: true }, // start of day for de-dupe window
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Optionally de-duplicate per product per day per IP+UA
ProductViewSchema.index({ product: 1, ipHash: 1, uaHash: 1, dateKey: 1 }, { unique: true });

// Also de-duplicate per visitorId+product per day when visitorId is present
ProductViewSchema.index(
  { product: 1, visitorIdHash: 1, dateKey: 1 },
  { unique: true, partialFilterExpression: { visitorIdHash: { $type: 'string' } } }
);

module.exports = mongoose.model('ProductView', ProductViewSchema);
