const twilio = require('twilio');
require('dotenv').config();

const ACCOUNT_SID = (process.env.TWILIO_ACCOUNT_SID || '').trim();
const AUTH_TOKEN = (process.env.TWILIO_AUTH_TOKEN || '').trim();
const MESSAGING_SERVICE_SID = (process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim();
const FROM_NUMBER = (process.env.TWILIO_FROM_NUMBER || '').trim();
const VERIFY_SERVICE_SID = (process.env.TWILIO_VERIFY_SERVICE_SID || '').trim();

if (!ACCOUNT_SID || !AUTH_TOKEN) {
  console.warn('Twilio credentials not set in .env — SMS will fail until provided.');
}

const normalizeForTwilio = (phone) => {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('+')) return digits;
  return `+${digits}`;
};

const client = ACCOUNT_SID && AUTH_TOKEN ? twilio(ACCOUNT_SID, AUTH_TOKEN) : null;

const ensureSenderConfigured = () => {
  if (VERIFY_SERVICE_SID) return;
  if (!MESSAGING_SERVICE_SID && !FROM_NUMBER) {
    throw new Error('TWILIO_VERIFY_SERVICE_SID or messaging configuration required');
  }
  if (!MESSAGING_SERVICE_SID && FROM_NUMBER && !FROM_NUMBER.startsWith('+')) {
    throw new Error('TWILIO_FROM_NUMBER must be in E.164 format, e.g. +12025551234');
  }
};

const sendOtpSms = async (phone, message) => {
  if (!client) throw new Error('Twilio client not configured');
  ensureSenderConfigured();
  const toNumber = normalizeForTwilio(phone);
  if (!toNumber) throw new Error('Invalid phone number');
  if (VERIFY_SERVICE_SID) {
    return client.verify.v2.services(VERIFY_SERVICE_SID).verifications.create({
      to: toNumber,
      channel: 'sms'
    });
  }
  if (!message) throw new Error('Message required when TWILIO_VERIFY_SERVICE_SID is not configured');
  const payload = {
    body: message,
    to: toNumber
  };
  if (MESSAGING_SERVICE_SID) {
    payload.messagingServiceSid = MESSAGING_SERVICE_SID;
  } else if (FROM_NUMBER) {
    payload.from = FROM_NUMBER;
  }
  return client.messages.create(payload);
};

const verifyOtpCode = async (phone, code) => {
  if (!client) throw new Error('Twilio client not configured');
  ensureSenderConfigured();
  const toNumber = normalizeForTwilio(phone);
  if (!toNumber) throw new Error('Invalid phone number');
  if (VERIFY_SERVICE_SID) {
    return client.verify.v2.services(VERIFY_SERVICE_SID).verificationChecks.create({
      to: toNumber,
      code: String(code)
    });
  }
  throw new Error('Direct Twilio message flow does not support server-side OTP verification');
};

module.exports = { sendOtpSms, verifyOtpCode, normalizeForTwilio };
