const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');
const partnerAuth = require('../middlewares/partnerAuth');
const {
  rateOrder,
  getAllRatings,
  getUserRatings,
  getRiderRatings,
  getOrderRatingStatus
} = require('../controllers/ratingController');

// POST /:orderId/rate - Rate an order and its rider
router.post('/:orderId/rate', auth, rateOrder);

// GET /:orderId/rating-status - User: Check if they can rate an order
router.get('/:orderId/rating-status', auth, getOrderRatingStatus);

// GET /ratings - Admin: Get all ratings
router.get('/ratings', adminAuth, getAllRatings);

// GET /users/:userId/ratings - User: Get their own ratings
router.get('/users/:userId/ratings', auth, getUserRatings);

// GET /partners/:partnerId/ratings - Rider: Get their own ratings
router.get('/partners/:partnerId/ratings', partnerAuth, getRiderRatings);

module.exports = router;