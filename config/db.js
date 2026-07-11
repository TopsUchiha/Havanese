// config/db.js
// SQLite database configuration, schema auto-creation, migration, and seed data logic.
// This file guarantees the app is fully interactive on first run with zero manual setup.

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'havanese.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database at', DB_PATH);
});

// Enable foreign key constraint enforcement (SQLite disables this by default per connection)
db.run('PRAGMA foreign_keys = ON');

// -----------------------------------------------------------------------------
// Default admin credentials (change after first login in a real deployment)
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// Production-grade Admin Credentials loaded securely from Environment Variables
// -----------------------------------------------------------------------------
const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'HavaneseHavenAdmin_2026';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'u8X#mQz9!vK2$wP5*tY7&rE3_B9kL1sV';

// -----------------------------------------------------------------------------
// Seed puppies: 6 Adoption + 6 Rescue, each with a price (adoption fee /
// suggested rescue donation). Each frontend <img> has an onerror fallback,
// so even if an individual Unsplash URL ever goes stale, the layout never
// breaks or shows a broken icon.
// -----------------------------------------------------------------------------
const SEED_PUPPIES = [
  // ---------------------------- ADOPTION (6) ----------------------------
  {
    name: 'Biscuit',
    age: '10 weeks',
    category: 'Adoption',
    price: 1800,
    description:
      'Biscuit is a playful, silky-coated Havanese pup with a sweet, affectionate temperament. He loves belly rubs, short walks around the block, and curling up on laps during movie nights. Fully vet-checked, dewormed, and up to date on first vaccinations.',
    image_url:
      'https://images.unsplash.com/photo-1591768575198-88dac53fbd0a?w=1200&q=80&auto=format&fit=crop'
  },
  {
    name: 'Coco',
    age: '12 weeks',
    category: 'Adoption',
    price: 1750,
    description:
      'Coco is a curious and gentle Havanese girl who adores children and other dogs. She has a wavy chocolate-and-white coat, a bounce in her step, and a big personality packed into a small frame. Great for first-time dog owners.',
    image_url:
      'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=1200&q=80&auto=format&fit=crop'
  },
  {
    name: 'Waffles',
    age: '9 weeks',
    category: 'Adoption',
    price: 1650,
    description:
      'Waffles is a fluffy, golden-cream Havanese with a mellow, easygoing personality. He is crate-trained already, sleeps through the night, and gets along beautifully with cats. Perfect for a calm household looking for a low-key companion.',
    image_url:
      'https://images.unsplash.com/photo-1591160690555-5debfba289f0?w=1200&q=80&auto=format&fit=crop'
  },
  {
    name: 'Daisy',
    age: '11 weeks',
    category: 'Adoption',
    price: 1700,
    description:
      'Daisy is a spirited little explorer with a soft white-and-tan coat. She loves squeaky toys, short bursts of zoomies, and being carried around in a sling while her people run errands. Vet-checked and current on vaccinations.',
    image_url:
      'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1200&q=80&auto=format&fit=crop'
  },
  {
    name: 'Bentley',
    age: '13 weeks',
    category: 'Adoption',
    price: 1900,
    description:
      'Bentley is a confident, silky black-and-white Havanese pup who loves showing off for anyone who will watch. He already knows "sit" and "paw" and is quick to pick up new tricks. Ideal for an active family that loves training games.',
    image_url:
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=1200&q=80&auto=format&fit=crop'
  },
  {
    name: 'Poppy',
    age: '10 weeks',
    category: 'Adoption',
    price: 1800,
    description:
      'Poppy is a snuggly, apricot-colored Havanese with a gentle, people-pleasing nature. She thrives on attention and does best in a home where someone is around most of the day. Dewormed, vet-checked, and ready to meet her new family.',
    image_url:
      'https://images.unsplash.com/photo-1519098901909-b1553a1c1d2d?w=1200&q=80&auto=format&fit=crop'
  },

  // ---------------------------- RESCUE (6) ----------------------------
  {
    name: 'Milo',
    age: '2 years',
    category: 'Rescue',
    price: 250,
    description:
      'Milo was surrendered by his previous family due to a move and spent time in a local Atlanta shelter before being rescued. He is house-trained, gentle with strangers, and looking for a quiet, loving home to call his own. A little shy at first, but incredibly loyal once he warms up.',
    image_url:
      'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=1200&q=80&auto=format&fit=crop'
  },
  {
    name: 'Luna',
    age: '3 years',
    category: 'Rescue',
    price: 225,
    description:
      'Luna was rescued from a neglectful backyard breeding situation and has since blossomed into a joyful, resilient companion. She is spayed, current on all vaccinations, and thrives with gentle handling and a consistent routine. Luna would do best in a calm household.',
    image_url:
      'https://images.unsplash.com/photo-1517849845537-4d257902861a?w=1200&q=80&auto=format&fit=crop'
  },
  {
    name: 'Duke',
    age: '4 years',
    category: 'Rescue',
    price: 200,
    description:
      'Duke came to us after his senior owner could no longer care for him. He is calm, house-trained, and wonderful with older children. Duke enjoys slow neighborhood strolls and long naps in sunny spots by the window.',
    image_url:
      'https://images.unsplash.com/photo-1552053831-71594a27632d?w=1200&q=80&auto=format&fit=crop'
  },
  {
    name: 'Willow',
    age: '2.5 years',
    category: 'Rescue',
    price: 250,
    description:
      'Willow was found as a stray wandering near an Atlanta shopping center before being brought into our rescue network. She has since been spayed and vaccinated, and while reserved with new people at first, she forms deep, loyal bonds with her family.',
    image_url:
      'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=1200&q=80&auto=format&fit=crop'
  },
  {
    name: 'Gus',
    age: '5 years',
    category: 'Rescue',
    price: 175,
    description:
      'Gus was rescued from a hoarding situation and needed significant grooming and dental care upon intake - all of which has since been completed. He is now healthy, playful, and endlessly grateful for affection. Best suited to a patient, experienced dog owner.',
    image_url:
      'https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?w=1200&q=80&auto=format&fit=crop'
  },
  {
    name: 'Ruby',
    age: '3 years',
    category: 'Rescue',
    price: 225,
    description:
      'Ruby was surrendered to a shelter after a family relocation overseas made it impossible to bring her along. She is spayed, gentle with other dogs, and quick to warm up to new people with a few treats and some patience.',
    image_url:
      'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=1200&q=80&auto=format&fit=crop'
  }
];

// -----------------------------------------------------------------------------
// Schema creation
// -----------------------------------------------------------------------------
function createTables(callback) {
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS puppies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        age TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('Adoption', 'Rescue')),
        description TEXT NOT NULL,
        image_url TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        puppy_id INTEGER NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        delivery_address TEXT NOT NULL DEFAULT '',
        household_details TEXT NOT NULL,
        prior_experience TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Reviewed', 'Approved', 'Denied')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (puppy_id) REFERENCES puppies(id) ON DELETE CASCADE
      )`
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS donations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        donor_name TEXT NOT NULL,
        donor_email TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL CHECK(payment_method IN (
          'PayPal (Family and Friends)',
          'Chime',
          'Apple Pay',
          'Gift Card',
          'Cash App',
          'Venmo',
          'Bank Transfer'
        )),
        status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Contacted', 'Completed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      callback
    );
  });
}

// -----------------------------------------------------------------------------
// Migration: add the `price` column to an existing `puppies` table if it was
// created before this column existed. CREATE TABLE IF NOT EXISTS is a no-op
// on a table that already exists, so this is required for anyone upgrading
// from an earlier version of this project with a live havanese.db already
// in place (exactly the situation once a site has real deployed data).
// -----------------------------------------------------------------------------
function migratePriceColumn(callback) {
  db.all('PRAGMA table_info(puppies)', (err, columns) => {
    if (err) return callback(err);

    const hasPriceColumn = columns.some((col) => col.name === 'price');
    if (hasPriceColumn) return callback(null);

    db.run('ALTER TABLE puppies ADD COLUMN price REAL NOT NULL DEFAULT 0', (alterErr) => {
      if (alterErr) return callback(alterErr);
      console.log('Migrated: added price column to existing puppies table.');
      callback(null);
    });
  });
}

// -----------------------------------------------------------------------------
// Migration: add the `delivery_address` column to an existing `applications`
// table if it was created before this column existed. Same reasoning as
// migratePriceColumn above — required for the live havanese.db already
// deployed on Render, since CREATE TABLE IF NOT EXISTS won't alter a table
// that's already there.
// -----------------------------------------------------------------------------
function migrateDeliveryAddressColumn(callback) {
  db.all('PRAGMA table_info(applications)', (err, columns) => {
    if (err) return callback(err);

    const hasDeliveryAddressColumn = columns.some((col) => col.name === 'delivery_address');
    if (hasDeliveryAddressColumn) return callback(null);

    db.run("ALTER TABLE applications ADD COLUMN delivery_address TEXT NOT NULL DEFAULT ''", (alterErr) => {
      if (alterErr) return callback(alterErr);
      console.log('Migrated: added delivery_address column to existing applications table.');
      callback(null);
    });
  });
}

// -----------------------------------------------------------------------------
// Seed admin user if the admins table is empty
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// Seed or update admin user credentials
// -----------------------------------------------------------------------------
function seedAdmin(callback) {
  bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12, (hashErr, hash) => {
    if (hashErr) return callback(hashErr);

    // Check if the administrator user already exists
    db.get('SELECT * FROM admins WHERE username = ?', [DEFAULT_ADMIN_USERNAME], (err, row) => {
      if (err) return callback(err);

      if (!row) {
        // If they don't exist, insert them
        db.run(
          'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
          [DEFAULT_ADMIN_USERNAME, hash],
          (insertErr) => {
            if (insertErr) return callback(insertErr);
            console.log(`Seeded default admin user -> username: ${DEFAULT_ADMIN_USERNAME}`);
            callback(null);
          }
        );
      } else {
        // If they do exist, force-update their password to match your new variable
        db.run(
          'UPDATE admins SET password_hash = ? WHERE username = ?',
          [hash, DEFAULT_ADMIN_USERNAME],
          (updateErr) => {
            if (updateErr) return callback(updateErr);
            console.log(`Updated credentials for admin user: ${DEFAULT_ADMIN_USERNAME}`);
            callback(null);
          }
        );
      }
    });
  });
}

// -----------------------------------------------------------------------------
// Seed puppies table if empty
// -----------------------------------------------------------------------------
function seedPuppies(callback) {
  db.get('SELECT COUNT(*) AS count FROM puppies', (err, row) => {
    if (err) return callback(err);

    if (row.count === 0) {
      const stmt = db.prepare(
        'INSERT INTO puppies (name, age, category, description, image_url, price) VALUES (?, ?, ?, ?, ?, ?)'
      );

      SEED_PUPPIES.forEach((p) => {
        stmt.run([p.name, p.age, p.category, p.description, p.image_url, p.price]);
      });

      stmt.finalize((finalizeErr) => {
        if (finalizeErr) return callback(finalizeErr);
        console.log('Seeded 12 sample Havanese puppies (6 Adoption, 6 Rescue) with prices.');
        callback(null);
      });
    } else {
      callback(null);
    }
  });
}

// -----------------------------------------------------------------------------
// Master initialization function called once on server startup
// -----------------------------------------------------------------------------
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    createTables((tableErr) => {
      if (tableErr) return reject(tableErr);

      migratePriceColumn((migrateErr) => {
        if (migrateErr) return reject(migrateErr);

        migrateDeliveryAddressColumn((migrateAddrErr) => {
          if (migrateAddrErr) return reject(migrateAddrErr);

          seedAdmin((adminErr) => {
            if (adminErr) return reject(adminErr);

            seedPuppies((puppyErr) => {
              if (puppyErr) return reject(puppyErr);
              resolve();
            });
          });
        });
      });
    });
  });
}

module.exports = { db, initializeDatabase };
