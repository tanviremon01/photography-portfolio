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
        /* New section DOM refs */
        highlightsGrid:          $('#highlights-grid'),
        awardsGrid:              $('#awards-grid'),
        servicesGrid:            $('#services-grid'),
        portfoliosTabs:          $('#portfolios-tabs'),
        portfoliosContent:       $('#portfolios-content'),
        clientsMarquee:          $('#clients-marquee'),
        testimonialsCarousel:    $('#testimonials-carousel'),
        testimonialsDots:        $('#testimonials-dots'),
    };

    /* -------------------------------------------------------------------
     * State
     * ------------------------------------------------------------------- */
    let portfolioData = null;
    let activeCategory = 'All';
    let lightboxIndex = -1;
    let filteredPhotos = [];
    let testimonialTimer = null;
    let activeTestimonial = 0;

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
            renderHighlights();
            renderFilters();
            renderGallery();
            renderAwards();
            renderServices();
            renderPortfolios();
            renderClients();
            renderTestimonials();
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
            
            const SVG_ICONS = {
                linkedin: '<svg viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>',
                instagram: '<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
                facebook: '<svg viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>'
            };

            for (const [platform, url] of Object.entries(site.social)) {
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.className = 'social-link';
                a.setAttribute('aria-label', platform);
                a.innerHTML = SVG_ICONS[platform.toLowerCase()] || capitalize(platform);
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
     * HIGHLIGHTS — Render unified curated showcase.
     * ------------------------------------------------------------------- */
    function renderHighlights() {
        if (!portfolioData.highlights || !Array.isArray(portfolioData.highlights) || !DOM.highlightsGrid) return;

        const photos = portfolioData.photos;

        function findPhoto(id) {
            return photos.find((p) => p.id === id);
        }

        DOM.highlightsGrid.innerHTML = '';

        portfolioData.highlights.forEach((hl, i) => {
            const photo = findPhoto(hl.photo_id);
            if (!photo) return;

            const card = document.createElement('div');
            card.className = 'highlight-card';

            const categoryText = Array.isArray(photo.category)
                ? photo.category.join(' / ')
                : photo.category;

            card.innerHTML = `
                <img src="${escapeHtml(photo.url)}"
                     alt="${escapeHtml(photo.title)}"
                     loading="lazy" draggable="false">
                <div class="highlight-overlay">
                    <span class="highlight-category">${escapeHtml(categoryText)}</span>
                    <h4 class="highlight-title">${escapeHtml(photo.title)}</h4>
                    <p class="highlight-pullquote">"${escapeHtml(hl.pullquote)}"</p>
                </div>
            `;

            /* Click opens lightbox */
            card.addEventListener('click', () => {
                activeCategory = 'All';
                updateFilterButtons();
                renderGallery();
                const idx = filteredPhotos.findIndex((p) => p.id === photo.id);
                if (idx >= 0) openLightbox(idx);
            });

            DOM.highlightsGrid.appendChild(card);
        });

        /* Staggered entrance */
        requestAnimationFrame(() => {
            const cards = DOM.highlightsGrid.querySelectorAll('.highlight-card');
            cards.forEach((card, i) => {
                setTimeout(() => card.classList.add('visible'), i * 100);
            });
        });
    }

    /* -------------------------------------------------------------------
     * AWARDS — Render awards & certificates with glass cards.
     * ------------------------------------------------------------------- */
    function renderAwards() {
        if (!portfolioData.awards || !DOM.awardsGrid) return;

        DOM.awardsGrid.innerHTML = '';

        const trophyIcons = ['🏆', '🥇', '🎖️', '📜'];

        portfolioData.awards.forEach((award, i) => {
            const card = document.createElement('div');
            card.className = 'award-card';

            card.innerHTML = `
                <span class="award-icon">${trophyIcons[i % trophyIcons.length]}</span>
                <span class="award-year">${escapeHtml(String(award.year))}</span>
                <h3 class="award-title">${escapeHtml(award.title)}</h3>
                <p class="award-org">${escapeHtml(award.organization)}</p>
                <p class="award-desc">${escapeHtml(award.description)}</p>
            `;

            DOM.awardsGrid.appendChild(card);
        });

        /* Staggered entrance animation */
        requestAnimationFrame(() => {
            const cards = DOM.awardsGrid.querySelectorAll('.award-card');
            cards.forEach((card, i) => {
                setTimeout(() => card.classList.add('visible'), i * 120);
            });
        });
    }

    /* -------------------------------------------------------------------
     * SERVICES — Render service offering cards.
     * ------------------------------------------------------------------- */
    function renderServices() {
        if (!portfolioData.services || !DOM.servicesGrid) return;

        DOM.servicesGrid.innerHTML = '';

        portfolioData.services.forEach((service, i) => {
            const card = document.createElement('div');
            card.className = 'service-card';

            const featuresHtml = service.features
                .map((f) => `<li>${escapeHtml(f)}</li>`)
                .join('');

            card.innerHTML = `
                <span class="service-icon">${service.icon}</span>
                <h3 class="service-title">${escapeHtml(service.title)}</h3>
                <p class="service-desc">${escapeHtml(service.description)}</p>
                <ul class="service-features">
                    ${featuresHtml}
                </ul>
            `;

            DOM.servicesGrid.appendChild(card);
        });

        /* Staggered entrance animation */
        requestAnimationFrame(() => {
            const cards = DOM.servicesGrid.querySelectorAll('.service-card');
            cards.forEach((card, i) => {
                setTimeout(() => card.classList.add('visible'), i * 100);
            });
        });
    }

    /* -------------------------------------------------------------------
     * PORTFOLIOS — Brand / Event / Corporate folder cards with tabs.
     * ------------------------------------------------------------------- */
    /* -------------------------------------------------------------------
     * PORTFOLIOS — Brand / Event / Corporate folders.
     * ------------------------------------------------------------------- */
    function renderPortfolios() {
        if (!portfolioData.portfolios || !DOM.portfoliosContent) return;

        DOM.portfoliosContent.innerHTML = '';

        portfolioData.portfolios.forEach((folder) => {
            const card = document.createElement('div');
            card.className = 'project-folder clickable-folder';
            card.style.cursor = 'pointer';

            card.innerHTML = `
                <div class="project-folder-header">
                    <svg class="folder-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/>
                    </svg>
                    <h3 class="project-folder-name">${escapeHtml(folder.type)}</h3>
                </div>
                <div class="project-folder-body">
                    <p class="project-folder-desc">${escapeHtml(folder.description)}</p>
                    <span class="project-folder-type-badge">${folder.icon} ${escapeHtml((folder.photos ? folder.photos.length : 0) + ' Photos')}</span>
                </div>
            `;

            /* Click opens lightbox with only these photos */
            card.addEventListener('click', () => {
                if (!folder.photos || folder.photos.length === 0) return;
                
                filteredPhotos = folder.photos;
                openLightbox(0);
            });

            DOM.portfoliosContent.appendChild(card);
        });

        /* Staggered entrance */
        requestAnimationFrame(() => {
            const cards = DOM.portfoliosContent.querySelectorAll('.project-folder');
            cards.forEach((card, i) => {
                setTimeout(() => card.classList.add('visible'), i * 80);
            });
        });
    }

    /* -------------------------------------------------------------------
     * CLIENTS — Render infinite marquee of client names.
     * ------------------------------------------------------------------- */
    function renderClients() {
        if (!portfolioData.clients || !DOM.clientsMarquee) return;

        DOM.clientsMarquee.innerHTML = '';

        /* Build one set of client items */
        function buildClientItems() {
            const fragment = document.createDocumentFragment();
            portfolioData.clients.forEach((client, i) => {
                const item = document.createElement('div');
                item.className = 'client-item';

                item.innerHTML = `
                    <span class="client-name">${escapeHtml(client.name)}</span>
                    <span class="client-dot"></span>
                `;

                fragment.appendChild(item);
            });
            return fragment;
        }

        /* Duplicate for seamless infinite loop */
        DOM.clientsMarquee.appendChild(buildClientItems());
        DOM.clientsMarquee.appendChild(buildClientItems());
    }

    /* -------------------------------------------------------------------
     * TESTIMONIALS — Render carousel with auto-rotation.
     * ------------------------------------------------------------------- */
    function renderTestimonials() {
        if (!portfolioData.testimonials || !DOM.testimonialsCarousel) return;

        DOM.testimonialsCarousel.innerHTML = '';
        if (DOM.testimonialsDots) DOM.testimonialsDots.innerHTML = '';

        portfolioData.testimonials.forEach((t, i) => {
            /* Card */
            const card = document.createElement('div');
            card.className = 'testimonial-card' + (i === 0 ? ' active' : '');
            card.setAttribute('data-index', i);

            const stars = '★'.repeat(t.rating) + '☆'.repeat(5 - t.rating);

            card.innerHTML = `
                <div class="testimonial-quote-mark">"</div>
                <p class="testimonial-quote">${escapeHtml(t.quote)}</p>
                <div class="testimonial-stars">${stars}</div>
                <p class="testimonial-author">${escapeHtml(t.name)}</p>
                <p class="testimonial-role">${escapeHtml(t.role)}</p>
            `;

            DOM.testimonialsCarousel.appendChild(card);

            /* Dot */
            if (DOM.testimonialsDots) {
                const dot = document.createElement('button');
                dot.className = 'testimonial-dot' + (i === 0 ? ' active' : '');
                dot.setAttribute('aria-label', 'View testimonial from ' + t.name);
                dot.addEventListener('click', () => goToTestimonial(i));
                DOM.testimonialsDots.appendChild(dot);
            }
        });

        /* Start auto-rotation */
        activeTestimonial = 0;
        startTestimonialAutoRotation();
    }

    function goToTestimonial(index) {
        const cards = DOM.testimonialsCarousel.querySelectorAll('.testimonial-card');
        const dots = DOM.testimonialsDots ? DOM.testimonialsDots.querySelectorAll('.testimonial-dot') : [];

        cards.forEach((c) => c.classList.remove('active'));
        dots.forEach((d) => d.classList.remove('active'));

        activeTestimonial = index;
        if (cards[index]) cards[index].classList.add('active');
        if (dots[index]) dots[index].classList.add('active');

        /* Reset timer */
        startTestimonialAutoRotation();
    }

    function startTestimonialAutoRotation() {
        if (testimonialTimer) clearInterval(testimonialTimer);
        if (!portfolioData.testimonials || portfolioData.testimonials.length <= 1) return;

        testimonialTimer = setInterval(() => {
            const next = (activeTestimonial + 1) % portfolioData.testimonials.length;
            goToTestimonial(next);
        }, 5000);
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
        if (!DOM.filterBar) return;
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
        
        /* Restore original filteredPhotos array in case it was overridden by folder click */
        if (portfolioData && portfolioData.photos) {
            filteredPhotos = activeCategory === 'All'
                ? portfolioData.photos
                : portfolioData.photos.filter((p) => {
                    if (Array.isArray(p.category)) return p.category.includes(activeCategory);
                    return p.category === activeCategory;
                });
        }
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
            ...$$('.highlights-grid'),
            ...$$('.portfolios-tabs'),
            ...$$('.clients-marquee-wrapper'),
            ...$$('.testimonials-carousel'),
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

        /* Also observe individual cards for staggered reveal */
        const cardObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        cardObserver.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.1, rootMargin: '0px 0px -20px 0px' }
        );

        [...$$('.award-card'), ...$$('.service-card'), ...$$('.highlight-card'), ...$$('.project-folder')].forEach((card) => {
            card.classList.remove('visible');
            cardObserver.observe(card);
        });
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
