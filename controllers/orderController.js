const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Partner = require('../models/Partner');
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
  emitOrderEvent,
  joinOrderRooms
} = require('../services/orderHelper');
const {
  STATUS_VALUES,
  canRoleSetStatus,
  applyStatusChange,
  serializeOrder
} = require('../services/orderStatus');
const { markCouponUsed } = require('./couponController');

const createOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { items, pricing, payment = {}, delivery, addressId, address, couponCode } = req.body;

    const paymentMethod = payment.method ? String(payment.method).toLowerCase() : 'cod';
    const isOnlinePayment = paymentMethod === 'online' || paymentMethod === 'razorpay';

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

    const sanitizedItems = sanitizeItems(items);
    
    // Auto-resolve categories if missing
    let resolvedCategory = null;
    for (let item of sanitizedItems) {
      if (!item.category) {
        console.log(`Resolving category for product: ${item.productId}`);
        // Try Product
        let p = await Product.findOne({ id: item.productId });
        if (!p && mongoose.Types.ObjectId.isValid(item.productId)) {
          p = await Product.findById(item.productId);
        }
        if (p) {
          item.category = p.category;
          console.log(`Found Product category: ${p.category}`);
        } else {
          // Try Service
          if (mongoose.Types.ObjectId.isValid(item.productId)) {
            let s = await Service.findById(item.productId);
            if (s) {
              item.category = s.category;
              console.log(`Found Service category: ${s.category}`);
            }
          }
        }
      }
      if (item.category && !resolvedCategory) {
        resolvedCategory = item.category;
      }
    }

    const pricingPayload = computePricing(sanitizedItems, pricing);
    const selectedAddress = buildOrderAddress(user, selectUserAddress(user, addressId), address);
    
    // Get category from items or use resolved one
    const orderCategory = resolvedCategory || (sanitizedItems && sanitizedItems.length > 0 ? sanitizedItems[0].category : null);
    console.log(`Final Order Category: ${orderCategory}`);

    if (isOnlinePayment) {
      return res.status(400).json({
        ok: false,
        message: 'Online payments must be initiated via /orders/payment/initiate endpoint.'
      });
    }

    const paymentPayload = buildPayment({
      method: 'cod',
      transactionId: payment.transactionId || null,
      status: 'Pending'
    });

    const deliveryPayload = buildDelivery(delivery);

    const order = await Order.create({
      orderId: generateOrderId(),
      user: user._id,
      category: orderCategory,
      items: sanitizedItems,
      pricing: pricingPayload,
      address: selectedAddress,
      payment: paymentPayload,
      delivery: deliveryPayload,
      couponCode: couponCode || null,
      status: 'Pending',
      statusHistory: [{
        status: 'Pending',
        updatedBy: { user: user._id, role: user.role },
        updatedAt: new Date()
      }]
    });

    // Mark coupon as used if applied
    if (couponCode && pricing.couponDiscount > 0) {
      await markCouponUsed(userId, couponCode.toUpperCase());
    }

    const io = req.app.get('io');
    emitOrderEvent(io, 'orders:new', serializeOrder(order), userId, orderCategory);

    const payload = order.toObject();
    delete payload.__v;

    return res.status(201).json({ ok: true, order: payload });
  } catch (err) {
    return res.status(400).json({ ok: false, message: err.message });
  }
};

const getOrders = async (req, res) => {
  const userId = req.user.userId;
  const user = await User.findById(userId).select('role');
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

  const filter = user.role === 'customer' ? { user: user._id } : {};
  const orders = await Order.find(filter).sort({ createdAt: -1 });
  const payload = orders.map((order) => serializeOrder(order));

  const io = req.app.get('io');
  const socketId = req.query.socketId || req.headers['x-socket-id'];
  if (io && socketId) {
    const socket = joinOrderRooms(io, socketId, user);
    if (socket) {
      socket.emit('orders:init', payload);
    }
  }

  return res.json({ ok: true, orders: payload });
};

const resolveOrderByParam = async (orderIdOrDbId) => {
  if (!orderIdOrDbId) return null;
  if (mongoose.Types.ObjectId.isValid(orderIdOrDbId)) {
    const order = await Order.findById(orderIdOrDbId);
    if (order) return order;
  }
  return Order.findOne({ orderId: orderIdOrDbId });
};

const updateOrderStatus = async (req, res) => {
  const userId = req.user.userId;
  const { orderId } = req.params;
  const { status } = req.body;

  if (!status || !STATUS_VALUES.includes(status)) {
    return res.status(400).json({ ok: false, message: 'Invalid status' });
  }

  const actor = await User.findById(userId).select('role');
  if (!actor) return res.status(404).json({ ok: false, message: 'User not found' });

  if (!canRoleSetStatus(actor.role, status)) {
    return res.status(403).json({ ok: false, message: 'Not allowed to set this status' });
  }

  const order = await resolveOrderByParam(orderId);
  if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

  await applyStatusChange({
    order,
    status,
    actor: {
      type: 'user',
      id: actor._id,
      role: actor.role
    }
  });

  const io = req.app.get('io');
  emitOrderEvent(io, 'orders:status', { orderId: order.orderId, status: order.status }, order.user);

  return res.json({ ok: true, order: serializeOrder(order) });
};

module.exports = { createOrder, getOrders, updateOrderStatus };