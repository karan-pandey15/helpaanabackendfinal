// models/Otp.js
const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  otpHash: { type: String, required: true }, // hashed OTP
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true} // TTL index
});

// TTL index to auto-delete expired OTP documents
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', otpSchema);
