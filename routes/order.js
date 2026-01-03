const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { createOrder, getOrders, updateOrderStatus } = require('../controllers/orderController');

router.post('/', auth, createOrder);
router.get('/', auth, getOrders);
router.patch('/:orderId/status', auth, updateOrderStatus);

module.exports = router;