# Lens & Light — Photography Portfolio

A dynamic photography portfolio website powered by a **custom C HTTP server** and a modern **Vanilla JavaScript** frontend.

> No Node.js. No Python. No React. Just C, HTML, CSS, and JavaScript.

---

## 📁 Project Structure

```
my web/
├── public/                 # Frontend assets (served by the C server)
│   ├── index.html          # Main HTML page
│   ├── css/style.css       # Styles — dark theme, responsive grid, animations
│   ├── js/app.js           # Dynamic rendering, lightbox, filters
│   └── images/             # Portfolio images
├── src/                    # C backend source code
│   ├── server.c            # HTTP server (Winsock2)
│   ├── router.c / .h       # URL routing
│   ├── api.c / .h          # /api/portfolio JSON endpoint
│   ├── mime.c / .h         # MIME type detection
│   └── portfolio_data.json # YOUR PORTFOLIO DATA (edit this!)
├── build.bat               # Compile script
└── README.md               # This file
```

---

## 🚀 Quick Start

### Prerequisites
- **GCC (MinGW-w64)** — Download from [winlibs.com](https://winlibs.com/) or [MSYS2](https://www.msys2.org/)
- Make sure `gcc` is in your system PATH

### Step 1: Compile
```cmd
cd "d:\my web"
build.bat
```
Or manually:
```cmd
gcc -Wall -Wextra -O2 -o server.exe src\server.c src\router.c src\api.c src\mime.c -lws2_32
```

### Step 2: Run
```cmd
server.exe
```
You should see:
```
=========================================
  Lens & Light — Portfolio Server
=========================================
[SERVER] Listening on http://127.0.0.1:8080
[SERVER] Press Ctrl+C to stop.
```

### Step 3: Browse
Open **http://localhost:8080** in your browser.

---

## ✏️ Updating Your Portfolio

Edit **`src/portfolio_data.json`** — no recompilation needed! The server reads this file on every request, so changes are **live** on refresh.

### Add a new photo:
```json
{
    "id": 9,
    "title": "My New Photo",
    "category": "Landscape",
    "url": "/images/my_photo.jpg",
    "thumbnail": "/images/my_photo.jpg",
    "description": "A beautiful sunset"
}
```
Add the image file to `public/images/` and add the entry to the `"photos"` array in the JSON file.

### Add a new category:
Add it to the `"categories"` array:
```json
"categories": ["All", "Landscape", "Portrait", "Street", "Architecture", "Wildlife"]
```

### Update your info:
Edit the `"site"` object to change your name, bio, email, and social links.

---

## 🔌 API

| Endpoint | Description |
|---|---|
| `GET /api/portfolio` | Returns the full portfolio JSON |
| `GET /api/portfolio?category=Landscape` | Returns photos filtered by category |

---

## 🛑 Stopping the Server

Press **Ctrl+C** in the terminal where the server is running.

---

## 📝 License

This project is provided for personal use. Customize and deploy as you wish.
