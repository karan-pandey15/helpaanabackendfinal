const mongoose = require('mongoose');

const HotelRoomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  pricePerNight: { type: Number, required: true },
  category: { 
    type: String, 
    required: true, 
    enum: ['room', 'villa', 'farm house'] 
  },
  location: { type: String, required: true },
  amenities: [String],
  maxGuests: { type: Number, default: 2 },
  images: [{ url: String, public_id: String }],
  status: { type: String, default: 'available', enum: ['available', 'booked', 'maintenance'] },
  rating: { type: Number, default: 0 },
  date_added: { type: Date, default: Date.now }
});

module.exports = mongoose.model('HotelRoom', HotelRoomSchema);
