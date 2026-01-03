const mongoose = require('mongoose');

const riderRatingSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  rider: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  review_text: { type: String, default: '' }
}, { timestamps: true });

// Unique constraint: one rating per user per order
riderRatingSchema.index({ order: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('RiderRating', riderRatingSchema);