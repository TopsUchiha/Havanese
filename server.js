// server.js
// Core Express application: security middleware, static file serving, route mounting,
// and a global error-catching wrapper. Run with: node server.js

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { initializeDatabase } = require('./config/db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// -----------------------------------------------------------------------------
// Path Normalization: Ensures ADMIN_PATH always formats correctly with a leading slash
// -----------------------------------------------------------------------------
const rawAdminPath = process.env.ADMIN_PATH || 'portal-x7k2m9qz-manage';
const ADMIN_PATH = rawAdminPath.startsWith('/') 
  ? rawAdminPath.replace(/\/+$/, '') 
  : `/${rawAdminPath.replace(/\/+$/, '')}`;

// Trust reverse proxy (Render)
app.set('trust proxy', 1);

// Security: Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.tailwindcss.com', "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", 'https://cdn.tailwindcss.com', "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'https://images.unsplash.com', 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"]
      }
    },
    frameguard: { action: 'deny' },
    crossOriginEmbedderPolicy: false
  })
);

// Security: CORS
const isLocalhostOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    const sameOrigin = `${req.protocol}://${req.get('host')}`;

    const isAllowed = !origin || origin === sameOrigin || isLocalhostOrigin(origin);

    callback(null, {
      origin: isAllowed,
      credentials: true
    });
  })
);

// Body parsing & cookies
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP. Please try again later.' }
});
app.use(globalLimiter);

// Static file serving
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', apiRoutes);

// Admin dashboard route - strictly matches the sanitized path string
app.get(ADMIN_PATH, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Explicit public page route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Global error-catching wrapper
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Cross-origin request blocked.' });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message
  });
});

// Startup initialization
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Havanese Adoption & Rescue site running at http://localhost:${PORT}`);
      console.log(`Admin dashboard compiled at: http://localhost:${PORT}${ADMIN_PATH}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

module.exports = app;