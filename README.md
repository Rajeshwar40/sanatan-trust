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

## 📄 License
This website is created for the exclusive use of Sanatan Biradari Seva Trust.
