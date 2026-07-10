// routes/api.js
// All public and protected admin routes. Every DB query is parameterized.
// Input validation/sanitization via express-validator. Tight rate limits on
// sensitive endpoints (admin login, application submissions, donation requests).
// Puppy images are now handled as real file uploads via multer (see UPLOAD
// SYSTEM section below) instead of requiring the admin to paste an image URL.

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const { db } = require('../config/db');
const { requireAdminAuth, JWT_SECRET } = require('../middleware/auth');

// -----------------------------------------------------------------------------
// Valid payment methods (must match the CHECK constraint in config/db.js)
// -----------------------------------------------------------------------------
const VALID_PAYMENT_METHODS = [
  'PayPal (Family and Friends)',
  'Chime',
  'Apple Pay',
  'Gift Card',
  'Cash App',
  'Venmo',
  'Bank Transfer'
];

// -----------------------------------------------------------------------------
// UPLOAD SYSTEM: multer configuration for puppy photo uploads
//
// Files are written to /public/uploads/, which Express already serves as
// static content (see server.js), so a saved file at
//   /public/uploads/1735689600000-golden_pup.jpg
// is reachable in the browser at
//   /uploads/1735689600000-golden_pup.jpg
// and that relative path string is exactly what gets stored in the
// puppies.image_url database column. It renders identically on localhost and
// on a live host, since it's just a same-origin relative URL - no hardcoded
// domain, no absolute filesystem path ever touches the browser or the DB.
// -----------------------------------------------------------------------------
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

// Ensure the upload directory exists before multer ever tries to write to it
// (matters on a fresh clone/deploy where the folder might not exist yet).
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Strip anything that isn't alphanumeric/dot/dash/underscore from the
    // original filename, then prefix with a timestamp so two admins
    // uploading "puppy.jpg" at different times never collide.
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, Date.now() + '-' + sanitizedOriginalName);
  }
});

function imageFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const isAllowedExtension = ALLOWED_IMAGE_EXTENSIONS.includes(ext);
  const isAllowedMimeType = file.mimetype.startsWith('image/');

  if (isAllowedExtension && isAllowedMimeType) {
    return cb(null, true);
  }
  cb(new Error('Only image files (JPG, PNG, GIF, WEBP) are allowed.'));
}

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB per file
});

// Deletes a previously-uploaded file from disk, but only if it's one of ours
// (a relative /uploads/... path). Seed puppies use external Unsplash URLs and
// must never be touched by this - only files we actually wrote get deleted.
function deleteUploadedFileIfLocal(imageUrl) {
  if (typeof imageUrl === 'string' && imageUrl.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, '..', 'public', imageUrl);
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        console.error('Failed to delete old upload:', err.message);
      }
    });
  }
}

// -----------------------------------------------------------------------------
// Rate limiters for sensitive endpoints
// -----------------------------------------------------------------------------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' }
});

const applicationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many applications submitted from this IP. Please try again later.' }
});

const donationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many donation requests submitted from this IP. Please try again later.' }
});

// -----------------------------------------------------------------------------
// Helper: run a validation chain and bail out with 400 on failure
// -----------------------------------------------------------------------------
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input.', details: errors.array() });
  }
  next();
}

// Same as handleValidation, but also deletes an already-written upload if
// validation fails afterward - prevents orphaned files piling up in
// /public/uploads/ every time an admin submits a form with a typo.
function handleValidationWithFileCleanup(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(400).json({ error: 'Invalid input.', details: errors.array() });
  }
  next();
}

// Converts multer errors (file too large, bad file type, etc.) into clean
// JSON responses instead of letting them fall through as raw 500s.
function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Image file is too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: 'File upload error: ' + err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'File upload failed.' });
  }
  next();
}

/* =============================================================================
   PUBLIC ROUTES
============================================================================= */

// GET /api/puppies -> list all puppies, optional ?category=Adoption|Rescue filter
router.get('/puppies', (req, res) => {
  const { category } = req.query;

  if (category && !['Adoption', 'Rescue'].includes(category)) {
    return res.status(400).json({ error: 'Invalid category filter.' });
  }

  const sql = category
    ? 'SELECT * FROM puppies WHERE category = ? ORDER BY created_at DESC'
    : 'SELECT * FROM puppies ORDER BY created_at DESC';
  const params = category ? [category] : [];

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch puppies.' });
    res.json({ puppies: rows });
  });
});

// GET /api/puppies/:id -> single puppy detail
router.get(
  '/puppies/:id',
  [param('id').isInt().withMessage('Puppy ID must be an integer.')],
  handleValidation,
  (req, res) => {
    db.get('SELECT * FROM puppies WHERE id = ?', [req.params.id], (err, row) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch puppy.' });
      if (!row) return res.status(404).json({ error: 'Puppy not found.' });
      res.json({ puppy: row });
    });
  }
);

// POST /api/applications -> submit an adoption application for a specific puppy
router.post(
  '/applications',
  applicationLimiter,
  [
    body('puppy_id').isInt().withMessage('A valid puppy_id is required.'),
    body('full_name').trim().notEmpty().escape().isLength({ max: 150 }).withMessage('Full name is required.'),
    body('email').trim().isEmail().normalizeEmail().withMessage('A valid email is required.'),
    body('phone').trim().notEmpty().escape().isLength({ max: 30 }).withMessage('Phone number is required.'),
    body('household_details')
      .trim()
      .notEmpty()
      .escape()
      .isLength({ max: 2000 })
      .withMessage('Household details are required.'),
    body('prior_experience')
      .trim()
      .notEmpty()
      .escape()
      .isLength({ max: 2000 })
      .withMessage('Prior dog experience details are required.')
  ],
  handleValidation,
  (req, res) => {
    const { puppy_id, full_name, email, phone, household_details, prior_experience } = req.body;

    db.get('SELECT id FROM puppies WHERE id = ?', [puppy_id], (err, puppy) => {
      if (err) return res.status(500).json({ error: 'Failed to verify puppy.' });
      if (!puppy) return res.status(404).json({ error: 'Puppy not found.' });

      db.run(
        `INSERT INTO applications
          (puppy_id, full_name, email, phone, household_details, prior_experience)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [puppy_id, full_name, email, phone, household_details, prior_experience],
        function (insertErr) {
          if (insertErr) return res.status(500).json({ error: 'Failed to submit application.' });
          res.status(201).json({
            message: 'Application submitted successfully! We will be in touch soon.',
            applicationId: this.lastID
          });
        }
      );
    });
  }
);

// POST /api/donations -> submit a donation request (name, email, amount, payment method)
router.post(
  '/donations',
  donationLimiter,
  [
    body('donor_name').trim().notEmpty().escape().isLength({ max: 150 }).withMessage('Full name is required.'),
    body('donor_email').trim().isEmail().normalizeEmail().withMessage('A valid email is required.'),
    body('amount')
      .isFloat({ min: 1 })
      .withMessage('Amount must be a number of at least 1.'),
    body('payment_method')
      .trim()
      .isIn(VALID_PAYMENT_METHODS)
      .withMessage('Please select a valid payment method.')
  ],
  handleValidation,
  (req, res) => {
    const { donor_name, donor_email, amount, payment_method } = req.body;

    db.run(
      `INSERT INTO donations (donor_name, donor_email, amount, payment_method) VALUES (?, ?, ?, ?)`,
      [donor_name, donor_email, amount, payment_method],
      function (insertErr) {
        if (insertErr) return res.status(500).json({ error: 'Failed to submit donation request.' });
        res.status(201).json({
          message: 'Thank you! Your donation request has been submitted — our team will follow up with payment instructions.',
          donationId: this.lastID
        });
      }
    );
  }
);

/* =============================================================================
   ADMIN AUTH ROUTES
============================================================================= */

// POST /api/admin/login -> verify credentials, issue HTTP-Only JWT cookie
router.post(
  '/admin/login',
  loginLimiter,
  [
    body('username').trim().notEmpty().escape().withMessage('Username is required.'),
    body('password').notEmpty().withMessage('Password is required.')
  ],
  handleValidation,
  (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM admins WHERE username = ?', [username], (err, admin) => {
      if (err) return res.status(500).json({ error: 'Login failed. Please try again.' });
      if (!admin) return res.status(401).json({ error: 'Invalid username or password.' });

      bcrypt.compare(password, admin.password_hash, (compareErr, isMatch) => {
        if (compareErr) return res.status(500).json({ error: 'Login failed. Please try again.' });
        if (!isMatch) return res.status(401).json({ error: 'Invalid username or password.' });

        const token = jwt.sign({ id: admin.id, username: admin.username, role: 'admin' }, JWT_SECRET, {
          expiresIn: '2h'
        });

        res.cookie('admin_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 2 * 60 * 60 * 1000 // 2 hours
        });

        res.json({ message: 'Login successful.', username: admin.username });
      });
    });
  }
);

// POST /api/admin/logout -> clear the auth cookie
router.post('/admin/logout', (req, res) => {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ message: 'Logged out successfully.' });
});

// GET /api/admin/me -> check current session validity
router.get('/admin/me', requireAdminAuth, (req, res) => {
  res.json({ username: req.admin.username });
});

/* =============================================================================
   PROTECTED ADMIN ROUTES (require valid JWT cookie)
============================================================================= */

// GET /api/admin/metrics -> dashboard summary metrics
router.get('/admin/metrics', requireAdminAuth, (req, res) => {
  db.get('SELECT COUNT(*) AS totalPuppies FROM puppies', (err, puppyRow) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch metrics.' });

    db.get(
      "SELECT COUNT(*) AS pendingApplications FROM applications WHERE status = 'Pending'",
      (appErr, appRow) => {
        if (appErr) return res.status(500).json({ error: 'Failed to fetch metrics.' });

        db.get('SELECT COUNT(*) AS totalApplications FROM applications', (totalErr, totalRow) => {
          if (totalErr) return res.status(500).json({ error: 'Failed to fetch metrics.' });

          db.get(
            "SELECT COUNT(*) AS pendingDonations FROM donations WHERE status = 'Pending'",
            (donationErr, donationRow) => {
              if (donationErr) return res.status(500).json({ error: 'Failed to fetch metrics.' });

              res.json({
                totalPuppies: puppyRow.totalPuppies,
                pendingApplications: appRow.pendingApplications,
                totalApplications: totalRow.totalApplications,
                pendingDonations: donationRow.pendingDonations
              });
            }
          );
        });
      }
    );
  });
});

// GET /api/admin/puppies -> full puppy list for the admin table
router.get('/admin/puppies', requireAdminAuth, (req, res) => {
  db.all('SELECT * FROM puppies ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch puppies.' });
    res.json({ puppies: rows });
  });
});

// POST /api/admin/puppies -> create a new puppy listing (multipart/form-data with an image file)
router.post(
  '/admin/puppies',
  requireAdminAuth,
  upload.single('image'),
  handleUploadErrors,
  [
    body('name').trim().notEmpty().escape().isLength({ max: 100 }).withMessage('Name is required.'),
    body('age').trim().notEmpty().escape().isLength({ max: 50 }).withMessage('Age is required.'),
    body('category')
      .trim()
      .isIn(['Adoption', 'Rescue'])
      .withMessage("Category must be 'Adoption' or 'Rescue'."),
    body('description')
      .trim()
      .notEmpty()
      .escape()
      .isLength({ max: 3000 })
      .withMessage('Description is required.')
  ],
  handleValidationWithFileCleanup,
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'A puppy photo is required.' });
    }

    const { name, age, category, description } = req.body;
    const image_url = '/uploads/' + req.file.filename;

    db.run(
      `INSERT INTO puppies (name, age, category, description, image_url) VALUES (?, ?, ?, ?, ?)`,
      [name, age, category, description, image_url],
      function (err) {
        if (err) {
          // DB insert failed after the file was already written - clean it up
          fs.unlink(req.file.path, () => {});
          return res.status(500).json({ error: 'Failed to create puppy listing.' });
        }
        res.status(201).json({ message: 'Puppy created successfully.', puppyId: this.lastID, image_url });
      }
    );
  }
);

// PUT /api/admin/puppies/:id -> edit an existing puppy listing. The photo is
// optional on edit: if no new file is uploaded, the existing image is kept.
router.put(
  '/admin/puppies/:id',
  requireAdminAuth,
  upload.single('image'),
  handleUploadErrors,
  [
    param('id').isInt().withMessage('Puppy ID must be an integer.'),
    body('name').trim().notEmpty().escape().isLength({ max: 100 }).withMessage('Name is required.'),
    body('age').trim().notEmpty().escape().isLength({ max: 50 }).withMessage('Age is required.'),
    body('category')
      .trim()
      .isIn(['Adoption', 'Rescue'])
      .withMessage("Category must be 'Adoption' or 'Rescue'."),
    body('description')
      .trim()
      .notEmpty()
      .escape()
      .isLength({ max: 3000 })
      .withMessage('Description is required.')
  ],
  handleValidationWithFileCleanup,
  (req, res) => {
    const { name, age, category, description } = req.body;

    db.get('SELECT image_url FROM puppies WHERE id = ?', [req.params.id], (fetchErr, existingPuppy) => {
      if (fetchErr) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(500).json({ error: 'Failed to update puppy listing.' });
      }
      if (!existingPuppy) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'Puppy not found.' });
      }

      // Keep the existing photo unless the admin uploaded a replacement
      const image_url = req.file ? '/uploads/' + req.file.filename : existingPuppy.image_url;

      db.run(
        `UPDATE puppies SET name = ?, age = ?, category = ?, description = ?, image_url = ? WHERE id = ?`,
        [name, age, category, description, image_url, req.params.id],
        function (updateErr) {
          if (updateErr) {
            if (req.file) fs.unlink(req.file.path, () => {});
            return res.status(500).json({ error: 'Failed to update puppy listing.' });
          }

          // Only delete the old file once the new one is safely saved in the DB
          if (req.file) {
            deleteUploadedFileIfLocal(existingPuppy.image_url);
          }

          res.json({ message: 'Puppy updated successfully.', image_url });
        }
      );
    });
  }
);

// DELETE /api/admin/puppies/:id -> remove a puppy listing and its uploaded photo
router.delete(
  '/admin/puppies/:id',
  requireAdminAuth,
  [param('id').isInt().withMessage('Puppy ID must be an integer.')],
  handleValidation,
  (req, res) => {
    db.get('SELECT image_url FROM puppies WHERE id = ?', [req.params.id], (fetchErr, existingPuppy) => {
      if (fetchErr) return res.status(500).json({ error: 'Failed to delete puppy.' });
      if (!existingPuppy) return res.status(404).json({ error: 'Puppy not found.' });

      db.run('DELETE FROM puppies WHERE id = ?', [req.params.id], function (deleteErr) {
        if (deleteErr) return res.status(500).json({ error: 'Failed to delete puppy.' });

        deleteUploadedFileIfLocal(existingPuppy.image_url);

        res.json({ message: 'Puppy deleted successfully.' });
      });
    });
  }
);

// GET /api/admin/applications -> full application list joined with puppy info
router.get('/admin/applications', requireAdminAuth, (req, res) => {
  const sql = `
    SELECT
      applications.id AS id,
      applications.full_name AS full_name,
      applications.email AS email,
      applications.phone AS phone,
      applications.household_details AS household_details,
      applications.prior_experience AS prior_experience,
      applications.status AS status,
      applications.created_at AS created_at,
      puppies.id AS puppy_id,
      puppies.name AS puppy_name,
      puppies.category AS puppy_category
    FROM applications
    JOIN puppies ON applications.puppy_id = puppies.id
    ORDER BY applications.created_at DESC
  `;

  db.all(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch applications.' });
    res.json({ applications: rows });
  });
});

// PUT /api/admin/applications/:id/status -> update an application's review status
router.put(
  '/admin/applications/:id/status',
  requireAdminAuth,
  [
    param('id').isInt().withMessage('Application ID must be an integer.'),
    body('status')
      .trim()
      .isIn(['Pending', 'Reviewed', 'Approved', 'Denied'])
      .withMessage('Invalid status value.')
  ],
  handleValidation,
  (req, res) => {
    db.run(
      'UPDATE applications SET status = ? WHERE id = ?',
      [req.body.status, req.params.id],
      function (err) {
        if (err) return res.status(500).json({ error: 'Failed to update application status.' });
        if (this.changes === 0) return res.status(404).json({ error: 'Application not found.' });
        res.json({ message: 'Application status updated.' });
      }
    );
  }
);

// GET /api/admin/donations -> full donation request list
router.get('/admin/donations', requireAdminAuth, (req, res) => {
  db.all('SELECT * FROM donations ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch donations.' });
    res.json({ donations: rows });
  });
});

// PUT /api/admin/donations/:id/status -> update a donation request's status
router.put(
  '/admin/donations/:id/status',
  requireAdminAuth,
  [
    param('id').isInt().withMessage('Donation ID must be an integer.'),
    body('status')
      .trim()
      .isIn(['Pending', 'Contacted', 'Completed'])
      .withMessage('Invalid status value.')
  ],
  handleValidation,
  (req, res) => {
    db.run(
      'UPDATE donations SET status = ? WHERE id = ?',
      [req.body.status, req.params.id],
      function (err) {
        if (err) return res.status(500).json({ error: 'Failed to update donation status.' });
        if (this.changes === 0) return res.status(404).json({ error: 'Donation not found.' });
        res.json({ message: 'Donation status updated.' });
      }
    );
  }
);

module.exports = router;
