# Tanvir Ahammad Emon — Photography Portfolio

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

## 📝 License

This project is provided for personal use. 
