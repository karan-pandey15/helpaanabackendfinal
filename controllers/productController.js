const { randomUUID } = require('crypto');
const Product = require('../models/Product');
const cloudinary = require('../config/cloudinary');

function uploadBufferToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'products' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseNumberField(fieldName, ...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
      throw createHttpError(400, `Invalid number for ${fieldName}`);
    }
    return numberValue;
  }
  return undefined;
}

function parseBooleanField(fieldName, ...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    }
    throw createHttpError(400, `Invalid boolean for ${fieldName}`);
  }
  return undefined;
}

function normalizeTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map(v => (v === undefined || v === null ? '' : String(v).trim()))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);
  }
  return [];
}

function ensureRequiredString(fieldName, value) {
  if (value === undefined || value === null) {
    throw createHttpError(400, `${fieldName} is required`);
  }
  const stringValue = typeof value === 'string' ? value : String(value);
  const trimmed = stringValue.trim();
  if (!trimmed) {
    throw createHttpError(400, `${fieldName} is required`);
  }
  return trimmed;
}

async function resolveProductId(candidate) {
  if (candidate && candidate.trim()) {
    const exists = await Product.exists({ id: candidate });
    if (!exists) return candidate;
  }
  let generated;
  do {
    generated = randomUUID();
  } while (await Product.exists({ id: generated }));
  return generated;
}

exports.createProduct = async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length > 5) {
      throw createHttpError(400, 'Max 5 images allowed');
    }

    const { body } = req; 
    const uploads = [];
    for (const file of files) {
      const result = await uploadBufferToCloudinary(file.buffer, file.originalname);
      uploads.push({ url: result.secure_url, public_id: result.public_id });
    }

    const resolvedId = await resolveProductId(body.id || '');

    const nutritionalInfo = {};
    if (body['nutritional_info.calories']) {
      nutritionalInfo.calories = parseNumberField('nutritional_info.calories', body['nutritional_info.calories']);
    }
    if (body['nutritional_info.protein']) {
      nutritionalInfo.protein = body['nutritional_info.protein'];
    }
    if (body['nutritional_info.fat']) {
      nutritionalInfo.fat = body['nutritional_info.fat'];
    }
    if (body['nutritional_info.carbohydrates']) {
      nutritionalInfo.carbohydrates = body['nutritional_info.carbohydrates'];
    }
    if (body['nutritional_info.fiber']) {
      nutritionalInfo.fiber = body['nutritional_info.fiber'];
    }
    if (body['nutritional_info.other_details']) {
      nutritionalInfo.other_details = body['nutritional_info.other_details'];
    }

    const productData = {
      id: resolvedId,
      name: ensureRequiredString('name', body.name),
      description: ensureRequiredString('description', body.description),
      category: ensureRequiredString('category', body.category),
      sub_category: body.sub_category || undefined,
      brand: body.brand || undefined,
      images: uploads,
      price: {
        mrp: parseNumberField('price.mrp', body['price.mrp']),
        selling_price: parseNumberField('price.selling_price', body['price.selling_price']),
        discount_percent: parseNumberField('price.discount_percent', body['price.discount_percent']) ?? 0,
      },
      quantity_info: {
        unit: ensureRequiredString('quantity_info.unit', body['quantity_info.unit']),
        size: parseNumberField('quantity_info.size', body['quantity_info.size']),
      },
      inventory: {
        stock_available: parseBooleanField('inventory.stock_available', body['inventory.stock_available']),
        stock_quantity: parseNumberField('inventory.stock_quantity', body['inventory.stock_quantity']),
      },
      tags: normalizeTags(body.tags),
      vendor: {
        vendor_id: ensureRequiredString('vendor.vendor_id', body['vendor.vendor_id']),
        vendor_name: ensureRequiredString('vendor.vendor_name', body['vendor.vendor_name']),
      },
      status: body.status || 'active',
      shelf_life: body.shelf_life || undefined,
      last_updated: new Date(),
    };

    if (Object.keys(nutritionalInfo).length > 0) {
      productData.nutritional_info = nutritionalInfo;
    }

    if (productData.price.mrp === undefined) {
      throw createHttpError(400, 'price.mrp is required');
    }

    if (productData.price.selling_price === undefined) {
      throw createHttpError(400, 'price.selling_price is required');
    }

    if (productData.quantity_info.unit === undefined) {
      throw createHttpError(400, 'quantity_info.unit is required');
    }

    if (productData.quantity_info.size === undefined) {
      throw createHttpError(400, 'quantity_info.size is required');
    }

    if (productData.inventory.stock_available === undefined) {
      throw createHttpError(400, 'inventory.stock_available is required');
    }

    if (productData.inventory.stock_quantity === undefined) {
      throw createHttpError(400, 'inventory.stock_quantity is required');
    }

    const product = await Product.create(productData);

    return res.status(201).json({ ok: true, product });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return res.status(status).json({ ok: false, message: err.message || 'Server error' });
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ date_added: -1 });
    res.json({ ok: true, products });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ ok: false, message: 'Not found' });
    res.json({ ok: true, product });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};
 

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ ok: false, message: 'Not found' });

    const files = req.files || [];
    if (files.length > 0) {
      if (product.images.length + files.length > 5)
        return res.status(400).json({ ok: false, message: 'Max 5 images allowed total' });
      for (const file of files) {
        const result = await uploadBufferToCloudinary(file.buffer, file.originalname);
        product.images.push({ url: result.secure_url, public_id: result.public_id });
      }
    }

    const { body } = req;

    if (body.name) product.name = body.name;
    if (body.description) product.description = body.description;
    if (body.category) product.category = body.category;
    if (body.sub_category) product.sub_category = body.sub_category;
    if (body.brand) product.brand = body.brand;
    if (body['price.mrp']) product.price.mrp = Number(body['price.mrp']);
    if (body['price.selling_price']) product.price.selling_price = Number(body['price.selling_price']);
    if (body['price.discount_percent']) product.price.discount_percent = Number(body['price.discount_percent']);
    if (body['quantity_info.unit']) product.quantity_info.unit = body['quantity_info.unit'];
    if (body['quantity_info.size']) product.quantity_info.size = Number(body['quantity_info.size']);
    if (body['inventory.stock_available']) product.inventory.stock_available = parseBooleanField('inventory.stock_available', body['inventory.stock_available']);
    if (body['inventory.stock_quantity']) product.inventory.stock_quantity = Number(body['inventory.stock_quantity']);
    if (body.tags) product.tags = normalizeTags(body.tags);
    if (body.status) product.status = body.status;
    if (body.shelf_life) product.shelf_life = body.shelf_life;
    
    if (body['vendor.vendor_id']) product.vendor.vendor_id = body['vendor.vendor_id'];
    if (body['vendor.vendor_name']) product.vendor.vendor_name = body['vendor.vendor_name'];

    if (body['nutritional_info.calories'] || body['nutritional_info.protein'] || body['nutritional_info.fat'] || body['nutritional_info.carbohydrates'] || body['nutritional_info.fiber'] || body['nutritional_info.other_details']) {
      if (!product.nutritional_info) product.nutritional_info = {};
      if (body['nutritional_info.calories']) product.nutritional_info.calories = parseNumberField('nutritional_info.calories', body['nutritional_info.calories']);
      if (body['nutritional_info.protein']) product.nutritional_info.protein = body['nutritional_info.protein'];
      if (body['nutritional_info.fat']) product.nutritional_info.fat = body['nutritional_info.fat'];
      if (body['nutritional_info.carbohydrates']) product.nutritional_info.carbohydrates = body['nutritional_info.carbohydrates'];
      if (body['nutritional_info.fiber']) product.nutritional_info.fiber = body['nutritional_info.fiber'];
      if (body['nutritional_info.other_details']) product.nutritional_info.other_details = body['nutritional_info.other_details'];
    }

    product.last_updated = new Date();

    await product.save();
    res.json({ ok: true, product });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({ ok: false, message: err.message || 'Server error' });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ ok: false, message: 'Not found' });

    for (const img of product.images) {
      try {
        if (img.public_id) await cloudinary.uploader.destroy(img.public_id);
      } catch (e) {
        console.warn('Failed to delete image:', img.public_id, e.message);
      }
    }

    await Product.findByIdAndDelete(product._id);
    res.json({ ok: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const category = req.params.category;
    if (!category || category.trim() === '') {
      return res.status(400).json({ ok: false, message: 'Category is required' });
    }
    
    const products = await Product.find({ category: { $regex: category, $options: 'i' }, status: 'active' }).sort({ date_added: -1 });
    
    if (products.length === 0) {
      return res.status(404).json({ ok: false, message: 'No products found for this category' });
    }
    
    res.json({ ok: true, products, count: products.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};
