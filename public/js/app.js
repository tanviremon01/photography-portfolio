/* ===========================================================================
   Lens & Light — Photography Portfolio
   Dynamic Rendering, Lightbox, Filters & Scroll Animations
   =========================================================================== */

(function () {
    'use strict';

    /* -------------------------------------------------------------------
     * API endpoint — the C server provides this.
     * ------------------------------------------------------------------- */
    const API_URL = '/api/portfolio';

    /* -------------------------------------------------------------------
     * DOM references (cached once on load).
     * ------------------------------------------------------------------- */
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const DOM = {
        header:       $('#site-header'),
        heroTitle:    $('#hero-title'),
        heroTagline:  $('#hero-tagline'),
        heroLabel:    $('#hero-label'),
        filterBar:    $('#filter-bar'),
        galleryGrid:  $('#gallery-grid'),
        galleryLoad:  $('#gallery-loading'),
        aboutName:    $('#about-name'),
        aboutBio:     $('#about-bio'),
        aboutInitial: $('#about-initial'),
        authorPhoto:  $('#author-photo'),
        statPhotos:   $('#stat-photos'),
        contactEmail: $('#contact-email-link'),
        socialLinks:  $('#social-links'),
        footerYear:   $('#footer-year'),
        footerAuthor: $('#footer-author'),
        lightbox:     $('#lightbox-overlay'),
        lbImage:      $('#lightbox-image'),
        lbTitle:      $('#lightbox-title'),
        lbDesc:       $('#lightbox-desc'),
        lbClose:      $('#lightbox-close'),
        lbPrev:       $('#lightbox-prev'),
        lbNext:       $('#lightbox-next'),
        mobileToggle: $('#mobile-menu-toggle'),
        mainNav:      $('#main-nav'),
    };

    /* -------------------------------------------------------------------
     * State
     * ------------------------------------------------------------------- */
    let portfolioData = null;
    let activeCategory = 'All';
    let lightboxIndex = -1;
    let filteredPhotos = [];

    /* -------------------------------------------------------------------
     * INIT — Entry point on DOMContentLoaded.
     * ------------------------------------------------------------------- */
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        setupHeader();
        setupMobileMenu();
        setupSmoothScroll();
        updateFooterYear();
        fetchPortfolio();
    }

    /* -------------------------------------------------------------------
     * DATA FETCHING — Load portfolio JSON from the C backend.
     * ------------------------------------------------------------------- */
    async function fetchPortfolio() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            portfolioData = await response.json();
            renderSiteData();
            renderFilters();
            renderGallery();
            setupScrollAnimations();
        } catch (err) {
            console.error('[Portfolio] Failed to fetch data:', err);
            showError();
        }
    }

    /* -------------------------------------------------------------------
     * RENDER — Populate the DOM with portfolio data.
     * ------------------------------------------------------------------- */
    function renderSiteData() {
        const site = portfolioData.site;

        /* Hero */
        if (site.tagline && DOM.heroTagline) {
            DOM.heroTagline.textContent = site.tagline;
        }

        /* About */
        if (site.author && DOM.aboutName) {
            DOM.aboutName.textContent = site.author;
        }
        if (site.bio && DOM.aboutBio) {
            DOM.aboutBio.textContent = site.bio;
        }
        if (site.author && DOM.aboutInitial) {
            DOM.aboutInitial.textContent = site.author.charAt(0);
        }
        if (site.author_photo && DOM.authorPhoto) {
            DOM.authorPhoto.src = site.author_photo;
            DOM.authorPhoto.style.display = 'block';
            if (DOM.aboutInitial) {
                DOM.aboutInitial.style.display = 'none'; // hide initials if photo exists
            }
        }

        /* Stats */
        if (DOM.statPhotos) {
            DOM.statPhotos.textContent = portfolioData.photos.length;
        }

        /* Contact */
        if (site.contact_email && DOM.contactEmail) {
            DOM.contactEmail.href = 'mailto:' + site.contact_email;
            DOM.contactEmail.textContent = site.contact_email;
        }

        /* Social links */
        if (site.social && DOM.socialLinks) {
            DOM.socialLinks.innerHTML = '';
            for (const [platform, url] of Object.entries(site.social)) {
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.className = 'social-link';
                a.textContent = capitalize(platform);
                DOM.socialLinks.appendChild(a);
            }
        }

        /* Footer */
        if (site.author && DOM.footerAuthor) {
            DOM.footerAuthor.textContent = site.author;
        }

        /* Page title */
        if (site.title) {
            document.title = site.title + ' — Photography Portfolio';
        }
    }

    /* -------------------------------------------------------------------
     * FILTERS — Build category buttons.
     * ------------------------------------------------------------------- */
    function renderFilters() {
        if (!DOM.filterBar || !portfolioData.categories) return;

        DOM.filterBar.innerHTML = '';

        portfolioData.categories.forEach((cat) => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn' + (cat === activeCategory ? ' active' : '');
            btn.textContent = cat;
            btn.setAttribute('aria-label', 'Filter by ' + cat);
            btn.addEventListener('click', () => {
                activeCategory = cat;
                updateFilterButtons();
                renderGallery();
            });
            DOM.filterBar.appendChild(btn);
        });
    }

    function updateFilterButtons() {
        DOM.filterBar.querySelectorAll('.filter-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.textContent === activeCategory);
        });
    }

    /* -------------------------------------------------------------------
     * GALLERY — Render photo cards into the CSS Grid.
     * ------------------------------------------------------------------- */
    function renderGallery() {
        if (!DOM.galleryGrid || !portfolioData.photos) return;

        /* Filter photos */
        filteredPhotos = activeCategory === 'All'
            ? portfolioData.photos
            : portfolioData.photos.filter((p) => {
                if (Array.isArray(p.category)) {
                    return p.category.includes(activeCategory);
                }
                return p.category === activeCategory;
            });

        /* Clear existing content */
        DOM.galleryGrid.innerHTML = '';

        if (filteredPhotos.length === 0) {
            DOM.galleryGrid.innerHTML =
                '<div class="gallery-loading"><p>No photos in this category yet.</p></div>';
            return;
        }

        /* Build photo cards */
        filteredPhotos.forEach((photo, index) => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            card.setAttribute('data-index', index);
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', 'View ' + photo.title);

            card.innerHTML = `
                <img src="${escapeHtml(photo.thumbnail || photo.url)}"
                     alt="${escapeHtml(photo.title)}"
                     loading="lazy"
                     draggable="false">
                <div class="photo-card-overlay">
                    <span class="photo-card-category">${escapeHtml(Array.isArray(photo.category) ? photo.category.join(', ') : photo.category)}</span>
                    <h3 class="photo-card-title">${escapeHtml(photo.title)}</h3>
                    <p class="photo-card-desc">${escapeHtml(photo.description)}</p>
                </div>
            `;

            /* Click to open lightbox */
            card.addEventListener('click', () => openLightbox(index));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openLightbox(index);
                }
            });

            DOM.galleryGrid.appendChild(card);
        });

        /* Trigger entrance animations */
        requestAnimationFrame(() => {
            const cards = DOM.galleryGrid.querySelectorAll('.photo-card');
            cards.forEach((card, i) => {
                setTimeout(() => card.classList.add('visible'), i * 80);
            });
        });
    }

    /* -------------------------------------------------------------------
     * LIGHTBOX — Full-screen image viewer.
     * ------------------------------------------------------------------- */
    function openLightbox(index) {
        lightboxIndex = index;
        updateLightboxContent();
        DOM.lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        DOM.lightbox.classList.remove('active');
        document.body.style.overflow = '';
        lightboxIndex = -1;
    }

    function navigateLightbox(direction) {
        if (filteredPhotos.length === 0) return;
        lightboxIndex = (lightboxIndex + direction + filteredPhotos.length) % filteredPhotos.length;
        updateLightboxContent();
    }

    function updateLightboxContent() {
        const photo = filteredPhotos[lightboxIndex];
        if (!photo) return;

        DOM.lbImage.src = photo.url;
        DOM.lbImage.alt = photo.title;
        DOM.lbTitle.textContent = photo.title;
        DOM.lbDesc.textContent = photo.description;
    }

    /* Lightbox event listeners */
    if (DOM.lbClose)  DOM.lbClose.addEventListener('click', closeLightbox);
    if (DOM.lbPrev)   DOM.lbPrev.addEventListener('click', () => navigateLightbox(-1));
    if (DOM.lbNext)   DOM.lbNext.addEventListener('click', () => navigateLightbox(1));

    /* Click outside image to close */
    if (DOM.lightbox) {
        DOM.lightbox.addEventListener('click', (e) => {
            if (e.target === DOM.lightbox) closeLightbox();
        });
    }

    /* Keyboard navigation */
    document.addEventListener('keydown', (e) => {
        if (!DOM.lightbox.classList.contains('active')) return;
        if (e.key === 'Escape')      closeLightbox();
        if (e.key === 'ArrowLeft')   navigateLightbox(-1);
        if (e.key === 'ArrowRight')  navigateLightbox(1);
    });

    /* Touch swipe support */
    (function setupSwipe() {
        let touchStartX = 0;
        if (!DOM.lightbox) return;

        DOM.lightbox.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        DOM.lightbox.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].screenX - touchStartX;
            if (Math.abs(dx) > 50) {
                navigateLightbox(dx > 0 ? -1 : 1);
            }
        }, { passive: true });
    })();

    /* -------------------------------------------------------------------
     * HEADER — Scroll-based background.
     * ------------------------------------------------------------------- */
    function setupHeader() {
        const onScroll = () => {
            if (!DOM.header) return;
            DOM.header.classList.toggle('scrolled', window.scrollY > 60);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* -------------------------------------------------------------------
     * MOBILE MENU — Toggle hamburger menu.
     * ------------------------------------------------------------------- */
    function setupMobileMenu() {
        if (!DOM.mobileToggle || !DOM.mainNav) return;

        DOM.mobileToggle.addEventListener('click', () => {
            DOM.mobileToggle.classList.toggle('active');
            DOM.mainNav.classList.toggle('open');
        });

        /* Close menu on nav link click */
        DOM.mainNav.querySelectorAll('.nav-link').forEach((link) => {
            link.addEventListener('click', () => {
                DOM.mobileToggle.classList.remove('active');
                DOM.mainNav.classList.remove('open');
            });
        });
    }

    /* -------------------------------------------------------------------
     * SMOOTH SCROLL — For anchor links.
     * ------------------------------------------------------------------- */
    function setupSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach((link) => {
            link.addEventListener('click', (e) => {
                const target = document.querySelector(link.getAttribute('href'));
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    /* -------------------------------------------------------------------
     * SCROLL ANIMATIONS — IntersectionObserver-based reveals.
     * ------------------------------------------------------------------- */
    function setupScrollAnimations() {
        const revealElements = [
            ...$$('.section-header'),
            ...$$('.about-inner'),
            ...$$('.contact-inner'),
            ...$$('.filter-bar'),
        ];

        revealElements.forEach((el) => el.classList.add('reveal'));

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
        );

        revealElements.forEach((el) => observer.observe(el));
    }

    /* -------------------------------------------------------------------
     * ERROR STATE — Show when API fetch fails.
     * ------------------------------------------------------------------- */
    function showError() {
        if (DOM.galleryLoad) {
            DOM.galleryLoad.innerHTML =
                '<p style="color: var(--color-accent);">⚠ Could not load portfolio data.</p>' +
                '<p style="font-size: 0.85rem;">Make sure the C server is running on port 8080.</p>';
        }
    }

    /* -------------------------------------------------------------------
     * UTILITIES
     * ------------------------------------------------------------------- */
    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function updateFooterYear() {
        if (DOM.footerYear) {
            DOM.footerYear.textContent = new Date().getFullYear();
        }
    }

})();
