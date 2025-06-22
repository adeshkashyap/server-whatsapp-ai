const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'default_secret';

function verifyCookieToken(req, res, next) {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided in cookie' });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

module.exports = verifyCookieToken;
