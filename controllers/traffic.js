const crypto = require('crypto');
const SiteVisit = require('../models/siteVisit');
const ProductView = require('../models/productView');
const Product = require('../models/product');

// Helpers
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const hash = (val) => (val ? crypto.createHash('sha256').update(val).digest('hex') : '');
const isBot = (ua = '') => /bot|crawler|spider|crawling|headless|curl|wget/i.test(ua);

// POST /traffic/visit
const recordVisit = async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    if (isBot(ua)) return res.status(200).json({ success: true, skipped: 'bot' });

    const { path = req.body?.path || req.originalUrl, referer = req.headers.referer || '', visitorId } = req.body || {};
    const today = startOfDay(new Date());
    const visitorIdHash = visitorId ? hash(String(visitorId)) : '';

    // Prefer visitorId-based dedupe when present; otherwise fallback to IP+UA
    // IMPORTANT: De-dupe per device per day (global), not per path.
    const filter = visitorIdHash
      ? { visitorIdHash, dateKey: today }
      : { ipHash: hash(ip), uaHash: hash(ua), dateKey: today };

    const doc = await SiteVisit.findOneAndUpdate(
      filter,
      // Keep the first referer/path of the day only on insert
      { $setOnInsert: { referer, path } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ success: true, createdAt: doc.createdAt });
  } catch (e) {
    // If unique index hit, treat as ok
    if (e?.code === 11000) return res.status(200).json({ success: true, deduped: true });
    console.error('recordVisit error', e);
    return res.status(500).json({ success: false, message: 'Failed to record visit' });
  }
};

// POST /traffic/product-view/:productId
const recordProductView = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) return res.status(400).json({ success: false, message: 'productId required' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    if (isBot(ua)) return res.status(200).json({ success: true, skipped: 'bot' });

    const referer = req.headers.referer || req.body?.referer || '';
    const { visitorId } = req.body || {};
    const today = startOfDay(new Date());
    const visitorIdHash = visitorId ? hash(String(visitorId)) : '';

    const filter = visitorIdHash
      ? { product: productId, visitorIdHash, dateKey: today }
      : { product: productId, ipHash: hash(ip), uaHash: hash(ua), dateKey: today };

    const doc = await ProductView.findOneAndUpdate(
      filter,
      { $setOnInsert: { referer } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ success: true, createdAt: doc.createdAt });
  } catch (e) {
    if (e?.code === 11000) return res.status(200).json({ success: true, deduped: true });
    console.error('recordProductView error', e);
    return res.status(500).json({ success: false, message: 'Failed to record product view' });
  }
};

// GET /traffic/summary?from&to&interval=day|week|month
const getSummary = async (req, res) => {
  try {
    const parseDate = (v, fb) => { const d = v ? new Date(v) : null; return isNaN(d?.getTime()) ? fb : d; };
    const toUnit = (u) => ['day', 'week', 'month'].includes(u) ? u : 'day';

    const now = new Date();
    const defFrom = new Date(now); defFrom.setDate(defFrom.getDate() - 29);
    const start = startOfDay(parseDate(req.query.from, defFrom));
    const end = new Date(parseDate(req.query.to, now));
    end.setHours(23,59,59,999);
    const unit = toUnit(req.query.interval);

    // Visitors series
    const visitorsSeries = await SiteVisit.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $addFields: { bucket: { $dateTrunc: { date: '$createdAt', unit } } } },
      { $group: { _id: '$bucket', visitors: { $sum: 1 } } },
      { $project: { _id: 0, date: '$_id', visitors: 1 } },
      { $sort: { date: 1 } },
    ]);

    // Product views series
    const productViewsSeries = await ProductView.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $addFields: { bucket: { $dateTrunc: { date: '$createdAt', unit } } } },
      { $group: { _id: '$bucket', views: { $sum: 1 } } },
      { $project: { _id: 0, date: '$_id', views: 1 } },
      { $sort: { date: 1 } },
    ]);

    // Totals for current range
    const [websiteVisitorsTotal, productViewsTotal] = await Promise.all([
      SiteVisit.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      ProductView.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    ]);

    // Predefined windows: today, last7, last30, allTime
    const startOfToday = startOfDay(new Date());
    const last7Start = new Date(now); last7Start.setDate(last7Start.getDate() - 6); // inclusive of today
    const last30Start = new Date(now); last30Start.setDate(last30Start.getDate() - 29);

    const [
      todayVisitors, todayViews,
      last7Visitors, last7Views,
      last30Visitors, last30Views,
      allTimeVisitors, allTimeViews,
    ] = await Promise.all([
      SiteVisit.countDocuments({ createdAt: { $gte: startOfToday } }),
      ProductView.countDocuments({ createdAt: { $gte: startOfToday } }),

      SiteVisit.countDocuments({ createdAt: { $gte: startOfDay(last7Start), $lte: end } }),
      ProductView.countDocuments({ createdAt: { $gte: startOfDay(last7Start), $lte: end } }),

      SiteVisit.countDocuments({ createdAt: { $gte: startOfDay(last30Start), $lte: end } }),
      ProductView.countDocuments({ createdAt: { $gte: startOfDay(last30Start), $lte: end } }),

      SiteVisit.estimatedDocumentCount(),
      ProductView.estimatedDocumentCount(),
    ]);

    // Top viewed products in current range
    const topViewedAgg = await ProductView.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$product', views: { $sum: 1 } } },
      { $sort: { views: -1 } },
      { $limit: 10 },
    ]);
    // Enrich with product info
    const productIds = topViewedAgg.map((d) => d._id).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } }).select('_id title images stock sold');
    const productMap = new Map(products.map(p => [String(p._id), p]));
    const topViewedProducts = topViewedAgg.map((d) => ({
      productId: d._id,
      views: d.views,
      product: productMap.get(String(d._id)) || null,
    }));

    return res.status(200).json({
      success: true,
      range: { start, end, interval: unit },
      websiteVisitorsTotal,
      productViewsTotal,
      visitorsSeries,
      productViewsSeries,
      buckets: {
        today: { visitors: todayVisitors, productViews: todayViews },
        last7: { visitors: last7Visitors, productViews: last7Views },
        last30: { visitors: last30Visitors, productViews: last30Views },
        allTime: { visitors: allTimeVisitors, productViews: allTimeViews },
      },
      topViewedProducts,
    });
  } catch (e) {
    console.error('getSummary error', e);
    return res.status(500).json({ success: false, message: 'Failed to get traffic summary' });
  }
};

// GET /traffic/product/:productId/series?from&to&interval=day|week|month
const getProductSeries = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) return res.status(400).json({ success: false, message: 'productId required' });
    const parseDate = (v, fb) => { const d = v ? new Date(v) : null; return isNaN(d?.getTime()) ? fb : d; };
    const toUnit = (u) => ['day', 'week', 'month'].includes(u) ? u : 'day';

    const now = new Date();
    const defFrom = new Date(now); defFrom.setDate(defFrom.getDate() - 29);
    const start = startOfDay(parseDate(req.query.from, defFrom));
    const end = new Date(parseDate(req.query.to, now));
    end.setHours(23,59,59,999);
    const unit = toUnit(req.query.interval);

    const series = await ProductView.aggregate([
      { $match: { product: require('mongoose').Types.ObjectId(productId), createdAt: { $gte: start, $lte: end } } },
      { $addFields: { bucket: { $dateTrunc: { date: '$createdAt', unit } } } },
      { $group: { _id: '$bucket', views: { $sum: 1 } } },
      { $project: { _id: 0, date: '$_id', views: 1 } },
      { $sort: { date: 1 } },
    ]);

    const total = await ProductView.countDocuments({ product: productId, createdAt: { $gte: start, $lte: end } });
    return res.status(200).json({ success: true, range: { start, end, interval: unit }, total, series });
  } catch (e) {
    console.error('getProductSeries error', e);
    return res.status(500).json({ success: false, message: 'Failed to get product series' });
  }
};

module.exports = { recordVisit, recordProductView, getSummary, getProductSeries };
