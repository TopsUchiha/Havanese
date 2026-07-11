# Havanese Havens — Adoption & Rescue (Atlanta, GA)

A zero-config, turn-key full-stack site: vanilla HTML/CSS/JS frontend (Tailwind CDN)
and an Express + SQLite backend that auto-creates and seeds its own database on first run.

## Run it locally

```bash
npm install
node server.js
```

Public site: http://localhost:3000
Admin dashboard: printed in your terminal on startup (see "Admin access" below).

## Admin access

**There is no `/admin` route anymore.** The dashboard lives at whatever path you set via
the `ADMIN_PATH` environment variable. Locally, if you don't set one, it falls back to
`/portal-x7k2m9qz-manage` (printed in the console on startup) — fine for local dev, **not**
fine for production, because that fallback value is sitting in this file on GitHub.

**Before deploying anywhere public: set your own `ADMIN_PATH` environment variable** (e.g.
`/staff-9f2k7x`) in your host's dashboard — never commit your real one to git. Once set,
bookmark `https://yourdomain.com/<your-path>` directly, since nothing links to it publicly.

Be clear-eyed about what this buys you: it's obscurity, not security. It stops
automated scanners that blindly try `/admin`, `/wp-admin`, etc. The actual defense against
someone brute-forcing the login itself is the rate limiter on `/api/admin/login`
(5 attempts / 15 minutes) plus bcrypt-hashed passwords — that's unaffected by the path.

## Default admin login

- Username: `admin`
- Password: `adminpassword123`

Change these by editing the `admins` table directly, or delete `havanese.db` and adjust
`DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` in `config/db.js` before first run.

## Puppy photos — real file uploads

The admin "Add Puppy" / "Edit Puppy" forms use a native file picker, not a URL field.
- Uploaded files go to `public/uploads/`, renamed with a timestamp prefix to avoid collisions.
- JPG/PNG/GIF/WEBP only, capped at 5MB.
- Editing without picking a new photo keeps the existing one.
- Editing with a new photo, or deleting a puppy, cleans up the old file from disk automatically.
- Seed puppies still use Unsplash URLs — the `image_url` column stores either a relative
  `/uploads/...` path or a full external URL, and both render identically.

## Puppy pricing

Every puppy now has a `price` field (adoption fee for Adoption puppies, suggested donation
for Rescue dogs), editable in the same Add/Edit form. It's shown as a badge over each
puppy's photo on the public site. If you're upgrading from an earlier version of this
project with an existing `havanese.db`, the app automatically migrates the schema
(`ALTER TABLE puppies ADD COLUMN price...`) on next startup — no manual DB work needed,
and no data is lost.

## The CORS fix (why login was blocked on Render)

The frontend `fetch()` calls were never hardcoded to `localhost` — they were always
relative paths like `/api/puppies`. The actual bug was server-side: the old CORS config
only whitelisted `http://localhost`/`http://127.0.0.1`, so the exact same same-origin
request got rejected once it arrived from `https://havanese.onrender.com`, because that
domain literally wasn't on the list.

The fix in `server.js` compares the browser's `Origin` header against the domain the
request actually arrived on, instead of a hardcoded list — so it's automatically correct
on localhost, on Render's default domain, and on any custom domain you add later, with
zero configuration. This required `app.set('trust proxy', 1)`, since Render (like most
hosts) terminates HTTPS at a proxy in front of your app — without that line, Express
would report every request as plain `http`, breaking the same-origin comparison.

## Deploying — read this before you deploy

**Render's free web service tier has an ephemeral filesystem.** `havanese.db` and
everything in `public/uploads/` can be wiped every time the service redeploys, restarts,
or spins back up after 15 minutes of inactivity (free tier auto-sleeps when idle). That
means: puppies an admin added, uploaded photos, and applications/donations submitted
through the live site are **not guaranteed to persist** on the free tier. Fine for a demo;
not fine for real operation. Real persistence requires either Render's paid persistent
disk add-on, or migrating storage to a hosted database (e.g. Render Postgres, Turso) and
file storage (e.g. Cloudinary, S3) — a real scope increase beyond what's built here, and
something to plan for once this moves past demo stage.

## Editing contact info

Search for `EDIT CONTACT INFO HERE` in `public/index.html` and `public/admin.html`.

## Project structure

```
package.json           Dependencies (includes multer for file uploads)
config/db.js            SQLite schema, migration, auto-seeding (admin + 12 priced puppies + donations table)
middleware/auth.js       JWT cookie verification for admin routes
server.js                Express app, security middleware, CORS fix, obscured admin route
routes/api.js            Public + protected admin API routes, multer upload handling, price validation
public/index.html        Public site — SEO tags, glass UI, price badges on puppy cards
public/admin.html        Admin dashboard — puppy/application/donation management, file uploads, price field
public/robots.txt         Crawler rules
public/sitemap.xml        Sitemap (single homepage URL)
public/uploads/           Uploaded puppy photos (git-ignored except .gitkeep)
```

## Security features included

- Helmet with strict CSP + clickjacking protection (`X-Frame-Options: DENY`)
- `script-src-attr: 'unsafe-inline'` so onclick/onerror handlers work (Helmet blocks these by default)
- CORS: dynamic same-origin check, not a hardcoded domain list (see above)
- 100% parameterized SQL — no string concatenation near a query, anywhere
- express-validator sanitization/escaping on every write endpoint, including price
- express-rate-limit: 5/15min on login, 10/hour on applications and donations, 300/15min globally
- Admin sessions via JWT in an HTTP-Only, SameSite=Strict cookie (Secure flag auto-enabled
  when `NODE_ENV=production`)
- File uploads: extension + MIME-type whitelist, 5MB cap, sanitized filenames, automatic
  cleanup of orphaned files
- Admin dashboard path is environment-configurable and not linked anywhere publicly

Verified end-to-end before packaging: CORS under simulated production conditions (same-origin
allowed, cross-origin blocked), price-column migration against a pre-existing database with
real data, the obscured admin path (custom path serves the dashboard, old `/admin` 404s),
full puppy CRUD with real file uploads including price and old-file cleanup, and validation
rejecting a missing price.
