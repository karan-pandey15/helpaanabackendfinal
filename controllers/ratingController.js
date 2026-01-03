const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Partner = require('../models/Partner');
const OrderRating = require('../models/OrderRating');
const RiderRating = require('../models/RiderRating');

// Helper to resolve order by orderId or _id
const resolveOrderByParam = async (orderIdOrDbId) => {
  if (!orderIdOrDbId) return null;
  if (mongoose.Types.ObjectId.isValid(orderIdOrDbId)) {
    const order = await Order.findById(orderIdOrDbId);
    if (order) return order;
  }
  return Order.findOne({ orderId: orderIdOrDbId });
};

// Helper to get rider from order
const getRiderFromOrder = (order) => {
  if (!order || !order.statusHistory) return null;
  // Find the latest statusHistory entry with a partner
  const historyWithPartner = order.statusHistory.filter(h => h.updatedBy && h.updatedBy.partner).reverse();
  return historyWithPartner.length > 0 ? historyWithPartner[0].updatedBy.partner : null;
};

// POST /orders/:orderId/rate
const rateOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { orderId } = req.params;
    const { order_rating, rider_rating } = req.body;

    // Validate request body
    if (!order_rating || typeof order_rating.rating !== 'number' || order_rating.rating < 1 || order_rating.rating > 5) {
      return res.status(400).json({ ok: false, message: 'Invalid order rating. Must be between 1 and 5.' });
    }
    if (!rider_rating || typeof rider_rating.rating !== 'number' || rider_rating.rating < 1 || rider_rating.rating > 5) {
      return res.status(400).json({ ok: false, message: 'Invalid rider rating. Must be between 1 and 5.' });
    }

    // Find order
    const order = await resolveOrderByParam(orderId);
    if (!order) {
      return res.status(404).json({ ok: false, message: 'Order not found' });
    }

    // Check if order belongs to user
    if (order.user.toString() !== userId) {
      return res.status(403).json({ ok: false, message: 'You can only rate your own orders' });
    }

    // Check if order is delivered
    if (order.status !== 'Delivered') {
      return res.status(400).json({ ok: false, message: 'You can only rate delivered orders' });
    }

    // Check if user already rated this order
    const existingOrderRating = await OrderRating.findOne({ order: order._id, user: userId });
    if (existingOrderRating) {
      return res.status(409).json({ ok: false, message: 'You have already rated this order' });
    }

    // Get rider
    const riderId = getRiderFromOrder(order);
    if (!riderId) {
      return res.status(400).json({ ok: false, message: 'No rider found for this order' });
    }

    // Check rider exists
    const rider = await Partner.findById(riderId);
    if (!rider) {
      return res.status(404).json({ ok: false, message: 'Rider not found' });
    }

    // Create ratings
    const newOrderRating = await OrderRating.create({
      order: order._id,
      user: userId,
      rating: order_rating.rating,
      review_text: order_rating.review_text || ''
    });

    const newRiderRating = await RiderRating.create({
      order: order._id,
      rider: riderId,
      user: userId,
      rating: rider_rating.rating,
      review_text: rider_rating.review_text || ''
    });

    // Update rider average rating
    const riderRatings = await RiderRating.find({ rider: riderId });
    const averageRating = riderRatings.length > 0 ? riderRatings.reduce((sum, r) => sum + r.rating, 0) / riderRatings.length : 0;
    await Partner.findByIdAndUpdate(riderId, { average_rating: Math.round(averageRating * 10) / 10 }); // Round to 1 decimal

    return res.status(201).json({
      ok: true,
      message: 'Ratings submitted successfully',
      order_rating: newOrderRating,
      rider_rating: newRiderRating
    });
  } catch (error) {
    console.error('Rate order error:', error);
    if (error.code === 11000) { // Duplicate key error
      return res.status(409).json({ ok: false, message: 'You have already rated this order' });
    }
    return res.status(500).json({ ok: false, message: 'Failed to submit ratings' });
  }
};

// GET /ratings (admin only)
const getAllRatings = async (req, res) => {
  try {
    const orderRatings = await OrderRating.find()
      .populate('order', 'orderId status')
      .populate('user', 'name phone')
      .sort({ createdAt: -1 });

    const riderRatings = await RiderRating.find()
      .populate('order', 'orderId status')
      .populate('rider', 'full_name phone_number average_rating')
      .populate('user', 'name phone')
      .sort({ createdAt: -1 });

    return res.json({
      ok: true,
      order_ratings: orderRatings,
      rider_ratings: riderRatings
    });
  } catch (error) {
    console.error('Get all ratings error:', error);
    return res.status(500).json({ ok: false, message: 'Failed to fetch ratings' });
  }
};

// GET /users/:userId/ratings
const getUserRatings = async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.userId;

    // Users can only see their own ratings
    if (userId !== requestingUserId) {
      return res.status(403).json({ ok: false, message: 'You can only view your own ratings' });
    }

    const orderRatings = await OrderRating.find({ user: userId })
      .populate('order', 'orderId status createdAt')
      .sort({ createdAt: -1 });

    const riderRatings = await RiderRating.find({ user: userId })
      .populate('order', 'orderId status createdAt')
      .populate('rider', 'full_name phone_number average_rating')
      .sort({ createdAt: -1 });

    return res.json({
      ok: true,
      order_ratings: orderRatings,
      rider_ratings: riderRatings
    });
  } catch (error) {
    console.error('Get user ratings error:', error);
    return res.status(500).json({ ok: false, message: 'Failed to fetch ratings' });
  }
};

// GET /orders/:orderId/rating-status (for user to check if they can rate)
const getOrderRatingStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    const order = await resolveOrderByParam(orderId);
    if (!order) {
      return res.status(404).json({ ok: false, message: 'Order not found' });
    }

    if (order.user.toString() !== userId) {
      return res.status(403).json({ ok: false, message: 'You can only check rating status for your own orders' });
    }

    const canRate = order.status === 'Delivered';
    const hasRated = await OrderRating.findOne({ order: order._id, user: userId }).select('_id');

    // If rated, include the ratings
    let ratings = null;
    if (hasRated) {
      const orderRating = await OrderRating.findOne({ order: order._id, user: userId });
      const riderRating = await RiderRating.findOne({ order: order._id, user: userId }).populate('rider', 'full_name');
      ratings = {
        order_rating: orderRating,
        rider_rating: riderRating
      };
    }

    return res.json({
      ok: true,
      orderId: order.orderId,
      status: order.status,
      can_rate: canRate,
      has_rated: !!hasRated,
      ratings
    });
  } catch (error) {
    console.error('Get order rating status error:', error);
    return res.status(500).json({ ok: false, message: 'Failed to check rating status' });
  }
};

// GET /partners/:partnerId/ratings (for riders to view their ratings)
const getRiderRatings = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const requestingPartnerId = req.partner.partnerId;

    // Riders can only see their own ratings
    if (partnerId !== requestingPartnerId) {
      return res.status(403).json({ ok: false, message: 'You can only view your own ratings' });
    }

    const riderRatings = await RiderRating.find({ rider: partnerId })
      .populate('order', 'orderId status createdAt')
      .populate('user', 'name phone')
      .sort({ createdAt: -1 });

    return res.json({
      ok: true,
      rider_ratings: riderRatings
    });
  } catch (error) {
    console.error('Get rider ratings error:', error);
    return res.status(500).json({ ok: false, message: 'Failed to fetch ratings' });
  }
};

module.exports = {
  rateOrder,
  getAllRatings,
  getUserRatings,
  getRiderRatings,
  getOrderRatingStatus
};