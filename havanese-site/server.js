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
// Security: Helmet - strict headers, clickjacking protection, CSP
//
// scriptSrcAttr stays set to 'unsafe-inline' so onclick/onerror attributes
// used throughout the vanilla-JS frontend continue to fire (Helmet blocks
// these by default under script-src-attr: 'none').
// -----------------------------------------------------------------------------
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
    frameguard: { action: 'deny' }, // Blocks Clickjacking via X-Frame-Options: DENY
    crossOriginEmbedderPolicy: false
  })
);

// -----------------------------------------------------------------------------
// Security: CORS - smooth for local dev, restrictive for unknown origins
// -----------------------------------------------------------------------------
const allowedOrigins = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. same-origin, curl, Postman on localhost)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

// -----------------------------------------------------------------------------
// Body parsing & cookies
// (multipart/form-data for file uploads is parsed separately by multer inside
// routes/api.js - it does not go through express.json()/urlencoded() below)
// -----------------------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// -----------------------------------------------------------------------------
// Security: Global rate limiting (tighter limits applied per-route in routes/api.js)
// -----------------------------------------------------------------------------
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP. Please try again later.' }
});
app.use(globalLimiter);

// -----------------------------------------------------------------------------
// Static file serving (public site, admin dashboard, uploaded puppy photos,
// robots.txt, and sitemap.xml all live under /public and are served here)
// -----------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------------------------------------------------------------
// API routes
// -----------------------------------------------------------------------------
app.use('/api', apiRoutes);

// -----------------------------------------------------------------------------
// Explicit page routes (multi-page layout)
// NOTE: /admin is intentionally NOT linked from anywhere in the public site's
// markup (see public/index.html). The route itself still exists and is
// reachable by URL - that's expected and fine, since real protection comes
// from the JWT-cookie login wall in routes/api.js, not from hiding the link.
// -----------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// -----------------------------------------------------------------------------
// 404 handler
// -----------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// -----------------------------------------------------------------------------
// Global error-catching wrapper
// -----------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Cross-origin request blocked.' });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message
  });
});

// -----------------------------------------------------------------------------
// Startup: initialize DB (creates tables + seeds admin/puppies) then listen
// -----------------------------------------------------------------------------
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Havanese Adoption & Rescue site running at http://localhost:${PORT}`);
      console.log(`Admin dashboard at http://localhost:${PORT}/admin`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

module.exports = app;
