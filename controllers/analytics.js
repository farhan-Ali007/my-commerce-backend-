const Order = require('../models/order');
const User = require('../models/user');
const Product = require('../models/product');

// Helpers
const parseDate = (value, fallback) => {
  const d = value ? new Date(value) : null;
  return isNaN(d?.getTime()) ? fallback : d;
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const getRange = (from, to, defaultDays = 30) => {
  const now = new Date();
  const defFrom = new Date(now);
  defFrom.setDate(defFrom.getDate() - defaultDays + 1);
  const start = startOfDay(parseDate(from, defFrom));
  const end = endOfDay(parseDate(to, now));
  return { start, end };
};

const toIntervalUnit = (interval) => {
  // MongoDB $dateTrunc supported units: 'day' | 'week' | 'month'
  return ['day', 'week', 'month'].includes(interval) ? interval : 'day';
};

// Aggregate orders into a time series
const buildOrdersTimeSeries = async ({ from, to, interval = 'day' }) => {
  const { start, end } = getRange(from, to, 30);
  const unit = toIntervalUnit(interval);

  const data = await Order.aggregate([
    { $match: { orderedAt: { $gte: start, $lte: end } } },
    { $addFields: { dateKey: { $dateTrunc: { date: '$orderedAt', unit } } } },
    { $unwind: '$cartSummary' },
    {
      $group: {
        _id: { dateKey: '$dateKey', orderId: '$_id' },
        itemsSold: { $sum: '$cartSummary.count' },
        totalPrice: { $first: '$totalPrice' },
      },
    },
    {
      $group: {
        _id: '$_id.dateKey',
        orders: { $sum: 1 },
        revenue: { $sum: '$totalPrice' },
        itemsSold: { $sum: '$itemsSold' },
      },
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        orders: 1,
        revenue: 1,
        itemsSold: 1,
        avgOrderValue: {
          $cond: [{ $eq: ['$orders', 0] }, 0, { $divide: ['$revenue', '$orders'] }],
        },
      },
    },
    { $sort: { date: 1 } },
  ]);

  return { start, end, interval: unit, data };
};

// KPIs for a given range
const kpiForRange = async ({ start, end }) => {
  const agg = await Order.aggregate([
    { $match: { orderedAt: { $gte: start, $lte: end } } },
    { $unwind: '$cartSummary' },
    {
      $group: {
        _id: '$_id',
        itemsSold: { $sum: '$cartSummary.count' },
        totalPrice: { $first: '$totalPrice' },
      },
    },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        revenue: { $sum: '$totalPrice' },
        itemsSold: { $sum: '$itemsSold' },
      },
    },
  ]);

  const res = agg[0] || { orders: 0, revenue: 0, itemsSold: 0 };
  return { ...res, avgOrderValue: res.orders ? res.revenue / res.orders : 0 };
};

// KPIs for all time (no date filter)
const kpiAllTime = async () => {
  const agg = await Order.aggregate([
    { $unwind: '$cartSummary' },
    {
      $group: {
        _id: '$_id',
        itemsSold: { $sum: '$cartSummary.count' },
        totalPrice: { $first: '$totalPrice' },
      },
    },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        revenue: { $sum: '$totalPrice' },
        itemsSold: { $sum: '$itemsSold' },
      },
    },
  ]);

  const res = agg[0] || { orders: 0, revenue: 0, itemsSold: 0 };
  return { ...res, avgOrderValue: res.orders ? res.revenue / res.orders : 0 };
};

// GET /analytics/dashboard
const dashboardAnalytics = async (req, res) => {
  try {
    // Time windows
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const last7Start = new Date(now);
    last7Start.setDate(last7Start.getDate() - 6);

    const last30Start = new Date(now);
    last30Start.setDate(last30Start.getDate() - 29);

    const [today, last7, last30, statusSummary, timeSeries, topProducts, lowStockCount, allTime] = await Promise.all([
      kpiForRange({ start: todayStart, end: todayEnd }),
      kpiForRange({ start: startOfDay(last7Start), end: todayEnd }),
      kpiForRange({ start: startOfDay(last30Start), end: todayEnd }),
      Order.aggregate([
        { $match: { orderedAt: { $gte: startOfDay(last30Start), $lte: todayEnd } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]),
      buildOrdersTimeSeries({ from: last30Start, to: todayEnd, interval: 'day' }),
      Product.find({}).select('title sold stock').sort({ sold: -1 }).limit(5).lean(),
      Product.countDocuments({ stock: { $lt: 10 } }),
      kpiAllTime(),
    ]);

    return res.status(200).json({
      success: true,
      kpis: { today, last7, last30, allTime },
      statusSummary,
      timeSeries: timeSeries.data,
      topProducts,
      lowStockCount,
      range: { start: timeSeries.start, end: timeSeries.end },
    });
  } catch (error) {
    console.error('Error in dashboard analytics:', error);
    return res.status(500).json({ message: 'Failed to get dashboard analytics' });
  }
};

// GET /analytics/orders?from&to&interval=day|week|month
const ordersAnalytics = async (req, res) => {
  try {
    const { from, to, interval = 'day' } = req.query;
    const series = await buildOrdersTimeSeries({ from, to, interval });
    return res.status(200).json({ success: true, ...series });
  } catch (error) {
    console.error('Error in orders analytics:', error);
    return res.status(500).json({ message: 'Failed to get orders analytics' });
  }
};

// GET /analytics/orders/status-summary?from&to
const orderStatusSummary = async (req, res) => {
  try {
    const { from, to } = req.query;
    const { start, end } = getRange(from, to, 30);
    const summary = await Order.aggregate([
      { $match: { orderedAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
      { $sort: { status: 1 } },
    ]);
    return res.status(200).json({ success: true, start, end, summary });
  } catch (error) {
    console.error('Error in order status summary:', error);
    return res.status(500).json({ message: 'Failed to get status summary' });
  }
};

// GET /analytics/users?from&to&interval
const usersAnalytics = async (req, res) => {
  try {
    const { from, to, interval = 'day' } = req.query;
    const { start, end } = getRange(from, to, 30);
    const unit = toIntervalUnit(interval);

    const data = await User.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $addFields: { dateKey: { $dateTrunc: { date: '$createdAt', unit } } } },
      { $group: { _id: '$dateKey', users: { $sum: 1 } } },
      { $project: { _id: 0, date: '$_id', users: 1 } },
      { $sort: { date: 1 } },
    ]);

    return res.status(200).json({ success: true, start, end, interval: unit, data });
  } catch (error) {
    console.error('Error in users analytics:', error);
    return res.status(500).json({ message: 'Failed to get users analytics' });
  }
};

// GET /analytics/inventory/low-stock?lt=10&limit=10
const lowStock = async (req, res) => {
  try {
    const lt = parseInt(req.query.lt || '10', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    const [count, items] = await Promise.all([
      Product.countDocuments({ stock: { $lt: lt } }),
      Product.find({ stock: { $lt: lt } })
        .select('title stock sold')
        .sort({ stock: 1 })
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({ success: true, threshold: lt, count, items });
  } catch (error) {
    console.error('Error in low stock:', error);
    return res.status(500).json({ message: 'Failed to get low stock' });
  }
};

module.exports = {
  dashboardAnalytics,
  ordersAnalytics,
  orderStatusSummary,
  usersAnalytics,
  lowStock,
};

