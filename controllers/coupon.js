const Coupon = require('../models/coupon');
const Order = require('../models/order');

// Validate a coupon against a cart summary
// Expects: { code, cartSummary: [{ price, count }], subtotal }
// Returns: { valid, code, discount, discountType, message, newSubtotal }
exports.validateCoupon = async (req, res) => {
  try {
    const { code, cartSummary = [], subtotal, deliveryCharges = 0, userId, guestId } = req.body || {};
    if (!code) return res.status(400).json({ valid: false, message: 'Coupon code is required' });

    const coupon = await Coupon.findOne({ code: String(code).toUpperCase().trim(), active: true });
    if (!coupon) return res.status(200).json({ valid: false, message: 'Invalid coupon code' });

    const now = new Date();
    if (coupon.startsAt && now < coupon.startsAt) {
      return res.status(200).json({ valid: false, message: 'Coupon not active yet' });
    }
    if (coupon.expiresAt && now > coupon.expiresAt) {
      return res.status(200).json({ valid: false, message: 'Coupon expired' });
    }
    if (coupon.usageLimit && coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return res.status(200).json({ valid: false, message: 'Coupon usage limit reached' });
    }

    // Compute subtotal from cartSummary if not provided
    const computedSubtotal = Array.isArray(cartSummary)
      ? cartSummary.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.count || 0), 0)
      : Number(subtotal || 0);
    if (isNaN(computedSubtotal) || computedSubtotal <= 0) {
      return res.status(200).json({ valid: false, message: 'Cart is empty' });
    }

    if (coupon.minOrder && computedSubtotal < coupon.minOrder) {
      return res.status(200).json({ valid: false, message: `Minimum order Rs.${coupon.minOrder} required` });
    }

    // Enforce per-user limit if provided with identity
    if (coupon.perUserLimit && coupon.perUserLimit > 0 && (userId || guestId)) {
      const userFilter = [];
      if (userId) userFilter.push({ orderedBy: userId });
      if (guestId) userFilter.push({ guestId });
      if (userFilter.length) {
        const usedByUser = await Order.countDocuments({
          couponCode: String(code).toUpperCase().trim(),
          $or: userFilter,
        });
        if (usedByUser >= coupon.perUserLimit) {
          return res.status(200).json({ valid: false, message: 'Per-user coupon limit reached' });
        }
      }
    }

    const delivery = Number(deliveryCharges || 0) || 0;
    const baseAmount = Math.max(0, computedSubtotal + delivery);
    let discount = 0;
    if (coupon.type === 'percent') {
      discount = (baseAmount * coupon.value) / 100;
      if (coupon.maxDiscount && coupon.maxDiscount > 0) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
    } else if (coupon.type === 'fixed') {
      discount = Math.min(coupon.value, baseAmount);
    }

    discount = Math.max(0, Math.round(discount));
    const newTotal = Math.max(0, baseAmount - discount);

    return res.status(200).json({
      valid: true,
      code: coupon.code,
      discount,
      discountType: coupon.type,
      newTotal,
    });
  } catch (err) {
    console.error('validateCoupon error:', err);
    return res.status(500).json({ valid: false, message: 'Failed to validate coupon' });
  }
};

// Admin: list coupons with basic filters and pagination
exports.listCoupons = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const { q, active } = req.query;

    const filter = {};
    if (q) filter.code = { $regex: String(q).trim(), $options: 'i' };
    if (active === 'true') filter.active = true;
    if (active === 'false') filter.active = false;

    const [items, total] = await Promise.all([
      Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Coupon.countDocuments(filter),
    ]);

    return res.status(200).json({ success: true, items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('listCoupons error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list coupons' });
  }
};

// Admin: create coupon
exports.createCoupon = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.code || !payload.type || payload.value == null) {
      return res.status(400).json({ success: false, message: 'code, type, and value are required' });
    }
    payload.code = String(payload.code).toUpperCase().trim();
    const exists = await Coupon.findOne({ code: payload.code });
    if (exists) return res.status(400).json({ success: false, message: 'Coupon code already exists' });

    const doc = new Coupon(payload);
    await doc.save();
    return res.status(201).json({ success: true, coupon: doc });
  } catch (err) {
    console.error('createCoupon error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create coupon' });
  }
};

// Admin: update coupon
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    if (payload.code) payload.code = String(payload.code).toUpperCase().trim();
    const updated = await Coupon.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Coupon not found' });
    return res.status(200).json({ success: true, coupon: updated });
  } catch (err) {
    console.error('updateCoupon error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update coupon' });
  }
};

// Admin: toggle active
exports.toggleCouponActive = async (req, res) => {
  try {
    const { id } = req.params;
    const c = await Coupon.findById(id);
    if (!c) return res.status(404).json({ success: false, message: 'Coupon not found' });
    c.active = !c.active;
    await c.save();
    return res.status(200).json({ success: true, coupon: c });
  } catch (err) {
    console.error('toggleCouponActive error:', err);
    return res.status(500).json({ success: false, message: 'Failed to toggle coupon' });
  }
};

// Admin: delete coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Coupon.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Coupon not found' });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('deleteCoupon error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete coupon' });
  }
};
