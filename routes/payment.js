const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { createPaymentOrder, verifyPayment } = require('../controllers/paymentController');

router.post('/create', auth, createPaymentOrder);
router.post('/verify', auth, verifyPayment);

module.exports = router;