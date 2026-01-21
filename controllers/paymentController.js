const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Service = require('../models/ServiceModels');
const {
  sanitizeItems,
  computePricing,
  selectUserAddress,
  buildOrderAddress,
  buildPayment,
  buildDelivery,
  generateOrderId,
  emitOrderEvent
} = require('../services/orderHelper');
const { createRazorpayOrder, verifyPaymentSignature } = require('../services/razorpayService');

const normalizePaymentMethod = (value = 'cod') => {
  const normalized = String(value || '').toLowerCase();
  if (['online', 'razorpay', 'prepaid'].includes(normalized)) return 'online';
  if (['cod', 'cash', 'cash_on_delivery'].includes(normalized)) return 'cod';
  return normalized;
};

const createPaymentOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      items,
      pricing,
      delivery,
      addressId,
      addressOverrides,
      address,
      payment = {}
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, message: 'Order items are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    const paymentMethod = normalizePaymentMethod(payment.method || 'cod');
    if (!['cod', 'online'].includes(paymentMethod)) {
      return res.status(400).json({ ok: false, message: 'Unsupported payment method' });
    }

    const sanitizedItems = sanitizeItems(items);

    // Auto-resolve categories if missing
    let resolvedCategory = null;
    for (let item of sanitizedItems) {
      if (!item.category) {
        // Try Product
        let p = await Product.findOne({ id: item.productId });
        if (!p && mongoose.Types.ObjectId.isValid(item.productId)) {
          p = await Product.findById(item.productId);
        }
        if (p) {
          item.category = p.category;
        } else {
          // Try Service
          if (mongoose.Types.ObjectId.isValid(item.productId)) {
            let s = await Service.findById(item.productId);
            if (s) item.category = s.category;
          }
        }
      }
      if (item.category && !resolvedCategory) {
        resolvedCategory = item.category;
      }
    }

    const pricingPayload = computePricing(sanitizedItems, pricing);
    const amountPayable = Number(pricingPayload.grandTotal);
    
    // Get category from items or use resolved one
    const orderCategory = resolvedCategory || (sanitizedItems && sanitizedItems.length > 0 ? sanitizedItems[0].category : null);

    if (!Number.isFinite(amountPayable) || amountPayable <= 0) {
      return res.status(400).json({ ok: false, message: 'Invalid payable amount' });
    }

    const selectedAddressDoc = selectUserAddress(user, addressId);
    const addressPayload = buildOrderAddress(
      user,
      selectedAddressDoc,
      addressOverrides || address || {}
    );
    const deliveryPayload = buildDelivery(delivery);

    const internalOrderId = generateOrderId();
    const baseOrderData = {
      orderId: internalOrderId,
      user: user._id,
      category: orderCategory,
      items: sanitizedItems,
      pricing: pricingPayload,
      address: addressPayload,
      delivery: deliveryPayload,
      status: 'Pending',
      statusHistory: [{
        status: 'Pending',
        updatedBy: { user: user._id, role: user.role },
        updatedAt: new Date()
      }]
    };

    if (paymentMethod === 'cod') {
      const order = await Order.create({
        ...baseOrderData,
        payment: buildPayment({
          method: 'cod',
          status: 'Pending'
        })
      });

      const io = req.app.get('io');
      const payload = order.toObject();
      delete payload.__v;
      emitOrderEvent(io, 'orders:new', payload, userId, orderCategory);

      return res.status(201).json({ ok: true, order: payload });
    }

    const amountInPaise = Math.round(amountPayable * 100);
    if (amountInPaise <= 0) {
      return res.status(400).json({ ok: false, message: 'Invalid payable amount for online payment' });
    }

    const razorpayOrder = await createRazorpayOrder({
      amount: amountInPaise,
      receipt: internalOrderId,
      notes: {
        userId: user._id.toString(),
        paymentMethod: 'online'
      }
    });

    const order = await Order.create({
      ...baseOrderData,
      payment: buildPayment({
        method: 'online',
        status: 'Pending',
        razorpayOrderId: razorpayOrder.id
      })
    });

    const io = req.app.get('io');
    const payload = order.toObject();
    delete payload.__v;
    emitOrderEvent(io, 'orders:new', payload, userId, orderCategory);

    payload.razorpayOrder = {
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      receipt: razorpayOrder.receipt
    };
    payload.razorpayKeyId = process.env.RAZORPAY_KEY_ID;

    return res.status(201).json({ ok: true, order: payload });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ ok: false, message: 'Payment verification data is incomplete' });
    }

    const isValid = verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature
    });

    if (!isValid) {
      return res.status(400).json({ ok: false, message: 'Invalid payment signature' });
    }

    const order = await Order.findOne({ 'payment.razorpayOrderId': razorpayOrderId }).populate('user', 'role');
    if (!order) {
      return res.status(404).json({ ok: false, message: 'Order not found for the provided Razorpay order ID' });
    }

    if (order.user._id.toString() !== userId) {
      return res.status(403).json({ ok: false, message: 'You are not authorized to verify this payment' });
    }

    if (order.payment.status === 'Done') {
      const io = req.app.get('io');
      const broadcastPayload = {
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.payment.status,
        transactionId: order.payment.transactionId
      };
      emitOrderEvent(io, 'orders:status', broadcastPayload, order.user._id);

      const payload = order.toObject();
      delete payload.__v;
      return res.json({ ok: true, order: payload, message: 'Payment already verified' });
    }

    order.payment.status = 'Done';
    order.payment.transactionId = razorpayPaymentId;
    if (order.payment.method !== 'online') {
      order.payment.method = 'online';
    }

    // Keep order status as 'Pending' after payment verification
    // Removed automatic status change to 'Accepted'

    await order.save();

    const io = req.app.get('io');
    const broadcastPayload = {
      orderId: order.orderId,
      status: order.status,
      paymentStatus: order.payment.status,
      transactionId: order.payment.transactionId
    };
    emitOrderEvent(io, 'orders:status', broadcastPayload, order.user._id);

    const payload = order.toObject();
    delete payload.__v;
    return res.json({ ok: true, order: payload });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message });
  }
};

module.exports = {
  createPaymentOrder,
  verifyPayment
};