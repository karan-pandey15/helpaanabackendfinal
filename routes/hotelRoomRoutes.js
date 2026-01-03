const express = require('express');
const router = express.Router();
const hotelRoomController = require('../controllers/hotelRoomController');
const upload = require('../middlewares/upload');

// --- ADMIN ROUTES ---
router.post('/admin/hotels', upload.array('images', 5), hotelRoomController.createHotelRoom);
router.patch('/admin/hotels/:id', upload.array('images', 5), hotelRoomController.updateHotelRoom);
router.delete('/admin/hotels/:id', hotelRoomController.deleteHotelRoom);

// --- USER ROUTES ---
router.get('/hotels', hotelRoomController.getAllHotelRooms);
router.get('/hotels/category/:category', hotelRoomController.getHotelRoomsByCategory);
router.get('/hotels/:id', hotelRoomController.getHotelRoomById);

module.exports = router;
