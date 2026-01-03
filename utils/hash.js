// utils/hash.js
const crypto = require('crypto');

const hashOtp = (otp) => {
  // use sha256 with salt to make it non-reversible
  return crypto.createHash('sha256').update(otp).digest('hex');
};

module.exports = { hashOtp };
