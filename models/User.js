const mongoose = require('mongoose');

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
  isDefault: { type: Boolean, default: false }
}, { _id: true, timestamps: false });

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, default: null },
  email: { type: String, default: null },
  role: { type: String, enum: ['customer', 'admin', 'rider'], default: 'customer' },
  profileCompleted: { type: Boolean, default: false },
  addresses: { type: [addressSchema], default: [] },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', function(next) {
  if (!this.isModified('addresses')) return next();
  let found = false;
  this.addresses.forEach((address) => {
    if (address.isDefault) {
      if (!found) {
        found = true;
      } else {
        address.isDefault = false;
      }
    }
  });
  if (!found && this.addresses.length) {
    this.addresses[0].isDefault = true;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
