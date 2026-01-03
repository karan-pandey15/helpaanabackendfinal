// controllers/adminController.js
const User = require('../models/User');
const Order = require('../models/Order');
const Partner = require('../models/Partner');
const Coupon = require('../models/Coupon');
const { serializeOrder } = require('../services/orderStatus');
const { joinOrderRooms, ADMIN_ROOM } = require('../services/orderHelper');

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-__v').sort({ createdAt: -1 });
    return res.json({ ok: true, users });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    const payload = orders.map((order) => serializeOrder(order));
    
    const io = req.app.get('io');
    const socketId = req.query.socketId || req.headers['x-socket-id'];
    
    if (io && socketId) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.join(ADMIN_ROOM);
        socket.emit('orders:init', payload);
      }
    }
    
    return res.json({ ok: true, orders: payload });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

const getAllPartners = async (req, res) => {
  try {
    const partners = await Partner.find({}).select('-__v').sort({ createdAt: -1 });
    return res.json({ ok: true, partners });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

const getAllUserOrders = async (req, res) => {
  // This is the same as getAllOrders since all orders belong to users
  return getAllOrders(req, res);
};

const getAllPayments = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate('user', 'name phone email')
      .select('orderId user payment status createdAt')
      .sort({ createdAt: -1 });

    const payments = orders.map(order => ({
      orderId: order.orderId,
      user: order.user,
      payment: order.payment,
      status: order.status,
      createdAt: order.createdAt
    }));

    return res.json({ ok: true, payments });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

const getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({})
      .populate('userId', 'name phone email')
      .select('-__v')
      .sort({ createdAt: -1 });
    return res.json({ ok: true, coupons });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

module.exports = {
  getAllUsers,
  getAllOrders,
  getAllPartners,
  getAllUserOrders,
  getAllPayments,
  getAllCoupons
};