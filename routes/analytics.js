const express = require('express');
const router = express.Router();
const { isAuthorized, isAdmin } = require('../middlewares/auth');
const {
  dashboardAnalytics,
  ordersAnalytics,
  orderStatusSummary,
  usersAnalytics,
  lowStock,
} = require('../controllers/analytics');


// Dashboard bundle
router.get('/dashboard',isAuthorized, isAdmin, dashboardAnalytics);

// Orders analytics
router.get('/orders',isAuthorized, isAdmin, ordersAnalytics);
router.get('/orders/status-summary',isAuthorized, isAdmin, orderStatusSummary);

// Users analytics
router.get('/users',isAuthorized, isAdmin, usersAnalytics);

// Inventory analytics
router.get('/inventory/low-stock',isAuthorized, isAdmin, lowStock);

module.exports = router;
