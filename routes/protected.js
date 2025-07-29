const express = require('express');
const User = require('../models/User');
const { requireAuth, requireAdmin, checkRole } = require('../middleware/auth');

const router = express.Router();

// Protected dashboard route
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    res.json({
      message: 'Welcome to your dashboard!',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin only route
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    const userStats = {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.isActive).length,
      adminUsers: users.filter(u => u.role === 'admin').length,
      recentUsers: users.filter(u => {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return u.createdAt > dayAgo;
      }).length
    };

    res.json({
      message: 'Admin dashboard data',
      stats: userStats,
      users: users.slice(0, 10) // Return only first 10 users for demo
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// User profile route
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    res.json({
      profile: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        isActive: user.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile route
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { username, email } = req.body;
    const user = await User.findById(req.session.userId);

    if (username) user.username = username;
    if (email) user.email = email;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Username or email already exists' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

module.exports = router;