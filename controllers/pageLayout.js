const PageLayout = require('../models/pageLayout');

// Admin: create or update a draft layout by slug
const saveDraft = async (req, res) => {
  try {
    const { slug, type = 'page', layout = { sections: [] }, seo = {} } = req.body;
    if (!slug) return res.status(400).json({ error: 'slug is required' });

    const update = {
      slug,
      type,
      draftLayout: layout,
      seo: { ...(seo || {}) },
    };

    const doc = await PageLayout.findOneAndUpdate(
      { slug },
      { $set: update },
      { upsert: true, new: true }
    );
    return res.status(200).json(doc);
  } catch (err) {
    console.error('saveDraft error', err);
    return res.status(500).json({ error: err.message });
  }
};

// Admin: publish a layout (optionally providing layout to publish)
const publishLayout = async (req, res) => {
  try {
    const { slug, layout, seo } = req.body;
    if (!slug) return res.status(400).json({ error: 'slug is required' });

    const doc = await PageLayout.findOne({ slug });
    if (!doc) return res.status(404).json({ error: 'Layout not found' });

    const toPublish = layout || doc.draftLayout || { sections: [] };

    doc.publishedLayout = toPublish;
    if (seo) doc.seo = { ...(seo || {}) };
    doc.isPublished = true;
    doc.publishedAt = new Date();
    await doc.save();

    return res.status(200).json(doc);
  } catch (err) {
    console.error('publishLayout error', err);
    return res.status(500).json({ error: err.message });
  }
};

// Public: get published layout by slug (for rendering storefront)
const getPublishedBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const doc = await PageLayout.findOne({ slug, isPublished: true }).lean();
    if (!doc) return res.status(404).json({ error: 'Layout not found' });

    return res.status(200).json({
      slug: doc.slug,
      type: doc.type,
      layout: doc.publishedLayout || { sections: [] },
      seo: doc.seo || {},
      updatedAt: doc.updatedAt,
      publishedAt: doc.publishedAt,
    });
  } catch (err) {
    console.error('getPublishedBySlug error', err);
    return res.status(500).json({ error: err.message });
  }
};

// Admin: get draft by slug
const getDraftBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const doc = await PageLayout.findOne({ slug }).lean();
    if (!doc) return res.status(404).json({ error: 'Layout not found' });

    return res.status(200).json({
      slug: doc.slug,
      type: doc.type,
      draftLayout: doc.draftLayout || { sections: [] },
      publishedLayout: doc.publishedLayout || { sections: [] },
      seo: doc.seo || {},
      isPublished: doc.isPublished,
      updatedAt: doc.updatedAt,
      publishedAt: doc.publishedAt,
      _id: doc._id,
    });
  } catch (err) {
    console.error('getDraftBySlug error', err);
    return res.status(500).json({ error: err.message });
  }
};

// Admin: list all layouts
const getAllLayouts = async (_req, res) => {
  try {
    const docs = await PageLayout.find().sort({ updatedAt: -1 }).lean();
    return res.status(200).json(docs);
  } catch (err) {
    console.error('getAllLayouts error', err);
    return res.status(500).json({ error: err.message });
  }
};

// Admin: delete by id
const deleteLayout = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await PageLayout.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: 'Layout not found' });
    return res.status(200).json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteLayout error', err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  saveDraft,
  publishLayout,
  getPublishedBySlug,
  getDraftBySlug,
  getAllLayouts,
  deleteLayout,
};
