const mongoose = require('mongoose');

const servicePartnerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  addharNumber: { type: String },
  panNumber: { type: String },
  highestQualification: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  completeAddress: { type: String, required: true },
  pincode: { type: String },
  category: { type: String, required: true },
  bankDetails: {
    bankName: { type: String },
    ifscCode: { type: String },
    branchName: { type: String },
    accountNumber: { type: String }
  },
  documents: {
    addharFrontImage: { type: String },
    addharBackImage: { type: String },
    panImage: { type: String },
    degreeImage: { type: String }
  },
  guarenter: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    relation: { type: String }
  },
  is_active: { type: Boolean, default: true }
}, { 
  timestamps: true,
  collection: 'service_partners'
});

module.exports = mongoose.model('ServicePartner', servicePartnerSchema);
