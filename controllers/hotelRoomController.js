const HotelRoom = require('../models/HotelRoom');
const cloudinary = require('../config/cloudinary');

// Helper to upload buffer to Cloudinary
function uploadBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'hotels' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

// --- ADMIN CONTROLLERS ---

// Create Hotel Room
exports.createHotelRoom = async (req, res) => {
  try {
    const { 
      name, description, pricePerNight, category, 
      propertyArea, address, city, state, country, pincode,
      amenities, phone, email, hotelCareName, maxGuests, rating 
    } = req.body;
    const files = req.files || [];

    const uploads = [];
    for (const file of files) {
      const result = await uploadBufferToCloudinary(file.buffer);
      uploads.push({ url: result.secure_url, public_id: result.public_id });
    }

    const hotelRoom = await HotelRoom.create({
      name,
      description,
      pricePerNight: Number(pricePerNight),
      category,
      propertyArea,
      address,
      city,
      state,
      country,
      pincode,
      phone,
      email,
      hotelCareName,
      maxGuests: Number(maxGuests),
      rating: Number(rating || 0),
      amenities: Array.isArray(amenities) ? amenities : (amenities ? amenities.split(',') : []),
      images: uploads
    });

    res.status(201).json({ ok: true, message: 'Hotel room created successfully', hotelRoom });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// Update Hotel Room
exports.updateHotelRoom = async (req, res) => {
  try {
    const hotelRoom = await HotelRoom.findById(req.params.id);
    if (!hotelRoom) return res.status(404).json({ ok: false, message: 'Hotel room not found' });

    const files = req.files || [];
    if (files.length > 0) {
      for (const file of files) {
        const result = await uploadBufferToCloudinary(file.buffer);
        hotelRoom.images.push({ url: result.secure_url, public_id: result.public_id });
      }
    }

    const updateFields = [
      'name', 'description', 'pricePerNight', 'category', 
      'propertyArea', 'address', 'city', 'state', 'country', 'pincode',
      'phone', 'email', 'hotelCareName', 'maxGuests', 'status', 'rating'
    ];
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        hotelRoom[field] = (field === 'pricePerNight' || field === 'maxGuests' || field === 'rating') ? Number(req.body[field]) : req.body[field];
      }
    });

    if (req.body.amenities) {
      hotelRoom.amenities = Array.isArray(req.body.amenities) ? req.body.amenities : req.body.amenities.split(',');
    }

    await hotelRoom.save();
    res.json({ ok: true, message: 'Hotel room updated successfully', hotelRoom });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// Delete Hotel Room
exports.deleteHotelRoom = async (req, res) => {
  try {
    const hotelRoom = await HotelRoom.findById(req.params.id);
    if (!hotelRoom) return res.status(404).json({ ok: false, message: 'Hotel room not found' });

    for (const img of hotelRoom.images) {
      if (img.public_id) {
        try {
          await cloudinary.uploader.destroy(img.public_id);
        } catch (e) {
          console.error('Failed to delete hotel image:', e.message);
        }
      }
    }

    await HotelRoom.findByIdAndDelete(req.params.id);
    res.json({ ok: true, message: 'Hotel room deleted successfully' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// --- USER CONTROLLERS ---

// Get all Hotel Rooms
exports.getAllHotelRooms = async (req, res) => {
  try {
    const hotelRooms = await HotelRoom.find().sort({ date_added: -1 });
    res.json({ ok: true, hotelRooms });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// Get Hotel Rooms by Category
exports.getHotelRoomsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const hotelRooms = await HotelRoom.find({ category }).sort({ date_added: -1 });
    res.json({ ok: true, hotelRooms });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// Get Single Hotel Room
exports.getHotelRoomById = async (req, res) => {
  try {
    const hotelRoom = await HotelRoom.findById(req.params.id);
    if (!hotelRoom) return res.status(404).json({ ok: false, message: 'Hotel room not found' });
    res.json({ ok: true, hotelRoom });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};
