const mongoose = require('mongoose');

const dbCheck = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ 
      message: 'Database connection not available. Please check if MongoDB is running.',
      error: 'MongoDB not connected'
    });
  }
  next();
};

module.exports = dbCheck;
