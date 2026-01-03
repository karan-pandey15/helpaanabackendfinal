const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const upload = require('../middlewares/upload');

// --- ADMIN ROUTES ---
// Create a new service (with images)
router.post('/admin/services', upload.array('images', 5), serviceController.createService);

// Update a service (with images)
router.patch('/admin/services/:id', upload.array('images', 5), serviceController.updateService);

// Delete a service
router.delete('/admin/services/:id', serviceController.deleteService);

// --- USER/COMMON ROUTES ---
// Get all services
router.get('/services', serviceController.getAllServices);

// Get services by category
router.get('/services/category/:category', serviceController.getServicesByCategory);

// Get single service by ID
router.get('/services/:id', serviceController.getServiceById);

module.exports = router;
