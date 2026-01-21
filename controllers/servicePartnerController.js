const ServicePartner = require('../models/ServicePartner');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cloudinary = require('../config/cloudinary');
const { serializeOrder, applyStatusChange } = require('../services/orderStatus');
const { emitOrderEvent } = require('../services/orderHelper');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

async function uploadToCloudinary(buffer, folder = 'service_partners') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

exports.register = async (req, res) => {
  try {
    const {
      name, phone, email, addharNumber, panNumber, highestQualification,
      city, state, completeAddress, pincode, category,
      bankName, ifscCode, branchName, accountNumber,
      guarenterName, guarenterEmail, guarenterPhone, guarenterAddress, guarenterRelation
    } = req.body;

    // Required fields check
    if (!name || !email || !phone || !completeAddress || !city || !state || !category) {
      return res.status(400).json({ ok: false, message: 'Required fields are missing' });
    }

    const existingPartner = await ServicePartner.findOne({ $or: [{ phone }, { email }] });
    if (existingPartner) {
      return res.status(400).json({ ok: false, message: 'Partner already registered with this phone or email' });
    }

    const documents = {};
    if (req.files) {
      if (req.files.addharFrontImage) {
        documents.addharFrontImage = await uploadToCloudinary(req.files.addharFrontImage[0].buffer);
      }
      if (req.files.addharBackImage) {
        documents.addharBackImage = await uploadToCloudinary(req.files.addharBackImage[0].buffer);
      }
      if (req.files.panImage) {
        documents.panImage = await uploadToCloudinary(req.files.panImage[0].buffer);
      }
      if (req.files.degreeImage) {
        documents.degreeImage = await uploadToCloudinary(req.files.degreeImage[0].buffer);
      }
    }

    const servicePartner = new ServicePartner({
      name, phone, email, addharNumber, panNumber, highestQualification,
      city, state, completeAddress, pincode, category,
      bankDetails: { bankName, ifscCode, branchName, accountNumber },
      documents,
      guarenter: {
        name: guarenterName,
        email: guarenterEmail,
        phone: guarenterPhone,
        address: guarenterAddress,
        relation: guarenterRelation
      }
    });

    await servicePartner.save();
    console.log('Service Partner saved successfully:', servicePartner._id);

    const token = jwt.sign({ partnerId: servicePartner._id, role: 'servicePartner' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({ ok: true, message: 'Registered successfully', token, servicePartner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ ok: false, message: 'Phone number is required' });

    const servicePartner = await ServicePartner.findOne({ phone });
    if (!servicePartner) {
      return res.status(404).json({ ok: false, message: 'Partner not found. Please register first.' });
    }

    const token = jwt.sign({ partnerId: servicePartner._id, role: 'servicePartner' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({ ok: true, message: 'Login successful', token, servicePartner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const partnerId = req.servicePartner.partnerId;
    const partner = await ServicePartner.findById(partnerId);
    if (!partner) return res.status(404).json({ ok: false, message: 'Partner not found' });

    // Find orders that match the partner's category and are either:
    // 1. Pending (available to accept)
    // 2. Already assigned to this partner (Accepted/Rejected/etc)
    let query = {
      $and: [
        {
          $or: [
            { category: partner.category },
            { "items.category": partner.category }
          ]
        },
        {
          $or: [
            { status: 'Pending' },
            { servicePartner: partnerId }
          ]
        }
      ]
    };

    // Even with debug=true, we MUST filter by the partner's category
    if (req.query.debug === 'true') {
      query = {
        $or: [
          { category: partner.category },
          { "items.category": partner.category }
        ]
      };
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });

    const serializedOrders = orders.map(o => {
      const serialized = serializeOrder(o);
      // Dynamic fallback for category if it's null in DB
      if (!serialized.category && serialized.items && serialized.items.length > 0) {
        serialized.category = serialized.items[0].category;
      }
      return serialized;
    });

    res.json({ 
      ok: true, 
      partnerCategory: partner.category,
      orders: serializedOrders 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};

exports.getOrderStats = async (req, res) => {
  try {
    const partnerId = req.servicePartner.partnerId;
    const partner = await ServicePartner.findById(partnerId);
    if (!partner) return res.status(404).json({ ok: false, message: 'Partner not found' });

    // 1. Available Orders (Pending in their category)
    const pendingCount = await Order.countDocuments({
      category: partner.category,
      status: 'Pending',
      servicePartner: null
    });

    // 2. Accepted Orders (Assigned to them and not cancelled)
    const acceptedCount = await Order.countDocuments({
      servicePartner: partnerId,
      status: { $nin: ['Cancelled', 'Pending'] }
    });

    // 3. Rejected/Cancelled Orders (Assigned to them but cancelled)
    const rejectedCount = await Order.countDocuments({
      servicePartner: partnerId,
      status: 'Cancelled'
    });

    res.json({
      ok: true,
      stats: {
        pending: pendingCount,
        accepted: acceptedCount,
        rejected: rejectedCount,
        totalAssigned: acceptedCount + rejectedCount
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const partnerId = req.servicePartner.partnerId;
    
    // Find all orders assigned to this partner
    const orders = await Order.find({ servicePartner: partnerId }).sort({ createdAt: -1 });

    const payments = orders.map(o => ({
      orderId: o.orderId,
      amount: o.pricing.grandTotal,
      method: o.payment.method,
      status: o.payment.status,
      date: o.createdAt
    }));

    const summary = orders.reduce((acc, o) => {
      const amount = o.pricing.grandTotal || 0;
      if (o.payment.status === 'Done') {
        acc.complete += amount;
      } else if (o.payment.status === 'Failed') {
        acc.failed += amount;
      } else {
        acc.pending += amount;
      }
      return acc;
    }, { pending: 0, complete: 0, failed: 0 });

    res.json({
      ok: true,
      summary,
      payments
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const partnerId = req.servicePartner.partnerId;
    const { orderId } = req.params;
    const { status } = req.body;

    if (!['Accepted', 'Cancelled', 'Delivered', 'OutForDelivery'].includes(status)) {
      return res.status(400).json({ ok: false, message: 'Invalid status for service partner' });
    }

    const order = await Order.findOne({ $or: [{ orderId }, { _id: mongoose.Types.ObjectId.isValid(orderId) ? orderId : null }] });
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

    // If accepting, set the servicePartner field
    if (status === 'Accepted') {
      if (order.status !== 'Pending') {
        return res.status(400).json({ ok: false, message: 'Order already processed' });
      }
      order.servicePartner = partnerId;
    } else {
      // For other statuses, verify this partner is the one assigned
      if (order.servicePartner?.toString() !== partnerId) {
        return res.status(403).json({ ok: false, message: 'Not authorized to update this order' });
      }
    }

    await applyStatusChange({
      order,
      status,
      actor: {
        type: 'servicePartner',
        id: partnerId,
        role: 'servicePartner'
      }
    });

    const io = req.app.get('io');
    // Notify user and admins
    emitOrderEvent(io, 'orders:status', { orderId: order.orderId, status: order.status }, order.user);

    res.json({ ok: true, message: `Order ${status.toLowerCase()} successfully`, order: serializeOrder(order) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
};
