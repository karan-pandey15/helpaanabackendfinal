const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { getEligibleCoupon, applyCoupon } = require('../controllers/couponController');

router.get('/eligible', auth, getEligibleCoupon);
router.post('/apply', auth, applyCoupon);

module.exports = router;