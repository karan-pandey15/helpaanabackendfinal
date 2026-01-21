const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ ok: false, message: 'Authorization header missing' });

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ ok: false, message: 'Invalid auth header' });
    }

    const token = parts[1];
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload.partnerId || payload.role !== 'servicePartner') {
      return res.status(401).json({ ok: false, message: 'Invalid token payload or role' });
    }

    req.servicePartner = payload;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: 'Invalid or expired token' });
  }
};
