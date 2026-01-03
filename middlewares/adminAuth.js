// middlewares/adminAuth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ ok: false, message: 'Authorization header missing' });

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ ok: false, message: 'Invalid auth header' });

    const token = parts[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; 

    // Check if user exists and has admin role
    const user = await User.findById(payload.userId).select('role');
    if (!user) return res.status(401).json({ ok: false, message: 'User not found' });
    if (user.role !== 'admin') return res.status(403).json({ ok: false, message: 'Admin access required' });

    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: 'Invalid or expired token' });
  }
};