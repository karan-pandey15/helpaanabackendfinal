const Razorpay = require('razorpay');
const crypto = require('crypto');

const ensureCredentials = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials are missing. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment.');
  }
};

const getClient = () => {
  ensureCredentials();
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
};

const createRazorpayOrder = async ({ amount, currency = 'INR', receipt, notes = {} }) => {
  if (!amount || amount <= 0) {
    throw new Error('Invalid amount for Razorpay order');
  }

  const client = getClient();
  const payload = {
    amount: Math.round(amount),
    currency,
    receipt,
    payment_capture: 1,
    notes
  };
  return client.orders.create(payload);
};

const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
  ensureCredentials();
  if (!orderId || !paymentId || !signature) return false;
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
};

module.exports = {
  createRazorpayOrder,
  verifyPaymentSignature
};