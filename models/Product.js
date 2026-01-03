const mongoose = require('mongoose');

const PriceSchema = new mongoose.Schema({
  mrp: { type: Number, required: true },
  selling_price: { type: Number, required: true },
  discount_percent: { type: Number, default: 0 },
});

const QuantitySchema = new mongoose.Schema({
  unit: { type: String, required: true },
  size: { type: Number, required: true },
});

const InventorySchema = new mongoose.Schema({
  stock_available: { type: Boolean, required: true },
  stock_quantity: { type: Number, required: true },
});

const RatingsSchema = new mongoose.Schema({
  average_rating: { type: Number, default: 0 },
  total_ratings: { type: Number, default: 0 },
});

const NutritionalInfoSchema = new mongoose.Schema({
  calories: Number,
  protein: String,
  fat: String,
  carbohydrates: String,
  fiber: String,
  other_details: String,
}, { _id: false });

const ProductSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  sub_category: { type: String },
  brand: { type: String },
  images: [{ url: String, public_id: String }],
  price: { type: PriceSchema, required: true },
  quantity_info: { type: QuantitySchema, required: true },
  inventory: { type: InventorySchema, required: true },
  tags: [String],
  nutritional_info: { type: NutritionalInfoSchema },
  shelf_life: String,
  ratings: { type: RatingsSchema },
  delivery: { type: mongoose.Schema.Types.Mixed },
  vendor: {
    vendor_id: { type: String, required: true },
    vendor_name: { type: String, required: true },
  },
  status: { type: String, default: 'active' },
  date_added: { type: Date, default: Date.now },
  last_updated: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Product', ProductSchema);
