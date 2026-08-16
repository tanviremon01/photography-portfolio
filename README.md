# Tanvir Ahammad Emon — Photography Portfolio

## 📸 What's the Project
This project is a dynamic, high-performance photography portfolio built to showcase landscape, portrait, street, and documentary photography. It features a modern, responsive frontend built entirely with **Vanilla JavaScript, HTML, and CSS** (no heavy frameworks like React or Node.js). 

Uniquely, the project is designed to be served by a **custom C HTTP server** for local development, while being fully optimized for static serverless deployment on **Vercel** in production.

---

## 🗂️ Project Structure

```
my web/
├── public/                       # Frontend (served statically by the C server or Vercel)
│   ├── index.html                # Main single-page portfolio
│   ├── admin.html                # Admin dashboard (password protected)
│   ├── css/
│   │   ├── style.css             # Full design system (dark theme, responsive)
│   │   └── admin.css             # Admin panel styles
│   ├── js/
│   │   ├── app.js                # Dynamic rendering, lightbox, filters, animations
│   │   └── admin.js              # Admin CRUD operations & GitHub API integrations
│   └── images/                   # Portfolio photos (served as static files)
├── data/                         # Persistent Data Storage
│   ├── portfolio_data.json       # Single source of truth for all text & references
│   └── admin_hash.json           # Admin authentication data
├── src/                          # C backend (Local Development Server)
│   ├── server.c                  # Winsock2 HTTP server, main entry point
│   ├── router.c / router.h       # URL routing (static files + API)
│   ├── api.c / api.h             # /api/portfolio JSON endpoint
│   └── admin.c / admin.h         # Admin API (local file uploads & JSON saves)
├── build.bat                     # Compile script (MinGW gcc → server.exe)
└── vercel.json                   # Vercel deployment & API rewrite config
```

---

## ⚙️ How it Works

The architecture is designed to be completely decoupled:

1. **The Data Layer:** Everything on the site (text, photo URLs, awards, services) is driven by a single JSON file: `data/portfolio_data.json`.
2. **The Frontend (`app.js`):** When a user loads `index.html`, `app.js` fetches `portfolio_data.json` and dynamically generates all the HTML (Gallery, Highlights, About section, etc.) on the fly.
3. **Local Environment:** When running locally, the custom C Server (`server.exe`) serves the static files and handles API POST requests from the admin panel to save images to the disk and update the JSON file.
4. **Production Environment (Vercel):** When deployed, Vercel serves the static files. The Admin panel detects it is running on a live server and switches to using the **GitHub API**. When the admin uploads a photo or changes text, `admin.js` commits the changes directly to the GitHub repository, which triggers a new Vercel deployment automatically.

---

## ✨ Core Features

### Frontend Experience
- **Responsive Gallery:** Fluid photo grid with category filters and a graceful **"Load More"** pagination system that maintains scroll stability.
- **Custom Lightbox:** A full-screen, immersive image viewer supporting keyboard navigation (← → Esc) and touch swipes.
- **Mobile Optimized:** Critical above-the-fold JSON data and images are preloaded via `<link rel="preload">` and `fetchpriority="high"` to break the "JS-Fetch Waterfall" and ensure near-instant mobile load times.
- **Scroll Animations:** IntersectionObserver triggers staggered fade-in animations as elements enter the viewport.
- **Interactive UI:** Smooth anchor scrolling, a top-edge reading progress bar, count-up statistics, and dynamic glassmorphism hover effects on cards.

### Portfolio Sections
- **Highlights:** Curated 3-column photo grid with pullquotes.
- **Gallery:** Filterable masonry-style photo grid.
- **Services:** Service cards detailing offerings with custom icons.
- **Projects:** Brand & Event folders that open dedicated mini-galleries.
- **Honors / Recognition:** Award cards featuring multi-photo thumbnail previews.
- **Testimonials:** Auto-rotating client review carousel.

---

## 🔒 Admin Panel (`/admin.html`)

The portfolio includes a hidden, password-protected dashboard allowing the site owner to manage content without touching code.

- **Live Editing:** Add, edit, or delete photos, awards, services, and testimonials.
- **Photo Staging System:** Select multiple files sequentially, preview them in a staging tray, and upload them in a single batch.
- **Client-Side Compression:** Photos are automatically compressed in the browser (via Canvas API) before upload to save bandwidth and storage.
- **Hybrid Saves:** Saves locally via the C Server API when testing, and saves globally via the GitHub API when live on Vercel.

---

## 🔮 What Could Be Better (Recommendations)

While the site is highly functional and beautifully designed, here are recommendations for future iterations:

### 🔴 Security (High Priority)
- **Replace plain-text `admin_pass.txt`:** Use a bcrypt hash compared server-side instead of plain-text passwords.
- **Rate Limiting:** Add rate limiting on `/api/admin/*` to prevent brute-force password attempts on the local server.
- **HTTPS / TLS:** The C server currently speaks plain HTTP. For production self-hosting (non-Vercel), put it behind nginx or Caddy with a TLS certificate.

### 🟡 Performance
- **Automated Thumbnail Generation:** Currently, the site loads compressed original images for the gallery thumbnails. Generating a separate, tiny `_thumb.webp` for each image would drastically reduce data usage on mobile devices.
- **Cache-Control Headers:** Add cache headers in the C router for static assets (images, CSS, JS) so browsers don't re-fetch them on every local visit.

### 🟢 UX / Design
- **Contact Form:** The contact section only features an email link. A fully wired HTML contact form would complete the UX loop.
- **Dark/Light Mode Toggle:** The CSS design system is fully tokenized. Adding a theme toggle would only require ~20 lines of JS and a `[data-theme="light"]` CSS block.

---

## 🚀 Running Locally

```bat
REM 1. Compile the C server
build.bat

REM 2. Run the server
server.exe

REM 3. Open in your browser
start http://localhost:8080
```

---

## 📝 License
Personal use only — Tanvir Ahammad Emon.
