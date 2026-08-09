# 🕉️ Sanatan Biradari Seva Trust — Website

A public informational website plus a members-only contributions dashboard, backed by a small Express API using [libSQL](https://turso.tech/libsql) (SQLite-compatible; runs against a local file or a remote [Turso](https://turso.tech) database with the same code).

## Running locally

```bash
cd backend
npm install
cp .env.example .env   # then edit .env: set JWT_SECRET and ADMIN_PASS
npm start
```

Open `http://localhost:4000` — the server serves the static site (`index.html`, `contributions.html`, etc.) and the `/api/*` routes from the same origin.

On first run, `backend/seed.js` seeds the database with the existing member/contribution data and creates the admin account from `ADMIN_USER`/`ADMIN_PASS`. Log in from the Contributions page and change the password from the Admin Panel → Settings tab.

By default (no `DATABASE_URL` set) this uses a local file, `backend/data.sqlite` (gitignored) — fine for local dev, but that file does **not** persist reliably on Render (see Deployment below).

## Architecture notes

- All contribution/member data lives server-side (SQLite-compatible via libSQL) — edits made by the admin are visible to every visitor, unlike the previous `localStorage`-only version.
- Admin auth is verified server-side (bcrypt password hash + JWT in an httpOnly cookie); the password is never sent to the browser.
- The contact form on the homepage posts to `/api/contact` and is stored in the database for the trust to review.
- Months belong to a year (e.g. "Aug 2025", "Jan 2026"). The dashboard has a year filter (All Years / 2025 / 2026 / …), and new years appear automatically as an admin adds months for them via Admin Panel → Months.

## Deployment

Any Node hosting works (Render, Railway, Fly.io, a VPS). Set `NODE_ENV=production`, a strong `JWT_SECRET`, and serve behind HTTPS so the auth cookie's `secure` flag applies.

### Render (free tier) + Turso — required for real persistence

Render's free web service tier has **no persistent disk**: the filesystem resets on every redeploy and on the normal idle spin-down/wake cycle (~15 min of inactivity). A local `data.sqlite` file cannot survive that. Fix: point the app at a free [Turso](https://turso.tech) database instead — same libSQL code, just remote, so admin edits actually stick.

**1. Create a free Turso database** (one-time, in your own Turso account — sign up at [turso.tech](https://turso.tech) or via CLI):

```bash
curl -sSfL https://get.tur.so/install.sh | bash   # installs the turso CLI
turso auth signup                                  # or: turso auth login
turso db create sanatan-trust
turso db show sanatan-trust --url                  # -> libsql://sanatan-trust-xxxx.turso.io
turso db tokens create sanatan-trust                # -> long auth token
```

**2. Deploy the Blueprint:**

1. Push to GitHub (already done).
2. On [render.com](https://render.com), **New → Blueprint**, connect this repo.
3. Render reads `render.yaml` and creates a free Web Service. It'll prompt for four values:
   - `ADMIN_PASS` — the admin login password
   - `DATABASE_URL` — the `libsql://...` URL from step 1
   - `DATABASE_AUTH_TOKEN` — the token from step 1
   - (`JWT_SECRET` is auto-generated, no input needed)
4. Deploy. Your site is live at `https://<service-name>.onrender.com`, and this time data survives redeploys and idle restarts.

**Local dev still defaults to a local file** — it only uses Turso if `DATABASE_URL` is set in `backend/.env`. You generally don't need a Turso database for local development at all; the free/ephemeral local file is fine there since it's not meant to be the durable copy.

**If you haven't set up Turso yet** and need to push a code change without losing whatever's currently live, snapshot the current database into `seed.js` first so a redeploy doesn't roll it back:

```bash
cd backend
node scripts/export-seed.js
```

This prints `SEED_MEMBERS` / `SEED_MONTHS` / `SEED_CONTRIBS` reflecting the current database — paste them over the matching blocks in `seed.js`, then commit and push as usual.

## 📄 License
This website is created for the exclusive use of Sanatan Biradari Seva Trust.
