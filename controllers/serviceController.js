const Service = require('../models/ServiceModels');
const cloudinary = require('../config/cloudinary');

// Helper to upload buffer to Cloudinary
function uploadBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'services' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

// Create a new service (Admin)
exports.createService = async (req, res) => {
  try {
    const { name, price, description, time, date, category, hour, suggestion } = req.body;
    const files = req.files || [];

    if (!name || !price || !description || !time || !date || !category || !hour) {
      return res.status(400).json({ ok: false, message: 'All fields are required' });
    }

    const uploads = [];
    for (const file of files) {
      const result = await uploadBufferToCloudinary(file.buffer);
      uploads.push({ url: result.secure_url, public_id: result.public_id });
    }

    const service = await Service.create({
      name,
      price: Number(price),
      description,
      time,
      date,
      category,
      hour,
      suggestion,
      images: uploads
    });

    res.status(201).json({ ok: true, message: 'Service created successfully', service });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// Get all services (Admin/User)
exports.getAllServices = async (req, res) => {
  try {
    const services = await Service.find().sort({ date_added: -1 });
    res.json({ ok: true, services });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// Get single service by ID
exports.getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ ok: false, message: 'Service not found' });
    res.json({ ok: true, service });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// Get services by category (User)
exports.getServicesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const services = await Service.find({ category: { $regex: category, $options: 'i' } });
    res.json({ ok: true, services });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// Update service (Admin)
exports.updateService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ ok: false, message: 'Service not found' });

    const files = req.files || [];
    if (files.length > 0) {
      // Upload new images
      for (const file of files) {
        const result = await uploadBufferToCloudinary(file.buffer);
        service.images.push({ url: result.secure_url, public_id: result.public_id });
      }
    }

    // Update other fields
    const fieldsToUpdate = ['name', 'price', 'description', 'time', 'date', 'category', 'hour', 'suggestion'];
    fieldsToUpdate.forEach(field => {
      if (req.body[field] !== undefined) {
        service[field] = field === 'price' ? Number(req.body[field]) : req.body[field];
      }
    });

    await service.save();
    res.json({ ok: true, message: 'Service updated successfully', service });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

// Delete service (Admin)
exports.deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ ok: false, message: 'Service not found' });

    // Delete images from Cloudinary
    for (const img of service.images) {
      if (img.public_id) {
        try {
          await cloudinary.uploader.destroy(img.public_id);
        } catch (e) {
          console.error('Failed to delete image from Cloudinary:', e.message);
        }
      }
    }

    await Service.findByIdAndDelete(req.params.id);
    res.json({ ok: true, message: 'Service deleted successfully' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};
