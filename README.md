# 🕉️ Sanatan Biradari Seva Trust — Website

A public informational website plus a members-only contributions dashboard, backed by a small Express + SQLite API.

## Running locally

```bash
cd backend
npm install
cp .env.example .env   # then edit .env: set JWT_SECRET and ADMIN_PASS
npm start
```

Open `http://localhost:4000` — the server serves the static site (`index.html`, `contributions.html`, etc.) and the `/api/*` routes from the same origin.

On first run, `backend/seed.js` seeds the SQLite database (`backend/data.sqlite`, gitignored) with the existing member/contribution data and creates the admin account from `ADMIN_USER`/`ADMIN_PASS`. Log in from the Contributions page and change the password from the Admin Panel → Settings tab.

## Architecture notes

- All contribution/member data lives server-side in SQLite — edits made by the admin are visible to every visitor, unlike the previous `localStorage`-only version.
- Admin auth is verified server-side (bcrypt password hash + JWT in an httpOnly cookie); the password is never sent to the browser.
- The contact form on the homepage posts to `/api/contact` and is stored in the database for the trust to review.
- Months belong to a year (e.g. "Aug 2025", "Jan 2026"). The dashboard has a year filter (All Years / 2025 / 2026 / …), and new years appear automatically as an admin adds months for them via Admin Panel → Months.

## Deployment

Any Node hosting works (Render, Railway, Fly.io, a VPS). Set `NODE_ENV=production`, a strong `JWT_SECRET`, and serve behind HTTPS so the auth cookie's `secure` flag applies.

### Render (free tier)

This repo includes a `render.yaml` Blueprint:

1. Push to GitHub (already done).
2. On [render.com](https://render.com), **New → Blueprint**, connect this repo.
3. Render reads `render.yaml` and creates a free Web Service. It'll prompt you to fill in `ADMIN_PASS` (not stored in the repo); `JWT_SECRET` is auto-generated.
4. Deploy. Your site is live at `https://<service-name>.onrender.com`.

**Free tier caveats:**
- No persistent disk — `data.sqlite` resets to whatever's in `seed.js` on every redeploy (and possibly after long idle periods). Any admin edits made since the last push are lost when that happens, unless you bake them into `seed.js` first (see below). Upgrading to a paid Starter plan + disk avoids this entirely.
- The free service spins down after ~15 minutes of inactivity; the first request after that takes ~30–50s to wake back up.

**Before pushing a change that will trigger a redeploy**, snapshot whatever real data currently exists (local or live) into `seed.js` so the redeploy doesn't roll it back:

```bash
cd backend
node scripts/export-seed.js
```

This prints `SEED_MEMBERS` / `SEED_MONTHS` / `SEED_CONTRIBS` reflecting the current database — paste them over the matching blocks in `seed.js`, then commit and push as usual.

## 📄 License
This website is created for the exclusive use of Sanatan Biradari Seva Trust.
