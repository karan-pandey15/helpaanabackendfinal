const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String, required: true },
  time: { type: String, required: true },
  date: { type: String, required: true },
  category: { type: String, required: true },
  hour: { type: String, required: true },
  suggestion: { type: String },
  images: [{ url: String, public_id: String }],
  date_added: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Service', ServiceSchema);
