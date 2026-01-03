const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const Order = require('../models/Order');

// Check eligible coupon for user
const getEligibleCoupon = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Check if user has any orders
    const existingOrders = await Order.find({ user: userId }).limit(1);

    if (existingOrders.length > 0) {
      return res.json({ ok: true, eligibleCoupon: null });
    }

    // Check if user already has FIRST20 coupon
    const existingCoupon = await Coupon.findOne({
      userId,
      code: 'FIRST20',
      isUsed: false,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    if (existingCoupon) {
      return res.json({ ok: true, eligibleCoupon: 'FIRST20' });
    }

    // Create new FIRST20 coupon
    const coupon = await Coupon.create({
      code: 'FIRST20',
      type: 'FIXED',
      value: 20,
      userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });

    return res.json({ ok: true, eligibleCoupon: 'FIRST20' });
  } catch (err) {
    console.error('Error getting eligible coupon:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// Apply coupon
const applyCoupon = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ ok: false, message: 'Coupon code is required' });
    }

    const couponCode = code.toUpperCase();

    // Find coupon
    const coupon = await Coupon.findOne({
      code: couponCode,
      userId,
      isUsed: false,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    if (!coupon) {
      return res.status(400).json({ ok: false, message: 'Invalid or expired coupon' });
    }

    // For FIRST20, ensure user still has no orders
    if (couponCode === 'FIRST20') {
      const existingOrders = await Order.find({ user: userId }).limit(1);

      if (existingOrders.length > 0) {
        return res.status(400).json({ ok: false, message: 'Coupon no longer valid' });
      }
    }

    return res.json({
      ok: true,
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value
      }
    });
  } catch (err) {
    console.error('Error applying coupon:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// Mark coupon as used
const markCouponUsed = async (userId, code) => {
  try {
    await Coupon.findOneAndUpdate(
      { userId, code, isUsed: false },
      { isUsed: true, usedAt: new Date() }
    );
  } catch (err) {
    console.error('Error marking coupon used:', err);
  }
};

module.exports = {
  getEligibleCoupon,
  applyCoupon,
  markCouponUsed
};