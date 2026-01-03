const http = require('http');
require('dotenv').config();
require('express-async-errors');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const userOrderRoutes = require('./routes/userOrder');
const partnerOrderRoutes = require('./routes/partnerOrders');

const partnerRoutes = require('./routes/partner');
const orderRoutes = require('./routes/order');
const paymentRoutes = require('./routes/payment');
const couponRoutes = require('./routes/coupon');
const adminRoutes = require('./routes/admin');
const ratingRoutes = require('./routes/rating');
const { joinOrderRooms } = require('./services/orderHelper');
const Order = require('./models/Order');
const { serializeOrder } = require('./services/orderStatus');
const searchRoutes = require('./routes/searchRoutes')
const serviceRoutes = require('./routes/serviceRoutes');
const hotelRoomRoutes = require('./routes/hotelRoomRoutes');
const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true
}));


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/user/orders', userOrderRoutes);
app.use('/partner', partnerRoutes);
app.use('/orders', orderRoutes);
app.use('/payments', paymentRoutes);
app.use('/coupons', couponRoutes);
app.use('/partner/orders', partnerOrderRoutes);
app.use('/admin', adminRoutes);
app.use('/orders', ratingRoutes);
app.use('/', productRoutes);
app.use('/api/search', searchRoutes);
app.use('/api', serviceRoutes);
app.use('/api', hotelRoomRoutes);

// ✅ Centralized error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    ok: false,
    message: 'Internal server error',
    error: err.message
  });
});

const server = http.createServer(app);

// ✅ Configure Socket.IO CORS for same origin
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
  }
});

app.set('io', io);

// ✅ Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('Client connected:', socket.id);

  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      console.log('No token provided for socket');
      socket.disconnect();
      return;
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    const payload = jwt.verify(token, JWT_SECRET);

    let user = null;
    if (payload.partnerId) {
      // Partner
      user = { _id: payload.partnerId, role: 'partner' };
    } else if (payload.userId) {
      // User
      user = { _id: payload.userId, role: 'customer' };
    } else if (payload.adminId) {
      // Admin
      user = { _id: payload.adminId, role: 'admin' };
    } else {
      console.log('Invalid token payload for socket');
      socket.disconnect();
      return;
    }

    // Join rooms
    joinOrderRooms(io, socket.id, user);

    // For admin, emit all orders
    if (user.role === 'admin') {
      const orders = await Order.find({}).sort({ createdAt: -1 });
      const allOrders = orders.map((order) => serializeOrder(order));
      socket.emit('orders:init', allOrders);
    }

    // For partners, emit current orders
    if (user.role === 'partner') {
      const orders = await Order.find({}).sort({ createdAt: -1 });
      const allOrders = orders.map((order) => serializeOrder(order));
      socket.emit('orders:init', allOrders);
    }

    // For customers, emit their orders
    if (user.role === 'customer') {
      const orders = await Order.find({ user: user._id }).sort({ createdAt: -1 });
      const allOrders = orders.map((order) => serializeOrder(order));
      socket.emit('orders:init', allOrders);
    }

    // 📍 Live Location Tracking
    socket.on('rider:location', async ({ orderId, latitude, longitude }) => {
      try {
        const order = await Order.findOne({ orderId }).select('user');
        if (order) {
           const { ORDER_ROOM_PREFIX } = require('./services/orderHelper');
           const userRoom = `${ORDER_ROOM_PREFIX}${order.user.toString()}`;
           
           // Broadcast to the specific customer and admins/partners
           io.to(userRoom).emit('rider:location-update', { orderId, latitude, longitude });
           io.to('orders:admin').emit('rider:location-update', { orderId, latitude, longitude });
           io.to('orders:partner').emit('rider:location-update', { orderId, latitude, longitude });
           
           console.log(`Rider location update for ${orderId}: ${latitude}, ${longitude} sent to ${userRoom}`);
        }
      } catch (err) {
        console.error('Error broadcasting rider location:', err);
      }
    });

  } catch (err) {
    console.log('Socket auth error:', err.message);
    socket.disconnect();
  }

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;

connectDB(process.env.MONGO_URI)
  .then(() => {
    server.listen(PORT, () => console.log(`✅ Server started on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ DB connect error:', err);
  });
