# Tanvir Ahammad Emon — Photography Portfolio

A dynamic, self-hosted photography portfolio powered by a **custom C HTTP server** and a modern **Vanilla JS + CSS** frontend. No Node.js, no React, no framework overhead — just C, HTML, CSS, and JavaScript.

---

## 🗂️ Project Structure

```
my web/
├── public/                       # Frontend (served statically by the C server)
│   ├── index.html                # Main single-page portfolio
│   ├── admin.html                # Admin dashboard (protected)
│   ├── css/
│   │   ├── style.css             # Full design system — dark theme, animations, responsive
│   │   └── admin.css             # Admin panel styles
│   ├── js/
│   │   ├── app.js                # Dynamic rendering, lightbox, gallery, filters
│   │   └── admin.js              # Admin CRUD operations
│   └── images/                   # Portfolio photos (served as static files)
├── src/                          # C backend
│   ├── server.c                  # Winsock2 HTTP server, main entry point
│   ├── router.c / router.h       # URL routing (static files + API)
│   ├── api.c / api.h             # /api/portfolio JSON endpoint
│   ├── admin.c / admin.h         # Admin API (auth, upload, CRUD)
│   ├── mime.c / mime.h           # MIME type detection for static serving
│   ├── portfolio_data.json       # Single source of truth for all content
│   └── email_config.json         # SMTP config for contact/reset emails
├── build.bat                     # Compile script (MinGW gcc → server.exe)
├── compress_images.py            # Image optimization utility (Pillow)
├── send_reset.py                 # Password reset email utility
└── vercel.json                   # Vercel deployment config

```

---

## 🛠️ Tech Stack

### Backend — Custom C HTTP Server
| Component | Detail |
|---|---|
| Language | C (C99), compiled with MinGW GCC on Windows |
| Networking | Winsock2 (`ws2_32`) — raw TCP socket server on port 8080 |
| Routing | Hand-written router in `router.c` — maps URL paths to handlers |
| API | `GET /api/portfolio` — serves `portfolio_data.json` as JSON |
| Admin API | `POST /api/admin/*` — password-protected CRUD for photos, awards, services, etc. |
| File serving | MIME-aware static file server from `public/` directory |
| Auth | Plain-text password in `admin_pass.txt`, checked server-side per request |

### Frontend — Vanilla JS + CSS
| Component | Detail |
|---|---|
| HTML | Semantic HTML5, single `index.html` + `admin.html` |
| CSS | Custom design system with CSS custom properties (tokens), no framework |
| JavaScript | Vanilla ES6+ IIFE module in `app.js`, no bundler |
| Fonts | Google Fonts — Playfair Display (headings) + Inter (body) |
| Icons | Inline SVG — no icon library dependency |

### Deployment
| Component | Detail |
|---|---|
| Local | `build.bat` compiles `src/*.c` → `server.exe`, run directly |
| Production | Vercel (reverse-proxy to the C server, or static hosting mode) |
| Image optimization | `compress_images.py` (Python + Pillow) — WebP/JPEG compression |

---

## ✅ What Was Built

### Portfolio Sections (all data-driven from `portfolio_data.json`)
- **Hero** — animated title, tagline, CTA button, scroll indicator
- **Highlights** — curated 3-column photo grid with pullquotes, staggered entrance
- **Gallery** — responsive photo grid with category filter bar and lightbox viewer
- **Services** — service cards with feature lists, icons, hover effects
- **Projects** — Brand / Event / Corporate folder cards, click-to-lightbox
- **Worked With** — infinite CSS marquee of client names
- **Testimonials** — auto-rotating carousel with dot indicators
- **About** — photographer bio, circular photo, animated count-up stats
- **Awards & Certificates** — glassmorphism cards with shimmer hover
- **Contact** — email link + social icons (LinkedIn, Instagram, Facebook)
- **Footer** — dynamic year

### Core Features
- **Lightbox** — full-screen viewer with prev/next, keyboard (←→ Esc), and touch swipe
- **Category filters** — animated fade-out/in when switching categories
- **Skeleton loading** — shimmer placeholder cards while API loads
- **Scroll progress bar** — thin gold bar at the top of the page
- **Scroll-triggered animations** — IntersectionObserver reveals on viewport enter
- **Count-up animation** — stat numbers animate when About section scrolls in
- **Mobile hamburger menu** — slide-in nav drawer with backdrop overlay
- **Smooth scroll** — anchor link navigation with fixed-header offset (`scroll-padding-top`)

### Admin Panel (`/admin.html`)
- Password-protected dashboard
- Upload photos (drag-and-drop or file picker)
- CRUD for: photos, highlights, awards, services, portfolios, clients, testimonials
- Multi-category checkbox selection per photo
- Live portfolio data editing without touching any files

---

## 🧹 What Was Cleaned

### Dead CSS Removed from `style.css`
| Removed Rule | Reason |
|---|---|
| `.portfolios-tabs` + all `.portfolio-tab` variants (~40 lines) | Tabs UI was replaced by folder cards — never rendered |
| `.folder-icon` (emoji font-size version) | Only `.folder-icon-svg` (inline SVG) is used by JS |
| `.project-folder-year` | The `year` field is never injected into the DOM |
| `.photo-card:nth-child(3n+1) { grid-row: span 1 }` | `span 1` is the CSS grid default — zero effect |
| `.lightbox-overlay.active .lightbox-image { transform: scale(1) }` | `scale(1)` is the default transform — redundant |

**Net result:** −82 lines removed, +42 lines of better rules added. Clean git commit `e622955`.

### Mobile Responsiveness Fixes
| Fix | Detail |
|---|---|
| `scroll-padding-top: 80px` on `html` | Anchor links no longer hide behind the fixed header |
| Filter bar → horizontal scroll | `flex-wrap: nowrap; overflow-x: auto` — filters scroll instead of wrapping chaotically |
| Gallery ≤480px → 2-column | `repeat(2, 1fr)` instead of single column — better photo density |
| About stats ≤480px → `align-items: center` | Stats stay centered when stacked vertically |
| Hero padding ≤480px — tighter | Uses `--space-lg + 64px` instead of `--space-xl + 60px` |
| Lightbox close ≤480px — bigger tap target | 56×56px with opaque dark background |
| Portfolios grid ≤768px | `auto-fill minmax(260px, 1fr)` — adapts fluidly instead of forcing 2 cramped columns |

---

## 🔮 What Could Be Better (Recommendations)

### 🔴 Security — High Priority
- **Replace plain-text `admin_pass.txt`** with a bcrypt hash compared server-side — a plain-text file is a credential leak
- **Add rate limiting** on `/api/admin/*` — currently unlimited password attempts are possible (brute-force risk)
- **HTTPS / TLS** — the C server speaks plain HTTP; put it behind nginx or Caddy with a TLS cert for production
- **Purge `admin_pass.txt` from git history** using `git filter-repo`, then rotate the password

### 🟡 Performance
- **Add `Cache-Control` headers** in the C router for static assets (images, CSS, JS) — currently there are none, so browsers re-fetch everything on every visit
- **Serve only WebP** — `compress_images.py` can be updated to output WebP exclusively since all modern browsers support it
- **gzip the `/api/portfolio` response** — for a large `portfolio_data.json`, uncompressed JSON adds unnecessary bytes
- **Add `decoding="async"`** to `<img>` tags alongside existing `loading="lazy"` for non-blocking image decode

### 🟢 UX / Design
- **"Load More" or infinite scroll** for the gallery — as photos grow past 50+, the initial render will stall
- **Contact form** — the contact section only has an email link; a form wired to `email_config.json` + the existing SMTP setup would complete the UX loop
- **Dark/Light mode toggle** — the design system already uses CSS custom properties; a toggle needs only ~20 lines of JS + a `[data-theme="light"]` override block
- **Preload the hero image** with `<link rel="preload">` if a background photo is ever added — critical for LCP score

### 🔵 Code Quality
- **Error boundaries in `app.js`** — if any `render*` function throws on a malformed JSON field, the rest of the page silently breaks; wrap each call in try/catch
- **Move `portfolio_data.json` out of `src/`** — source directory should not hold runtime data; use a `data/` folder
- **Validate `portfolio_data.json` schema** — a missing or wrong-type field can crash rendering silently; a JSON schema check on server start would catch this early

---

## 🚀 Running Locally

```bat
REM 1. Compile
build.bat

REM 2. Run the server
server.exe

REM 3. Open in browser
start http://localhost:8080
```

---

## 📝 License

Personal use only — Tanvir Ahammad Emon.
