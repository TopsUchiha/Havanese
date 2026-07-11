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
// Trust the reverse proxy (Render, and most PaaS hosts, sit in front of your
// app and terminate TLS there). Without this, req.protocol always reports
// 'http' even when the browser connected over https - which breaks the
// same-origin check in the CORS config below and would silently reintroduce
// the exact "Cross-origin request blocked" error this fixes.
// -----------------------------------------------------------------------------
app.set('trust proxy', 1);

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
    frameguard: { action: 'deny' },
    crossOriginEmbedderPolicy: false
  })
);

// -----------------------------------------------------------------------------
// Security: CORS
//
// THE ACTUAL FIX for "Cross-origin request blocked" on Render:
// The frontend fetch() calls were always relative paths (e.g. '/api/puppies')
// - never hardcoded to localhost. The real bug was here: the old CORS config
// only whitelisted http://localhost/http://127.0.0.1, so once the exact same
// same-origin request arrived from https://havanese.onrender.com, it got
// rejected because that origin literally wasn't on the list.
//
// The fix: since this app always serves its own frontend AND its own API
// from the same domain, we don't need a hardcoded domain list at all - we
// just compare the browser's reported Origin header against the domain the
// request actually arrived on (req.protocol + req.get('host')). That check
// is correct on localhost, on the Render default domain, and on any custom
// domain added later, with zero configuration required.
// -----------------------------------------------------------------------------
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
  windowMs: 15 * 60 * 1000,
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
// Admin dashboard route - deliberately NOT at /admin
//
// SECURITY NOTE (read this before deploying): the path below is set via the
// ADMIN_PATH environment variable, with a fallback default for local dev
// only. If you deploy this to a public GitHub repo, DO NOT rely on the
// fallback value - anyone can read it straight out of your source code on
// GitHub, which defeats the entire point of hiding it. Set your own
// ADMIN_PATH environment variable in your Render dashboard (never commit it
// to git) so the real path only exists in your deployment config.
//
// Also worth being honest about: this is obscurity, not security. The actual
// defense against brute-forcing is the rate limiter on /api/admin/login (5
// attempts / 15 minutes) plus bcrypt-hashed passwords. Moving the URL just
// stops casual/automated scanners that blindly try /admin, /wp-admin, etc.
// -----------------------------------------------------------------------------
const ADMIN_PATH = process.env.ADMIN_PATH || '/portal-x7k2m9qz-manage';

app.get(ADMIN_PATH, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// -----------------------------------------------------------------------------
// Explicit public page route
// -----------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -----------------------------------------------------------------------------
// 404 handler (also what a scanner hitting the old /admin path now gets)
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
// Startup: initialize DB (creates/migrates tables + seeds admin/puppies) then listen
// -----------------------------------------------------------------------------
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Havanese Adoption & Rescue site running at http://localhost:${PORT}`);
      console.log(`Admin dashboard at http://localhost:${PORT}${ADMIN_PATH}`);
      if (!process.env.ADMIN_PATH) {
        console.warn('WARNING: ADMIN_PATH env var not set - using the default fallback path. Set your own ADMIN_PATH before deploying publicly.');
      }
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

module.exports = app;
