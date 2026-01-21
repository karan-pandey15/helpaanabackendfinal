const express = require('express');
const router = express.Router();
const servicePartnerController = require('../controllers/servicePartnerController');
const upload = require('../middlewares/upload');
const servicePartnerAuth = require('../middlewares/servicePartnerAuth');

router.post('/register', upload.fields([
  { name: 'addharFrontImage', maxCount: 1 },
  { name: 'addharBackImage', maxCount: 1 },
  { name: 'panImage', maxCount: 1 },
  { name: 'degreeImage', maxCount: 1 }
]), servicePartnerController.register);

router.post('/login', servicePartnerController.login);

router.get('/orders', servicePartnerAuth, servicePartnerController.getOrders);
router.get('/order-stats', servicePartnerAuth, servicePartnerController.getOrderStats);
router.get('/payments', servicePartnerAuth, servicePartnerController.getPayments);
router.patch('/orders/:orderId/status', servicePartnerAuth, servicePartnerController.updateOrderStatus);

module.exports = router;
