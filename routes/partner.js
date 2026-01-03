const express = require('express');
const router = express.Router();
const partnerAuth = require('../middlewares/partnerAuth');
const {
  sendOtp,
  verifyOtp,
  createPartner,
  phoneSignin,
  getPartnerProfile,
  updatePartner,
  deletePartner,
  listPartners
} = require('../controllers/partnerController');

// Partner onboarding
router.post('/signup', createPartner);

router.get('/', listPartners);
router.put('/:id', updatePartner);
router.patch('/:id', updatePartner);
router.delete('/:id', deletePartner);

// Partner authentication
router.post('/login/send-otp', sendOtp); 
router.post('/login/verify-otp', verifyOtp);
router.post('/signin/phone', phoneSignin);

// Partner profile (requires token)
router.get('/profile/me', partnerAuth, getPartnerProfile);

module.exports = router;