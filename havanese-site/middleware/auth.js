// middleware/auth.js
// Verifies the HTTP-Only JWT cookie set on admin login and protects admin-only routes.

const jwt = require('jsonwebtoken');

// In a real deployment, set this via an environment variable instead of a hardcoded fallback.
const JWT_SECRET = process.env.JWT_SECRET || 'havanese-local-dev-secret-change-me';

function requireAdminAuth(req, res, next) {
  const token = req.cookies && req.cookies.admin_token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    }

    if (!decoded || decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admin privileges required.' });
    }

    req.admin = decoded;
    next();
  });
}

module.exports = { requireAdminAuth, JWT_SECRET };
