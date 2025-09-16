const express = require('express');
const router = express.Router();
const { isAuthorized, isAdmin } = require('../middlewares/auth');
const { validateCoupon, listCoupons, createCoupon, updateCoupon, toggleCouponActive, deleteCoupon } = require('../controllers/coupon');

// Public: validate coupon
router.post('/validate', validateCoupon);

// Admin: coupon CRUD
router.get('/admin', isAuthorized, isAdmin, listCoupons);
router.post('/admin', isAuthorized, isAdmin, createCoupon);
router.patch('/admin/:id', isAuthorized, isAdmin, updateCoupon);
router.patch('/admin/:id/toggle', isAuthorized, isAdmin, toggleCouponActive);
router.delete('/admin/:id', isAuthorized, isAdmin, deleteCoupon);

module.exports = router;
