const mongoose = require('mongoose');

const { Schema } = mongoose;

const seoSchema = new Schema(
  {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    metaImage: { type: String, default: '' },
  },
  { _id: false }
);

const pageLayoutSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    type: { type: String, default: 'page' }, // e.g. home, page, collection, product
    draftLayout: { type: Schema.Types.Mixed, default: { sections: [] } },
    publishedLayout: { type: Schema.Types.Mixed, default: { sections: [] } },
    seo: { type: seoSchema, default: () => ({}) },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PageLayout', pageLayoutSchema);
