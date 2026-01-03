const express = require('express');
const router = express.Router();
const partnerAuth = require('../middlewares/partnerAuth');
const { getOrders, updateOrderStatus, updatePaymentStatus } = require('../controllers/partnerOrderController');

router.get('/', partnerAuth, getOrders);
router.patch('/:orderId/status', partnerAuth, updateOrderStatus);
router.post('/:orderId/status', partnerAuth, updateOrderStatus);
router.patch('/:orderId/payment-status', partnerAuth, updatePaymentStatus);

module.exports = router;