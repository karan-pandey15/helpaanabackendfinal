const crypto = require('crypto');
const OtpModel = require('../models/Otp');
const Partner = require('../models/Partner');
const { hashOtp } = require('../utils/hash');
const { sendOtpSms, verifyOtpCode } = require('../services/smsService');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const USE_TWILIO_VERIFY = Boolean((process.env.TWILIO_VERIFY_SERVICE_SID || '').trim());

const normalizePhoneNumber = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return digits;
  return digits;
};

const generateOtp = (digits = 6) => {
  const upper = Math.pow(10, digits);
  return String(crypto.randomInt(0, upper)).padStart(digits, '0');
};

const sendOtp = async (req, res) => {
  const { phone_number } = req.body;
  if (!phone_number) return res.status(400).json({ ok: false, message: 'phone_number is required' });

  const storedPhone = normalizePhoneNumber(phone_number);
  if (!storedPhone) return res.status(400).json({ ok: false, message: 'Invalid phone number' });

  try {
    const partnerExists = await Partner.findOne({ phone_number: storedPhone });
    if (!partnerExists) {
      return res.status(403).json({ ok: false, message: 'You are not an authorized partner. Please register first.' });
    }

    if (USE_TWILIO_VERIFY) {
      await sendOtpSms(storedPhone);
    } else {
      const otp = generateOtp(6);
      const otpHash = hashOtp(otp);
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
      await OtpModel.deleteMany({ phone: storedPhone });
      await OtpModel.create({ phone: storedPhone, otpHash, expiresAt });
      const message = `Your partner login code is ${otp}. It will expire in 2 minutes.`;
      await sendOtpSms(storedPhone, message);
    }

    return res.json({ ok: true, message: 'OTP sent' });
  } catch (error) {
    console.error('Partner send OTP error', error);
    if (!USE_TWILIO_VERIFY) {
      await OtpModel.deleteMany({ phone: storedPhone });
    }
    return res.status(500).json({ ok: false, message: 'Failed to send OTP, try again later' });
  }
};

const verifyOtp = async (req, res) => {
  const { phone_number, otp } = req.body;
  if (!phone_number || !otp) {
    return res.status(400).json({ ok: false, message: 'phone_number and otp are required' });
  }

  const storedPhone = normalizePhoneNumber(phone_number);
  if (!storedPhone) {
    return res.status(400).json({ ok: false, message: 'Invalid phone number' });
  }

  try {
    if (USE_TWILIO_VERIFY) {
      const result = await verifyOtpCode(storedPhone, otp);
      if (result.status !== 'approved') {
        return res.status(400).json({ ok: false, message: 'Invalid or expired OTP' });
      }
    } else {
      const otpDoc = await OtpModel.findOne({ phone: storedPhone }).sort({ createdAt: -1 });
      if (!otpDoc) return res.status(400).json({ ok: false, message: 'OTP expired or not found' });
      const otpHash = hashOtp(otp);
      if (otpHash !== otpDoc.otpHash) {
        return res.status(400).json({ ok: false, message: 'Invalid OTP' });
      }
      await OtpModel.deleteMany({ phone: storedPhone });
    }

    const partner = await Partner.findOne({ phone_number: storedPhone });
    if (!partner) {
      return res.status(403).json({ ok: false, message: 'You are not an authorized partner. Please register first.' });
    }

    const token = jwt.sign({ partnerId: partner._id, phone: partner.phone_number, role: partner.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.json({
      ok: true,
      message: 'OTP verified',
      token,
      partner
    });
  } catch (error) {
    console.error('Partner verify OTP error', error);
    return res.status(500).json({ ok: false, message: 'Failed to verify OTP, try again later' });
  }
};

const createPartner = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (!payload.phone_number) return res.status(400).json({ ok: false, message: 'phone_number is required' });
    if (!payload.full_name) return res.status(400).json({ ok: false, message: 'full_name is required' });
    if (!payload.role) payload.role = 'rider';
    if (!Partner.ALLOWED_ROLES.includes(payload.role)) {
      return res.status(400).json({ ok: false, message: 'Invalid role' });
    }

    const storedPhone = normalizePhoneNumber(payload.phone_number);
    if (!storedPhone) return res.status(400).json({ ok: false, message: 'Invalid phone number' });

    payload.phone_number = storedPhone;

    if (payload.alternate_phone_number) {
      payload.alternate_phone_number = normalizePhoneNumber(payload.alternate_phone_number);
    }

    const existing = await Partner.findOne({ phone_number: storedPhone });
    if (existing) {
      return res.status(409).json({ ok: false, message: 'Partner already registered with this phone number' });
    }

    const partner = await Partner.create(payload);
    return res.status(201).json({ ok: true, partner });
  } catch (error) {
    console.error('Create partner error', error);
    return res.status(500).json({ ok: false, message: 'Failed to create partner', error: error.message });
  }
};

const getPartnerProfile = async (req, res) => {
  try {
    const partnerId = req.partner.partnerId || req.partner._id || req.partner.id;
    const partner = await Partner.findById(partnerId).select('-__v');
    if (!partner) return res.status(404).json({ ok: false, message: 'Partner not found' });
    return res.json({ ok: true, partner });
  } catch (error) {
    console.error('Get partner profile error', error);
    return res.status(500).json({ ok: false, message: 'Failed to retrieve partner profile' });
  }
};

const updatePartner = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.phone_number) {
      const normalized = normalizePhoneNumber(updates.phone_number);
      if (!normalized) return res.status(400).json({ ok: false, message: 'Invalid phone number' });
      const existing = await Partner.findOne({ phone_number: normalized, _id: { $ne: id } });
      if (existing) return res.status(409).json({ ok: false, message: 'Another partner already registered with this phone number' });
      updates.phone_number = normalized;
    }

    if (updates.alternate_phone_number) {
      updates.alternate_phone_number = normalizePhoneNumber(updates.alternate_phone_number);
    }

    if (updates.role && !Partner.ALLOWED_ROLES.includes(updates.role)) {
      return res.status(400).json({ ok: false, message: 'Invalid role' });
    }

    const partner = await Partner.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!partner) return res.status(404).json({ ok: false, message: 'Partner not found' });

    return res.json({ ok: true, partner });
  } catch (error) {
    console.error('Update partner error', error);
    return res.status(500).json({ ok: false, message: 'Failed to update partner', error: error.message });
  }
};

const deletePartner = async (req, res) => {
  try {
    const { id } = req.params;
    const partner = await Partner.findByIdAndDelete(id);
    if (!partner) return res.status(404).json({ ok: false, message: 'Partner not found' });
    return res.json({ ok: true, message: 'Partner deleted successfully' });
  } catch (error) {
    console.error('Delete partner error', error);
    return res.status(500).json({ ok: false, message: 'Failed to delete partner', error: error.message });
  }
};

const listPartners = async (req, res) => {
  try {
    const filters = { ...req.query };
    if (filters.role && !Partner.ALLOWED_ROLES.includes(filters.role)) {
      return res.status(400).json({ ok: false, message: 'Invalid role filter' });
    }

    if (filters.role) {
      filters.role = String(filters.role);
    }

    if (filters.phone_number) {
      filters.phone_number = normalizePhoneNumber(filters.phone_number);
    }

    const partners = await Partner.find(filters).select('-__v');
    return res.json({ ok: true, partners });
  } catch (error) {
    console.error('List partners error', error);
    return res.status(500).json({ ok: false, message: 'Failed to fetch partners', error: error.message });
  }
};

const phoneSignin = async (req, res) => {
  try {
    const { phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({ ok: false, message: 'phone_number is required' });
    }

    const storedPhone = normalizePhoneNumber(phone_number);
    if (!storedPhone) {
      return res.status(400).json({ ok: false, message: 'Invalid phone number' });
    }

    const partner = await Partner.findOne({ phone_number: storedPhone });
    if (!partner) {
      return res.status(403).json({ ok: false, message: 'Partner not found. Please register first.' });
    }

    const token = jwt.sign(
      { partnerId: partner._id, phone: partner.phone_number, role: partner.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      ok: true,
      message: 'Login successful',
      token,
      partner
    });
  } catch (error) {
    console.error('Phone signin error', error);
    return res.status(500).json({ ok: false, message: 'Failed to signin', error: error.message });
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  createPartner,
  phoneSignin,
  getPartnerProfile,
  updatePartner,
  deletePartner,
  listPartners
};