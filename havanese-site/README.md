# Havanese Havens — Adoption & Rescue (Atlanta, GA)

A zero-config, turn-key full-stack site: vanilla HTML/CSS/JS frontend (Tailwind CDN)
and an Express + SQLite backend that auto-creates and seeds its own database on first run.

## Run it

```bash
npm install
node server.js
```

Then open:
- Public site: http://localhost:3000
- Admin dashboard: **http://localhost:3000/admin**

No manual database setup is required — `havanese.db` is created automatically on first
launch, with tables built and seed data inserted the first time each table is empty.

## Admin access — bookmark this

**The Admin link was intentionally removed from the public site's footer.** It's not
advertised anywhere in the public-facing UI, but the page itself is unchanged and still
fully reachable — bookmark `http://localhost:3000/admin` (or `https://yourdomain.com/admin`
once hosted) directly, since there's no longer a click path to it from the homepage.

Worth knowing: hiding the link is *obscurity*, not security. The actual protection is the
JWT-cookie login wall — anyone without the admin password still can't get in even if they
find the URL.

## Default admin login

- Username: `admin`
- Password: `adminpassword123`

Change these by editing the row in the `admins` table, or delete `havanese.db` and
adjust `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` in `config/db.js` before
the first run.

## Puppy photos — real file uploads, no links required

The admin "Add Puppy" / "Edit Puppy" forms now use a native file picker instead of an
image URL field. Behind the scenes:
- Uploaded files are written to `public/uploads/`, automatically renamed with a timestamp
  prefix (`1735689600000-photo.jpg`) to avoid collisions.
- Only JPG/PNG/GIF/WEBP are accepted, capped at 5MB.
- Editing a puppy without picking a new photo keeps the existing one.
- Editing with a new photo, or deleting a puppy, automatically removes the old file from
  disk — no orphaned images pile up over time.
- Original seed puppies still use Unsplash URLs (they can't have "uploaded" a file at seed
  time) — the `image_url` column happily stores either a relative `/uploads/...` path or a
  full external URL, and both render identically on the frontend.

**⚠️ Important if hosting on Render:** Render's standard/free web service tier uses an
*ephemeral filesystem* — files written at runtime (like these uploads) can be wiped on
every redeploy or restart. For a live client-facing site, you'll want either Render's
persistent disk add-on, or to migrate uploads to cloud storage (S3, Cloudinary, etc.)
before real photos start disappearing. Fine as-is for local dev and demos.

## SEO

- `robots.txt` and `sitemap.xml` in `public/` (edit the placeholder domain in both once
  you have a real one — search for `EDIT DOMAIN HERE`)
- Full meta tag set on the public site: description, keywords, canonical, Open Graph,
  Twitter Card
- JSON-LD structured data (`schema.org/AnimalShelter`) with name, address, phone, hours
- `admin.html` is marked `noindex, nofollow` so it never appears in search results
- Image `alt` text describes each puppy and category for accessibility + image search

**Honest limitation:** this is a single-page app — Adoption/Rescue/Donations are
JS-toggled views under one URL (`/`), not separate crawlable pages. That caps how much
on-page SEO alone can do. If organic search ranking becomes a priority, the next real
lever is giving each section its own URL (multi-page routing or server-side rendering),
which is a bigger architectural change beyond a meta-tag pass.

## Editing contact info

Search for `EDIT CONTACT INFO HERE` in `public/index.html` and `public/admin.html`
to update the phone number, address, and email used across the site and in the
mailto templates ("Review & Email Applicant" and "Send Payment Details").

## Project structure

```
package.json           Dependencies (now includes multer for file uploads)
config/db.js            SQLite schema, auto-seeding (admin + 12 sample puppies + donations table)
middleware/auth.js       JWT cookie verification for admin routes
server.js                Express app, security middleware, static + route mounting
routes/api.js            Public + protected admin API routes, multer upload handling
public/index.html        Public site (Home / Adoption / Rescue / Donations) — SEO tags, glass UI
public/admin.html        Admin dashboard — puppy/application/donation management, file uploads
public/robots.txt         Crawler rules
public/sitemap.xml        Sitemap (single homepage URL)
public/uploads/           Uploaded puppy photos live here (git-ignored except .gitkeep)
```

## Security features included

- Helmet with a strict Content-Security-Policy and clickjacking protection (`X-Frame-Options: DENY`)
- `script-src-attr: 'unsafe-inline'` explicitly set so onclick/onerror handlers work (Helmet
  blocks these by default, which was the earlier "buttons do nothing" bug)
- CORS locked to localhost origins
- 100% parameterized SQL queries — no string concatenation anywhere near a query
- express-validator sanitization/escaping on every write endpoint
- express-rate-limit: tight limits on `/api/admin/login` (5 / 15 min), `/api/applications`
  and `/api/donations` (10 / hour), looser global limit elsewhere
- Admin sessions via JWT in an HTTP-Only, SameSite=Strict cookie (Secure flag auto-enabled
  when `NODE_ENV=production`)
- File uploads: extension + MIME-type whitelist, 5MB size cap, sanitized filenames,
  automatic cleanup of orphaned files on validation failure or replacement

This was verified end-to-end before packaging: puppy listing, application submission,
donation requests, admin login/logout, puppy CRUD (create/edit/delete) with real file
uploads including old-file cleanup, SQL-injection and XSS attempts, rate-limit triggering,
CSP headers, robots.txt/sitemap.xml delivery, and admin noindex tag all confirmed working.
