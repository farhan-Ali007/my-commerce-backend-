const mongoose = require('mongoose');

const SiteVisitSchema = new mongoose.Schema(
  {
    ipHash: { type: String, index: true },
    uaHash: { type: String, index: true },
    visitorIdHash: { type: String, index: true },
    path: { type: String, index: true },
    referer: { type: String },
    dateKey: { type: Date, index: true }, // start of day for de-dupe window
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// De-duplicate per IP+UA+path per day
SiteVisitSchema.index({ ipHash: 1, uaHash: 1, path: 1, dateKey: 1 }, { unique: true });

// Also de-duplicate per visitorId+path per day when visitorId is present
SiteVisitSchema.index(
  { visitorIdHash: 1, path: 1, dateKey: 1 },
  { unique: true, partialFilterExpression: { visitorIdHash: { $type: 'string' } } }
);

module.exports = mongoose.model('SiteVisit', SiteVisitSchema);
