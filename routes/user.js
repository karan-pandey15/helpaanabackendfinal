const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const {
  getProfile,
  updateProfile,
  deleteProfile,
  getAddresses,
  reverseGeocodeAddress,
  createAddress,
  updateAddress,
  deleteAddress
} = require('../controllers/userController');

// 👤 Profile routes
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.delete('/profile', auth, deleteProfile);  

// 📍 Address routes
router.get('/addresses/geocode', auth, reverseGeocodeAddress);
router.get('/addresses', auth, getAddresses);
router.post('/addresses', auth, createAddress);
router.put('/addresses/:addressId', auth, updateAddress);
router.patch('/addresses/:addressId', auth, updateAddress);
router.delete('/addresses/:addressId', auth, deleteAddress);   
module.exports = router;
