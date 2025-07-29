const User = require('../models/User');

// Check if user is authenticated
const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  } else {
    return res.status(401).json({ message: 'Authentication required' });
  }
};

// Check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get current user
const getCurrentUser = async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    next();
  }
};

// Check role middleware factory
const checkRole = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const user = await User.findById(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      if (!roles.includes(user.role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      req.user = user;
      next();
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  };
};

module.exports = {
  requireAuth,
  requireAdmin,
  getCurrentUser,
  checkRole
};