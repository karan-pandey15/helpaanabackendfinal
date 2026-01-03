// controllers/authController.js
const crypto = require('crypto');
const OtpModel = require('../models/Otp');
const User = require('../models/User');
const { hashOtp } = require('../utils/hash');
const { sendOtpSms, verifyOtpCode } = require('../services/smsService');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const USE_TWILIO_VERIFY = Boolean((process.env.TWILIO_VERIFY_SERVICE_SID || '').trim());

const genOtp = (digits = 6) => {
  const upper = Math.pow(10, digits);
  return String(crypto.randomInt(0, upper)).padStart(digits, '0');
};

const sendOtp = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ ok: false, message: 'Phone is required' });

  const digits = phone.replace(/\D/g, '');
  let storedPhone = digits;
  if (digits.length === 10) storedPhone = '91' + digits;

  try {
    if (USE_TWILIO_VERIFY) {
      await sendOtpSms(storedPhone);
    } else {
      const otp = genOtp(6);
      const otpHash = hashOtp(otp);
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
      await OtpModel.deleteMany({ phone: storedPhone });
      await OtpModel.create({ phone: storedPhone, otpHash, expiresAt });
      const message = `Your verification code is ${otp}. It will expire in 2 minutes.`;
      await sendOtpSms(storedPhone, message);
    }
    return res.json({ ok: true, message: 'OTP sent' });
  } catch (err) {
    console.error('Twilio error', err.message);
    if (!USE_TWILIO_VERIFY) {
      await OtpModel.deleteMany({ phone: storedPhone });
    }
    return res.status(500).json({ ok: false, message: 'Failed to send OTP, try again later' });
  }
};

const verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ ok: false, message: 'phone and otp required' });

  const digits = phone.replace(/\D/g, '');
  let storedPhone = digits;
  if (digits.length === 10) storedPhone = '91' + digits;

  if (USE_TWILIO_VERIFY) {
    try {
      const result = await verifyOtpCode(storedPhone, otp);
      if (result.status !== 'approved') {
        return res.status(400).json({ ok: false, message: 'Invalid or expired OTP' });
      }
    } catch (err) {
      console.error('Twilio verify error', err.message);
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

  let user = await User.findOne({ phone: storedPhone });
  if (!user) {
    user = await User.create({ phone: storedPhone });
  }

  const token = jwt.sign({ userId: user._id, phone: user.phone }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return res.json({
    ok: true,
    message: 'OTP verified',
    token,
    user: {
      id: user._id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      profileCompleted: user.profileCompleted
    }
  });
};

module.exports = { sendOtp, verifyOtp };
