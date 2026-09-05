
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ✅ SAME auth middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.id).select('-password');

    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.isBlocked) return res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
    if (decoded.version !== user.tokenVersion) return res.status(401).json({ message: 'Token is revoked' });

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// ✅ Optional Auth middleware (does not reject if no token)
auth.optional = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (user && !user.isBlocked && decoded.version === user.tokenVersion) {
        req.user = user;
      }
    }
  } catch (error) {} // Ignore errors, just proceed as guest
  next();
};

// ✅ Updated Admin middleware (allows admin, superadmin, and support staff)
auth.admin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.role === 'support')) {
    next();
  } else {
    res.status(403).json({ message: 'Admin access only' });
  }
};

// ✅ Support middleware (allows support, admin, superadmin)
auth.support = (req, res, next) => {
  if (req.user && (req.user.role === 'support' || req.user.role === 'admin' || req.user.role === 'superadmin')) {
    next();
  } else {
    res.status(403).json({ message: 'Support access only' });
  }
};

// ✅ Super Admin only middleware (allows superadmin, admin, and support staff)
auth.superadmin = (req, res, next) => {
  if (req.user && (req.user.role === 'superadmin' || req.user.role === 'admin' || req.user.role === 'support')) {
    next();
  } else {
    res.status(403).json({ message: 'Super Admin access only' });
  }
};

// ✅ Permission-specific middleware (All permissions on for admin & support staff)
auth.hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    
    // Superadmin, Admin, and Support staff have all permissions enabled by default
    if (req.user.role === 'superadmin' || req.user.role === 'admin' || req.user.role === 'support') {
      return next();
    }
    
    // Check specific permission
    if (req.user.permissions?.includes(permission) || req.user.permissions?.includes('all')) {
      return next();
    }
    
    res.status(403).json({ 
      message: `Access denied. You need '${permission}' permission to perform this action.` 
    });
  };
};

module.exports = auth;
