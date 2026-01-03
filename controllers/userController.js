const User = require('../models/User');
const { reverseGeocode, forwardGeocode } = require('../utils/geocoder');

// Utility functions
const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }
  return undefined;
};

const serializeAddresses = (addresses) => addresses.map((address) => (typeof address.toObject === 'function' ? address.toObject() : address));

// 👤 GET profile
const getProfile = async (req, res) => {
  const userId = req.user.userId;
  const user = await User.findById(userId).select('-__v -addresses');
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
  return res.json({ ok: true, user });
};

// 👤 UPDATE profile
const updateProfile = async (req, res) => {
  const userId = req.user.userId;
  const { name, email } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

  let changed = false;
  if (typeof name !== 'undefined') {
    user.name = name;
    changed = true;
  }
  if (typeof email !== 'undefined') {
    user.email = email;
    changed = true;
  }

  if (changed) {
    user.profileCompleted = Boolean(user.name && user.email);
    await user.save();
  }

  const { addresses, __v, ...payload } = user.toObject();
  return res.json({ ok: true, user: payload });
};

// ❌ DELETE profile
const deleteProfile = async (req, res) => {
  const userId = req.user.userId;
  const user = await User.findByIdAndDelete(userId);
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
  return res.json({ ok: true, message: 'User profile deleted successfully' });
};

// 📍 GET addresses
const getAddresses = async (req, res) => {
  const userId = req.user.userId;
  const user = await User.findById(userId).select('addresses');
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
  return res.json({ ok: true, addresses: serializeAddresses(user.addresses) });
};

// 📍 REVERSE GEOCODE
const reverseGeocodeAddress = async (req, res) => {
  const { latitude, longitude } = req.query;
  if (!latitude || !longitude) {
    return res.status(400).json({ ok: false, message: 'Latitude and Longitude are required' });
  }

  const addressDetails = await reverseGeocode(latitude, longitude);
  if (!addressDetails) {
    return res.status(404).json({ ok: false, message: 'Could not fetch address details' });
  }

  return res.json({ ok: true, address: addressDetails });
};

// 📍 CREATE address
const createAddress = async (req, res) => {
  const userId = req.user.userId;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

  let { label, houseNo, street, landmark, city, state, pincode, latitude, longitude } = req.body;

  // If coordinates are missing, try to geocode based on address fields
  if (!latitude || !longitude) {
    const addressString = `${houseNo || ''} ${street || ''} ${city || ''} ${state || ''} ${pincode || ''}`.trim();
    if (addressString) {
      const coords = await forwardGeocode(addressString);
      if (coords) {
        latitude = coords.latitude;
        longitude = coords.longitude;
      }
    }
  }

  const requestedDefault = parseBoolean(req.body.isDefault);

  let makeDefault = requestedDefault === true;
  if (requestedDefault === undefined && user.addresses.length === 0) makeDefault = true;

  if (makeDefault) {
    user.addresses.forEach((address) => (address.isDefault = false));
  }

  user.addresses.push({
    label,
    houseNo,
    street,
    landmark,
    city,
    state,
    pincode,
    latitude,
    longitude,
    isDefault: makeDefault
  });

  if (!user.addresses.some((address) => address.isDefault)) {
    const last = user.addresses[user.addresses.length - 1];
    if (last) last.isDefault = true;
  }

  await user.save();
  const addresses = serializeAddresses(user.addresses);
  return res.status(201).json({ ok: true, address: addresses[addresses.length - 1], addresses });
};

// ✏️ UPDATE address
const updateAddress = async (req, res) => {
  const userId = req.user.userId;
  const { addressId } = req.params;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

  const address = user.addresses.id(addressId);
  if (!address) return res.status(404).json({ ok: false, message: 'Address not found' });

  const fields = ['label', 'houseNo', 'street', 'landmark', 'city', 'state', 'pincode', 'latitude', 'longitude'];
  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      address[field] = req.body[field];
    }
  });

  // If coordinates are still missing after update, try to geocode
  if (!address.latitude || !address.longitude) {
    const addressString = `${address.houseNo || ''} ${address.street || ''} ${address.city || ''} ${address.state || ''} ${address.pincode || ''}`.trim();
    if (addressString) {
      const coords = await forwardGeocode(addressString);
      if (coords) {
        address.latitude = coords.latitude;
        address.longitude = coords.longitude;
      }
    }
  }

  const defaultFlag = parseBoolean(req.body.isDefault);
  if (defaultFlag === true) {
    user.addresses.forEach((item) => (item.isDefault = item._id.toString() === addressId));
  } else if (defaultFlag === false) {
    address.isDefault = false;
  }

  if (!user.addresses.some((item) => item.isDefault)) {
    const first = user.addresses[0];
    if (first) first.isDefault = true;
  }

  await user.save();
  const addresses = serializeAddresses(user.addresses);
  const updated = addresses.find((item) => item._id.toString() === addressId);
  return res.json({ ok: true, address: updated, addresses });
};

// ❌ DELETE address
const deleteAddress = async (req, res) => {
  const userId = req.user.userId;
  const { addressId } = req.params;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

  const address = user.addresses.id(addressId);
  if (!address) return res.status(404).json({ ok: false, message: 'Address not found' });

  address.deleteOne(); // remove the subdocument

  // if deleted one was default → make another default
  if (!user.addresses.some((addr) => addr.isDefault)) {
    const first = user.addresses[0];
    if (first) first.isDefault = true;
  }

  await user.save();

  return res.json({
    ok: true,
    message: 'Address deleted successfully',
    addresses: serializeAddresses(user.addresses)
  });
};

module.exports = {
  getProfile,
  updateProfile,
  deleteProfile,
  getAddresses,
  reverseGeocodeAddress,
  createAddress,
  updateAddress,
  deleteAddress
};
