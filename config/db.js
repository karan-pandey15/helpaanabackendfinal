// config/db.js
const mongoose = require('mongoose');

const connectDB = async (uri) => {
  await mongoose.connect(uri, { 
  });
  console.log('MongoDB connected');
};

module.exports = connectDB;
