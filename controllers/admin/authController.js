const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Admin = require('../../models/Admin');

const ACCESS_SECRET = process.env.JWT_SECRET || 'fallback_access_secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';

// 🔐 Generate Access Token
const createAccessToken = (payload) => {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' });
};

// 🔁 Generate Refresh Token
const createRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

//  Admin Login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin not found' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    const accessToken = createAccessToken({ _id: admin._id, email: admin.email });
    const refreshToken = createRefreshToken();

    admin.refreshTokens.push(refreshToken);
    await admin.save();

    // 🍪 Set access token in httpOnly cookie (15m)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 15 * 60 * 1000,
    });

    // 🍪 Set refresh token (30d)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, message: 'Login successful' });
  } catch (err) {
    console.error('🔐 Login Error:', err.message);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// 🔁 Refresh Access Token
exports.refreshAccessToken = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ success: false, message: 'No refresh token provided' });
  }

  try {
    const admin = await Admin.findOne({ refreshTokens: refreshToken });

    if (!admin) {
      return res.status(403).json({ success: false, message: 'Invalid refresh token' });
    }

    const newAccessToken = createAccessToken({ _id: admin._id, email: admin.email });

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 15 * 60 * 1000,
    });

    res.json({ success: true, message: 'Access token refreshed' });
  } catch (err) {
    console.error('🔁 Refresh Error:', err.message);
    res.status(500).json({ success: false, message: 'Could not refresh access token' });
  }
};

//  Check Session from httpOnly accessToken cookie
exports.checkSession = async (req, res) => {
  try {
    const token = req.cookies?.accessToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, ACCESS_SECRET);
    return res.json({ success: true, user: decoded });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session invalid or expired' });
  }
};

// 🔓 Admin Logout
exports.logout = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  try {
    if (refreshToken) {
      const admin = await Admin.findOne({ refreshTokens: refreshToken });
      if (admin) {
        admin.refreshTokens = admin.refreshTokens.filter(t => t !== refreshToken);
        await admin.save();
      }
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
    });

    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
    });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('🔓 Logout Error:', err.message);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
};

// 🆕 Register New Admin
exports.register = async (req, res) => {
  const { email, password } = req.body;

  try {
    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Admin already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await Admin.create({ email, password: hashedPassword, refreshTokens: [] });

    res.json({ success: true, message: 'Admin registered successfully' });
  } catch (err) {
    console.error('🆕 Register Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to register admin' });
  }
};
