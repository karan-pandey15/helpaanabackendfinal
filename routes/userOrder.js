const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { getOrders, cancelOrder } = require('../controllers/userOrderController');

router.get('/', auth, getOrders);
router.post('/:orderId/cancel', auth, cancelOrder);
router.delete('/:orderId', auth, cancelOrder);

module.exports = router;