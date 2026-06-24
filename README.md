# Kangyan — Emcee Portfolio (React)

An elegant, professional one-page website for **Kangyan**, a professional emcee &
event host — built with **React + Vite** (plain JavaScript, no TypeScript).

## ✨ Features
- **"Bold Editorial"** design in a **5-colour theme**: yellow · purple · green · blue · white
- Fonts: **Bricolage Grotesque** (expressive display) + **Inter** (clean, ultra-readable body)
- Oversized fluid typography, a **bento-grid** services section, a kinetic scrolling marquee, and hard-edged color blocking
- Componentised React: Nav, Hero, Marquee, About, Services, Stats, Gallery, Testimonials, Contact, Footer
- **Fully responsive** — every size is `clamp()`-fluid; breakpoints at 1024 / 860 / 540px; off-canvas mobile drawer; zero horizontal overflow 320 → 1920px
- **Interactive & playful** (all in vanilla JS via `src/Effects.jsx`):
  - Rainbow scroll-progress bar + scroll-spy active nav highlighting
  - Custom trailing cursor ring (grows + turns yellow over interactive elements)
  - Magnetic buttons that pull toward the cursor
  - 3D tilt on the hero photo & bento tiles
  - Cursor "spotlight" glow on the dark sections (on-theme stage lighting)
  - Per-letter hero headline: entrance stagger + hover colour-pop/lift
  - 🎉 Confetti burst on booking submit (`src/confetti.js`)
  - Scroll-reveal animations + animated stat counters
  - **Respect for accessibility** — heavy motion is gated behind `pointer: fine` + `prefers-reduced-motion`
- Controlled booking form that opens a pre-filled email
- Image placeholders auto-disappear when real photos are added

## 🚀 Run it
```bash
npm install      # first time only
npm run dev      # dev server → http://localhost:4321
npm run build    # production build → dist/
npm run preview  # preview the production build
```

## 🗂️ Structure
```
Kangyan/
├── index.html              # Vite entry (loads /src/main.jsx)
├── package.json
├── vite.config.js
├── public/
│   └── assets/             # photos (see public/assets/README.md)
│       └── gallery/
└── src/
    ├── main.jsx            # React entry
    ├── App.jsx             # composes all sections
    ├── styles.css          # theme, layout, responsive styles
    ├── data.js             # services / gallery / testimonials / stats content
    └── components/
        ├── Reveal.jsx      # scroll-reveal wrapper
        ├── Nav.jsx  Hero.jsx  Marquee.jsx  About.jsx
        ├── Services.jsx (bento)  Stats.jsx  Gallery.jsx
        └── Testimonials.jsx  Contact.jsx  Footer.jsx
```

## 🖌️ Make it hers — quick edits
1. **Photos** → add real images to `public/assets/` (see `public/assets/README.md` for filenames).
2. **Bio** → edit the two paragraphs in `src/components/About.jsx`.
3. **Services / testimonials / stats / gallery** → edit the arrays in `src/data.js`.
4. **Contact** → replace `hello@kangyan.com` and the phone number in `src/components/Contact.jsx` (and Footer/Nav).
5. **Colours** → all five theme colours live at the top of `src/styles.css` under `:root`.

## 🌐 Deploy (free options)
Run `npm run build` and deploy the `dist/` folder, or connect the repo to:
- **Vercel / Netlify / Cloudflare Pages** — auto-detect Vite, build command `npm run build`, output `dist`.

> The copy is professionally written placeholder text — update the bio, stats and
> testimonials with Kangyan's real details before going live.
