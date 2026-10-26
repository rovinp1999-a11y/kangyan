# Kangyan — Science & Maths Tuition

A one-page tuition website for **Kangyan** (Physics · Chemistry · Biology · Science · Mathematics,
Form 1–5 / SPM / IGCSE) with a weekly availability grid, an enquiry form and a private admin page.

Built with **React + Vite** (plain JavaScript), **Vercel Functions** for the API and **Neon Postgres**
(provisioned through the Vercel Marketplace) for data.

## How it works
- **Students** scroll to *Availability*, tick the weekly slots they prefer, then send an enquiry
  (name, contact, level, subjects, lesson format, message). Enquiries are stored in the database.
- **Kangyan** opens `/admin`, logs in with the admin password, reads enquiries (and updates their
  status: new → contacted → confirmed → closed) and edits the weekly timetable (add / mark taken / delete).

## Project structure
```
Kangyan/
├── api/                    # Vercel Functions (Node.js)
│   ├── _db.js              # lazy Neon client            ├── _auth.js  # admin token auth
│   ├── _http.js            # small response helpers      ├── slots.js  # GET public timetable
│   ├── enquiries.js        # POST a new enquiry
│   ├── health.js           # GET DB connectivity check
│   └── admin/              # login.js · enquiries.js (GET/PATCH) · slots.js (POST/PATCH/DELETE)
├── shared/constants.js     # subjects, levels, formats, weekday + time helpers (used by UI and API)
├── scripts/migrate.js      # creates tables, seeds a starter timetable if empty
├── src/
│   ├── App.jsx             # "/" → public site, "/admin" → admin dashboard
│   ├── components/         # Nav · Hero · Marquee · Subjects · About · Testimonials
│   │                       # BookingFlow → Availability (grid) + Enquire (form)
│   ├── admin/AdminPage.jsx # login, enquiries tab, availability tab
│   ├── data.js             # subject tiles + (placeholder) testimonials
│   └── styles.css
├── vercel.json             # rewrites /admin → index.html
└── .env.local              # pulled from Vercel (DATABASE_URL, ADMIN_PASSWORD, …) — gitignored
```

## Run it locally
```bash
npm install
vercel env pull .env.local        # DB connection + admin password (needs `vercel login`)
node scripts/migrate.js           # first time only — creates tables, seeds slots
vercel dev --listen 4322          # site + API together → http://localhost:4322
```
`npm run dev` runs Vite alone (no API), which is fine for pure styling work.

## Deploy
```bash
vercel --prod
```
The project is linked to Vercel (`kangyan`). Environment variables are managed on Vercel:
`ADMIN_PASSWORD` is the admin login; the `DATABASE_URL` family comes from the Neon integration.
Change the admin password with `vercel env rm ADMIN_PASSWORD <env>` then `vercel env add ADMIN_PASSWORD <env>`.

## Make it hers — quick edits
1. **Photos** → `public/assets/kangyan-hero.jpg` and `kangyan-about.jpg`.
2. **Bio / hero copy** → `src/components/Hero.jsx`, `src/components/About.jsx`.
3. **Subjects, levels, formats** → `shared/constants.js` (drives the form and the API validation).
4. **Subject tiles & testimonials** → `src/data.js` (testimonials are placeholders — replace before relying on them).
5. **Timetable** → `/admin` → Availability. No redeploy needed.
6. **Contact details** → `src/components/Enquire.jsx` and `Footer.jsx`.
