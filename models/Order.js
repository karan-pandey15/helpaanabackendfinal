 

const mongoose = require('mongoose');

// Item Schema
const itemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  finalPrice: { type: Number, required: true, min: 0 },
  image: { type: String, default: null },
  time: { type: String },
  date: { type: String },
  suggestion: { type: String },
  category: { type: String },
  hour: { type: String },
  checkIn: { type: String },
  checkOut: { type: String },
  guests: { type: Number }
}, { _id: false, timestamps: false });

// Pricing Schema
const pricingSchema = new mongoose.Schema({
  subtotal: { type: Number, required: true },
  deliveryFee: { type: Number, required: true },
  couponDiscount: { type: Number, default: 0 },
  tax: { type: Number, required: true },
  grandTotal: { type: Number, required: true }
}, { _id: false, timestamps: false });

// Address Schema
const addressSchema = new mongoose.Schema({
  label: { type: String, default: null },
  houseNo: { type: String, default: null },
  street: { type: String, default: null },
  landmark: { type: String, default: null },
  city: { type: String, default: null },
  state: { type: String, default: null },
  pincode: { type: String, default: null },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  isDefault: { type: Boolean, default: false },
  contactName: { type: String, default: null },
  contactPhone: { type: String, default: null }
}, { _id: false, timestamps: false });

// Payment Schema
const paymentSchema = new mongoose.Schema({
  method: { type: String, default: 'cod' },
  transactionId: { type: String, default: null },
  status: { type: String, default: 'Pending' },
  razorpayOrderId: { type: String, default: null }
}, { _id: false, timestamps: false });

// Delivery Schema
const deliverySchema = new mongoose.Schema({
  type: { type: String, default: 'Instant' },
  expectedTime: { type: Date, default: null },
  instructions: { type: String, default: null }
}, { _id: false, timestamps: false });

// Status History Schema
const statusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  updatedBy: {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null },
    role: { type: String, required: true }
  },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false, timestamps: false });

// ✅ FIX: Add validator INSIDE schema definition
statusHistorySchema.pre('validate', function (next) {
  if (!this.updatedBy || (!this.updatedBy.user && !this.updatedBy.partner)) {
    return next(new Error('Status history entry must include a user or partner reference'));
  }
  next();
});

// Main Order Schema
const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  items: {
    type: [itemSchema],
    validate: [(v) => Array.isArray(v) && v.length > 0, 'Order must include items']
  },

  pricing: { type: pricingSchema, required: true },
  address: { type: addressSchema, required: true },
  payment: { type: paymentSchema, required: true },
  delivery: { type: deliverySchema, required: true },

  couponCode: { type: String, default: null },

  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Assigned', 'OutForDelivery', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },

  statusHistory: {
    type: [statusHistorySchema],
    default: []
  }

}, { timestamps: true });

orderSchema.statics.ALLOWED_STATUSES = ['Pending', 'Accepted', 'Assigned', 'OutForDelivery', 'Delivered', 'Cancelled'];
orderSchema.statics.PICKER_ALLOWED_STATUSES = ['Accepted', 'Assigned'];
orderSchema.statics.RIDER_ALLOWED_STATUSES = ['OutForDelivery', 'Delivered'];

module.exports = mongoose.model('Order', orderSchema);
