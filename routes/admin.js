const express = require('express');
const router = express.Router(); 
const {
  getAllUsers,
  getAllOrders,
  getAllPartners,
  getAllUserOrders,
  getAllPayments,
  getAllCoupons
} = require('../controllers/adminController');
const partnerAuth = require('../middlewares/partnerAuth');

// All admin routes require admin authentication
router.use(partnerAuth);

// Admin endpoints
router.get('/users', getAllUsers);
router.get('/orders', getAllOrders);
router.get('/partners', getAllPartners);
router.get('/user-orders', getAllUserOrders);
router.get('/payments', getAllPayments);
router.get('/coupons', getAllCoupons);
module.exports = router;