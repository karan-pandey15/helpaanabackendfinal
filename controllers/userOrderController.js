const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const {
  STATUS_VALUES,
  canRoleSetStatus,
  applyStatusChange,
  serializeOrder
} = require('../services/orderStatus');
const { emitOrderEvent } = require('../services/orderHelper');

const resolveOrderByParam = async (orderIdOrDbId, userId) => {
  if (!orderIdOrDbId) return null;
  const filter = { user: userId };
  if (mongoose.Types.ObjectId.isValid(orderIdOrDbId)) {
    return Order.findOne({ ...filter, _id: orderIdOrDbId });
  }
  return Order.findOne({ ...filter, orderId: orderIdOrDbId });
};

const getOrders = async (req, res) => {
  const userId = req.user.userId;
  const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
  return res.json({ ok: true, orders: orders.map(serializeOrder) });
};

const cancelOrder = async (req, res) => {
  const userId = req.user.userId;
  const { orderId } = req.params;

  const user = await User.findById(userId).select('role');
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

  const order = await resolveOrderByParam(orderId, userId);
  if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

  if (!canRoleSetStatus(user.role || 'customer', 'Cancelled')) {
    return res.status(403).json({ ok: false, message: 'Not allowed to cancel the order' });
  }

  await applyStatusChange({
    order,
    status: 'Cancelled',
    actor: {
      type: 'user',
      id: user._id,
      role: user.role || 'customer'
    }
  });

  const io = req.app.get('io');
  emitOrderEvent(io, 'orders:status', { orderId: order.orderId, status: order.status }, order.user);

  return res.json({ ok: true, order: serializeOrder(order) });
};

module.exports = {
  getOrders,
  cancelOrder
};