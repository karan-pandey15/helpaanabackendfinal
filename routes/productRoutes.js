const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../middlewares/upload');

// CRUD actions - Create Product
router.post('/products', upload.array('images', 5), productController.createProduct);

// Update Product
router.post('/products/edit/:id', upload.array('images', 5), productController.updateProduct);

// Delete Product
router.post('/products/delete/:id', productController.deleteProduct);

// JSON API Routes
// Get all products
router.get('/products', productController.getAllProducts);

// Get products by category (MUST be before :id route to avoid conflicts)
router.get('/products/category/:category', productController.getProductsByCategory);

// Get single product by ID
router.get('/products/:id', productController.getProductById);

module.exports = router;
