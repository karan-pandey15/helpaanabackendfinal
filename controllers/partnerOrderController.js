const mongoose = require('mongoose');
const Order = require('../models/Order');
const Partner = require('../models/Partner');
const {
  STATUS_VALUES,
  canRoleSetStatus,
  applyStatusChange,
  serializeOrder
} = require('../services/orderStatus');
const { emitOrderEvent } = require('../services/orderHelper');

const resolveOrderByParam = async (orderIdOrDbId) => {
  if (!orderIdOrDbId) return null;
  if (mongoose.Types.ObjectId.isValid(orderIdOrDbId)) {
    const order = await Order.findById(orderIdOrDbId);
    if (order) return order;
  }
  return Order.findOne({ orderId: orderIdOrDbId });
};

const getOrders = async (req, res) => {
  const partnerId = req.partner.partnerId;
  const partner = await Partner.findById(partnerId).select('role');
  if (!partner) return res.status(404).json({ ok: false, message: 'Partner not found' });

  const orders = await Order.find({}).sort({ createdAt: -1 });
  const payload = orders.map((order) => serializeOrder(order));

  return res.json({ ok: true, orders: payload });
};

const updateOrderStatus = async (req, res) => {
  const partnerId = req.partner.partnerId;
  const partner = await Partner.findById(partnerId).select('role');
  if (!partner) return res.status(404).json({ ok: false, message: 'Partner not found' });

  const { orderId } = req.params;
  const { status } = req.body;

  if (!status || !STATUS_VALUES.includes(status)) {
    return res.status(400).json({ ok: false, message: 'Invalid status' });
  }

  if (!canRoleSetStatus(partner.role, status)) {
    return res.status(403).json({ ok: false, message: 'Not allowed to set this status' });
  }

  const order = await resolveOrderByParam(orderId);
  if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

  await applyStatusChange({
    order,
    status,
    actor: {
      type: 'partner',
      id: partner._id,
      role: partner.role
    }
  });

  const io = req.app.get('io');
  emitOrderEvent(io, 'orders:status', { orderId: order.orderId, status: order.status }, order.user);

  return res.json({ ok: true, order: serializeOrder(order) });
};

const updatePaymentStatus = async (req, res) => {
  const partnerId = req.partner.partnerId;
  const partner = await Partner.findById(partnerId).select('role');
  if (!partner) return res.status(404).json({ ok: false, message: 'Partner not found' });

  const { orderId } = req.params;
  const { paymentStatus } = req.body;

  if (!paymentStatus || !['Pending', 'Done'].includes(paymentStatus)) {
    return res.status(400).json({ ok: false, message: 'Invalid payment status. Must be Pending or Done' });
  }

  const order = await resolveOrderByParam(orderId);
  if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

  // Check if payment method is cod or online and current status is pending
  if (!['cod', 'online'].includes(order.payment.method) || order.payment.status !== 'Pending') {
    return res.status(400).json({ ok: false, message: 'Payment status can only be updated for COD or online payments with pending status' });
  }

  // Update payment status
  order.payment.status = paymentStatus;
  await order.save();

  const io = req.app.get('io');
  emitOrderEvent(io, 'orders:payment-status', { orderId: order.orderId, paymentStatus: order.payment.status }, order.user);

  return res.json({ ok: true, order: serializeOrder(order) });
};

module.exports = {
  getOrders,
  updateOrderStatus,
  updatePaymentStatus
};