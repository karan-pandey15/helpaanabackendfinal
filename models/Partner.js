const mongoose = require('mongoose');

const ALLOWED_ROLES = ['rider', 'admin', 'picker'];
const ALLOWED_GENDERS = ['male', 'female', 'other', ''];

const partnerSchema = new mongoose.Schema({
  full_name: { type: String, required: true },
  phone_number: { type: String, required: true, unique: true },
  alternate_phone_number: { type: String, default: '' },
  date_of_birth: { type: String, default: '' },
  gender: { type: String, enum: ALLOWED_GENDERS, default: '' },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  pincode: { type: String, default: '' },
  area_locality: { type: String, default: '' },
  vehicle_type: { type: String, default: '' },
  vehicle_model: { type: String, default: '' },
  vehicle_number: { type: String, default: '' },
  profile_photo: { type: String, default: '' },
  aadhaar_front: { type: String, default: '' },
  aadhaar_back: { type: String, default: '' },
  driving_license_front: { type: String, default: '' },
  driving_license_back: { type: String, default: '' },
  vehicle_rc: { type: String, default: '' },
  pan_card: { type: String, default: '' },
  account_holder_name: { type: String, default: '' },
  bank_name: { type: String, default: '' },
  account_number: { type: String, default: '' },
  ifsc_code: { type: String, default: '' },
  upi_id: { type: String, default: '' },
  rider_type: { type: String, default: '' },
  working_shift: { type: String, default: '' },
  emergency_contact_name: { type: String, default: '' },
  emergency_contact_number: { type: String, default: '' },
  role: { type: String, enum: ALLOWED_ROLES, default: 'rider' },
  is_active: { type: Boolean, default: true },
  average_rating: { type: Number, default: 0, min: 0, max: 5 }
}, { timestamps: true });

partnerSchema.statics.normalizePhoneNumber = function(phoneNumber) {
  if (!phoneNumber) return '';
  const digits = String(phoneNumber).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return digits;
  return digits;
};

partnerSchema.statics.ALLOWED_ROLES = ALLOWED_ROLES;

module.exports = mongoose.model('Partner', partnerSchema);