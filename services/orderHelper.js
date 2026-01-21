const mongoose = require('mongoose');
const DEFAULT_DELIVERY_FEE = 15;
const DEFAULT_TAX_RATE = 0.03;
const ORDER_ROOM_PREFIX = 'orders:user:';
const ADMIN_ROOM = 'orders:admin';
const RIDER_ROOM = 'orders:rider';
const PARTNER_ROOM = 'orders:partner';
const CATEGORY_ROOM_PREFIX = 'orders:category:';

const resolveUserId = (userId) => {
  if (!userId) return null;
  if (typeof userId === 'string') return userId;
  if (userId instanceof mongoose.Types.ObjectId) return userId.toString();
  if (userId._id) return resolveUserId(userId._id);
  if (typeof userId.toString === 'function') return userId.toString();
  return null;
};

const emitOrderEvent = (io, eventName, payload, userId, category = null) => {
  if (!io) return;
  const normalizedUserId = resolveUserId(userId);
  if (normalizedUserId) {
    io.to(`${ORDER_ROOM_PREFIX}${normalizedUserId}`).emit(eventName, payload);
  }
  io.to(ADMIN_ROOM).emit(eventName, payload);
  io.to(PARTNER_ROOM).emit(eventName, payload);
  io.to(RIDER_ROOM).emit(eventName, payload);
  if (category) {
    io.to(`${CATEGORY_ROOM_PREFIX}${category}`).emit(eventName, payload);
  }
};

const joinOrderRooms = (io, socketId, user) => {
  if (!io || !socketId || !user) return null;
  const socket = io.sockets.sockets.get(socketId);
  if (!socket) return null;

  const role = typeof user.role === 'string' ? user.role.toLowerCase() : '';
  if (role === 'customer') {
    socket.join(`${ORDER_ROOM_PREFIX}${user._id.toString()}`);
  } else if (role === 'admin') {
    socket.join(ADMIN_ROOM);
  } else if (role === 'partner') {
    socket.join(PARTNER_ROOM);
  } else if (role === 'rider') {
    socket.join(RIDER_ROOM);
  } else if (role === 'servicepartner') {
    if (user.category) {
      socket.join(`${CATEGORY_ROOM_PREFIX}${user.category}`);
    }
  }

  return socket;
};

const generateOrderId = () => {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const random = String(Math.floor(1000 + Math.random() * 9000));
  return `ORD${stamp}${random}`;
};

const sanitizeItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Order items are required');
  }
  return items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const discount = Number(item.discount) || 0;
    const derived = quantity * unitPrice - discount;
    const finalPrice = typeof item.finalPrice === 'number' ? item.finalPrice : Math.max(derived, 0);
    return {
      productId: item.productId,
      name: item.name,
      quantity,
      unitPrice,
      discount,
      finalPrice,
      image: item.image || null,
      time: item.time || null,
      date: item.date || null,
      suggestion: item.suggestion || null,
      category: item.category || null,
      hour: item.hour || null,
      checkIn: item.checkIn || null,
      checkOut: item.checkOut || null,
      guests: item.guests || null
    };
  });
};

const computePricing = (items, override = {}) => {
  const subtotal = override.subtotal ?? items.reduce((sum, item) => sum + Number(item.finalPrice || 0), 0);
  const deliveryFee = override.deliveryFee ?? DEFAULT_DELIVERY_FEE;
  const couponDiscount = override.couponDiscount ?? 0;
  const tax = override.tax ?? Number((subtotal * DEFAULT_TAX_RATE).toFixed(2));
  const grandTotal = override.grandTotal ?? Number((subtotal + deliveryFee - couponDiscount + tax).toFixed(2));
  return { subtotal, deliveryFee, couponDiscount, tax, grandTotal };
};

const selectUserAddress = (user, addressId) => {
  if (!user || !Array.isArray(user.addresses)) return null;
  if (addressId) {
    const target = user.addresses.id(addressId);
    if (target) return target;
  }
  return user.addresses.find((addr) => addr.isDefault) || user.addresses[0] || null;
};

const buildOrderAddress = (user, addressDoc, overrides = {}) => {
  if (!addressDoc) {
    throw new Error('No address available for order');
  }
  return {
    label: addressDoc.label || null,
    houseNo: addressDoc.houseNo || null,
    street: addressDoc.street || null,
    landmark: addressDoc.landmark || null,
    city: addressDoc.city || null,
    state: addressDoc.state || null,
    pincode: addressDoc.pincode || null,
    latitude: typeof overrides.latitude === 'number' ? overrides.latitude : addressDoc.latitude,
    longitude: typeof overrides.longitude === 'number' ? overrides.longitude : addressDoc.longitude,
    isDefault: typeof overrides.isDefault === 'boolean' ? overrides.isDefault : addressDoc.isDefault,
    contactName: overrides.contactName || user.name || addressDoc.label || 'Customer',
    contactPhone: overrides.contactPhone || user.phone || null
  };
};

const buildPayment = (payload = {}) => ({
  method: payload.method || 'cod',
  transactionId: payload.transactionId || null,
  status: payload.status || 'Pending',
  razorpayOrderId: payload.razorpayOrderId || null
});

const buildDelivery = (payload = {}) => ({
  type: payload.type || 'Instant',
  expectedTime: payload.expectedTime ? new Date(payload.expectedTime) : new Date(Date.now() + 45 * 60 * 1000),
  instructions: payload.instructions || null
});

module.exports = {
  DEFAULT_DELIVERY_FEE,
  DEFAULT_TAX_RATE,
  ORDER_ROOM_PREFIX,
  ADMIN_ROOM,
  RIDER_ROOM,
  PARTNER_ROOM,
  CATEGORY_ROOM_PREFIX,
  resolveUserId,
  emitOrderEvent,
  joinOrderRooms,
  generateOrderId,
  sanitizeItems,
  computePricing,
  selectUserAddress,
  buildOrderAddress,
  buildPayment,
  buildDelivery
};