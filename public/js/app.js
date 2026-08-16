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
        heroLabel:    $('#hero-label'),
        heroTagline:  $('#hero-tagline'),
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
        navBackdrop:  $('#nav-backdrop'),
        mainNav:      $('#main-nav'),
        highlightsGrid:       $('#highlights-grid'),
        awardsGrid:           $('#awards-grid'),
        servicesGrid:         $('#services-grid'),
        portfoliosContent:    $('#portfolios-content'),
        clientsMarquee:       $('#clients-marquee'),
        testimonialsCarousel: $('#testimonials-carousel'),
        testimonialsDots:     $('#testimonials-dots'),
        loadMoreWrap:         $('#gallery-load-more-wrap'),
        loadMoreBtn:          $('#gallery-load-more-btn'),
        loadMoreCount:        $('#load-more-count'),
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
    const GALLERY_PAGE_SIZE = 6;  /* photos shown per batch */
    let galleryVisibleCount = GALLERY_PAGE_SIZE;

    /* -------------------------------------------------------------------
     * INIT — Entry point on DOMContentLoaded.
     * ------------------------------------------------------------------- */
    document.addEventListener('DOMContentLoaded', init);

    /* -------------------------------------------------------------------
     * PAGE PROGRESS BAR — shows a thin gold bar at the top while scrolling
     * ------------------------------------------------------------------- */
    (function setupProgressBar() {
        const bar = document.createElement('div');
        bar.id = 'page-progress';
        document.body.appendChild(bar);

        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrolled = window.scrollY;
                    const total    = document.documentElement.scrollHeight - window.innerHeight;
                    const pct      = total > 0 ? (scrolled / total) * 100 : 0;
                    bar.style.width = pct + '%';
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    })();

    function init() {
        setupHeader();
        setupMobileMenu();
        setupSmoothScroll();
        setupGalleryReset();
        updateFooterYear();
        fetchPortfolio();
    }

    /* -------------------------------------------------------------------
     * DATA FETCHING — Load portfolio JSON from the C backend.
     * ------------------------------------------------------------------- */
    async function fetchPortfolio() {
        // Show skeleton loading cards while fetching
        showGallerySkeleton();
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            portfolioData = await response.json();
        } catch (err) {
            console.error('[Portfolio] Failed to fetch data:', err);
            showError();
            return;
        }

        /* Each section is isolated — a broken render never blocks the others */
        const sections = [
            ['renderSiteData',       renderSiteData],
            ['renderHighlights',     renderHighlights],
            ['renderFilters',        renderFilters],
            ['renderGallery',        renderGallery],
            ['renderAwards',         renderAwards],
            ['renderServices',       renderServices],
            ['renderPortfolios',     renderPortfolios],
            ['renderClients',        renderClients],
            ['renderTestimonials',   renderTestimonials],
            ['setupScrollAnimations', setupScrollAnimations],
            ['setupStatsCountUp',    setupStatsCountUp],
        ];

        for (const [name, fn] of sections) {
            try {
                fn();
            } catch (err) {
                console.error(`[Portfolio] ${name}() failed:`, err);
            }
        }
    }

    function showGallerySkeleton() {
        if (!DOM.galleryGrid) return;
        DOM.galleryGrid.innerHTML = `
            <div class="gallery-skeleton">
                ${Array.from({length: 6}).map(() => '<div class="skeleton-card"></div>').join('')}
            </div>`;
    }

    /* -------------------------------------------------------------------
     * RENDER — Populate the DOM with portfolio data.
     * ------------------------------------------------------------------- */
    function renderSiteData() {
        const site = portfolioData.site;

        /* Hero tagline */
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
                DOM.aboutInitial.style.display = 'none';
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
                     loading="lazy" decoding="async" draggable="false">
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
     * PORTFOLIOS — Brand / Event / Corporate folder cards.
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
                renderGallery(true); // animate = true
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
     * GALLERY — Render photo cards with pagination + Load More button.
     * ------------------------------------------------------------------- */
    function renderGallery(animate = true) {
        if (!DOM.galleryGrid || !portfolioData.photos) return;

        /* Filter photos */
        filteredPhotos = activeCategory === 'All'
            ? portfolioData.photos
            : portfolioData.photos.filter((p) => {
                if (Array.isArray(p.category)) return p.category.includes(activeCategory);
                return p.category === activeCategory;
            });

        /* Reset to first page whenever filter changes */
        galleryVisibleCount = GALLERY_PAGE_SIZE;

        function buildCards(startIndex, appendMode = false) {
            if (!appendMode) DOM.galleryGrid.innerHTML = '';

            if (filteredPhotos.length === 0) {
                DOM.galleryGrid.innerHTML =
                    '<div class="gallery-loading"><p>No photos in this category yet.</p></div>';
                hideLoadMore();
                return;
            }

            const slice = filteredPhotos.slice(startIndex, startIndex + GALLERY_PAGE_SIZE);
            const firstNewIndex = DOM.galleryGrid.querySelectorAll('.photo-card').length;

            slice.forEach((photo, sliceIdx) => {
                const index = startIndex + sliceIdx; /* real index into filteredPhotos */
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
                         decoding="async"
                         draggable="false">
                    <div class="photo-card-overlay">
                        <span class="photo-card-category">${escapeHtml(Array.isArray(photo.category) ? photo.category.join(', ') : photo.category)}</span>
                        <h3 class="photo-card-title">${escapeHtml(photo.title)}</h3>
                        <p class="photo-card-desc">${escapeHtml(photo.description)}</p>
                    </div>
                `;

                card.addEventListener('click', () => openLightbox(index));
                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openLightbox(index);
                    }
                });

                DOM.galleryGrid.appendChild(card);
            });

            /* Staggered entrance animations — only for newly added cards */
            requestAnimationFrame(() => {
                const allCards = DOM.galleryGrid.querySelectorAll('.photo-card');
                allCards.forEach((card, i) => {
                    if (i >= firstNewIndex) {
                        setTimeout(() => card.classList.add('visible'), (i - firstNewIndex) * 60);
                    }
                });
            });

            updateLoadMore();
        }

        let loadMoreTimeouts = [];

        function updateLoadMore() {
            const remaining = filteredPhotos.length - galleryVisibleCount;
            if (!DOM.loadMoreWrap) return;

            if (remaining <= 0) {
                DOM.loadMoreWrap.classList.add('all-loaded');
                DOM.loadMoreWrap.classList.add('visible');
                DOM.loadMoreWrap.classList.remove('hidden');
            } else {
                DOM.loadMoreWrap.classList.remove('all-loaded');
                DOM.loadMoreWrap.classList.remove('hidden');
                
                /* Animate in slightly after cards appear */
                setTimeout(() => DOM.loadMoreWrap.classList.add('visible'), 200);
                
                if (DOM.loadMoreCount) {
                    const prev = DOM.loadMoreCount.textContent;
                    DOM.loadMoreCount.textContent = `+${remaining}`;
                    /* Pop badge when count changes */
                    if (prev !== `+${remaining}`) {
                        DOM.loadMoreCount.classList.remove('pop');
                        void DOM.loadMoreCount.offsetWidth; /* reflow */
                        DOM.loadMoreCount.classList.add('pop');
                    }
                }
            }
        }

        /* Wire the button (idempotent — only attaches once) */
        if (DOM.loadMoreBtn && !DOM.loadMoreBtn._wired) {
            DOM.loadMoreBtn._wired = true;
            DOM.loadMoreBtn.addEventListener('click', (e) => {
                /* Loading state */
                DOM.loadMoreBtn.classList.add('loading');
                DOM.loadMoreBtn.disabled = true;

                const start = galleryVisibleCount;
                galleryVisibleCount += GALLERY_PAGE_SIZE;

                /* Short delay so loading animation is visible */
                setTimeout(() => {
                    buildCards(start, /* appendMode= */ true);
                    DOM.loadMoreBtn.classList.remove('loading');
                    DOM.loadMoreBtn.disabled = false;
                }, 320);
            });
        }

        if (animate) {
            DOM.galleryGrid.classList.add('filtering');
            if (DOM.loadMoreWrap) {
                DOM.loadMoreWrap.classList.remove('visible');
            }
            setTimeout(() => {
                buildCards(0, false);
                DOM.galleryGrid.classList.remove('filtering');
            }, 220);
        } else {
            buildCards(0, false);
        }
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
        let ticking = false;
        const onScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    if (DOM.header) DOM.header.classList.toggle('scrolled', window.scrollY > 60);
                    ticking = false;
                });
                ticking = true;
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        
        // Initial check without rAF needed for fast load
        if (DOM.header) DOM.header.classList.toggle('scrolled', window.scrollY > 60);
    }

    /* -------------------------------------------------------------------
     * MOBILE MENU — Toggle hamburger menu.
     * ------------------------------------------------------------------- */
    function setupMobileMenu() {
        if (!DOM.mobileToggle || !DOM.mainNav) return;

        const openMenu = () => {
            DOM.mobileToggle.classList.add('active');
            DOM.mainNav.classList.add('open');
            if (DOM.navBackdrop) DOM.navBackdrop.classList.add('active');
        };

        const closeMenu = () => {
            DOM.mobileToggle.classList.remove('active');
            DOM.mainNav.classList.remove('open');
            if (DOM.navBackdrop) DOM.navBackdrop.classList.remove('active');
        };

        DOM.mobileToggle.addEventListener('click', () => {
            DOM.mainNav.classList.contains('open') ? closeMenu() : openMenu();
        });

        /* Close menu on nav link click */
        DOM.mainNav.querySelectorAll('.nav-link').forEach((link) => {
            link.addEventListener('click', closeMenu);
        });

        /* Close menu when tapping outside (backdrop) */
        if (DOM.navBackdrop) {
            DOM.navBackdrop.addEventListener('click', closeMenu);
        }
    }

    /* -------------------------------------------------------------------
     * GALLERY RESET — Reset to 6 photos when user leaves the gallery
     * ------------------------------------------------------------------- */
    function setupGalleryReset() {
        const gallerySection = document.getElementById('gallery');
        if (!gallerySection) return;

        let isGalleryOutOfView = false;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                isGalleryOutOfView = !entry.isIntersecting;
            });
        }, { threshold: 0 });

        observer.observe(gallerySection);

        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            
            /* Debounce: only reset when the user STOPS scrolling for 300ms.
               This completely eliminates the "screen shake" from fighting scroll momentum! */
            scrollTimeout = setTimeout(() => {
                if (isGalleryOutOfView && galleryVisibleCount > GALLERY_PAGE_SIZE) {
                    const oldHeight = gallerySection.getBoundingClientRect().height;
                    const rect = gallerySection.getBoundingClientRect();
                    
                    galleryVisibleCount = GALLERY_PAGE_SIZE;
                    renderGallery(false);
                    
                    /* If gallery is above viewport, collapsing it pulls the page up.
                       We compensate the scroll position so the user's view doesn't jump. */
                    if (rect.bottom <= 0) {
                        const newHeight = gallerySection.getBoundingClientRect().height;
                        window.scrollBy(0, -(oldHeight - newHeight));
                    }
                }
            }, 300);
        }, { passive: true });
    }

    /* -------------------------------------------------------------------
     * SMOOTH SCROLL — For anchor links.
     * ------------------------------------------------------------------- */
    function setupSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach((link) => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                const target = document.querySelector(href);
                
                /* Instantly collapse gallery if expanded, before smooth scroll starts */
                if (galleryVisibleCount > GALLERY_PAGE_SIZE) {
                    const gallerySection = document.getElementById('gallery');
                    if (gallerySection) {
                        const oldHeight = gallerySection.getBoundingClientRect().height;
                        const oldTop = gallerySection.getBoundingClientRect().top;
                        
                        galleryVisibleCount = GALLERY_PAGE_SIZE;
                        renderGallery(false);
                        
                        /* Compensate scroll if gallery was above current view */
                        if (oldTop < 0) {
                            const newHeight = gallerySection.getBoundingClientRect().height;
                            window.scrollBy(0, -(oldHeight - newHeight));
                        }
                    }
                }

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
            { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
        );

        revealElements.forEach((el) => observer.observe(el));

        /* Also observe individual cards for staggered reveal */
        const cardObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        /* Stagger siblings by order within their parent */
                        const siblings = Array.from(entry.target.parentElement.children);
                        const idx = siblings.indexOf(entry.target);
                        setTimeout(() => entry.target.classList.add('visible'), idx * 80);
                        cardObserver.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.08, rootMargin: '0px 0px -20px 0px' }
        );

        [...$$('.award-card'), ...$$('.service-card'), ...$$('.highlight-card'), ...$$('.project-folder')].forEach((card) => {
            card.classList.remove('visible');
            cardObserver.observe(card);
        });
    }

    /* -------------------------------------------------------------------
     * COUNT-UP ANIMATION — Animates stat numbers when about section visible.
     * ------------------------------------------------------------------- */
    function setupStatsCountUp() {
        const statNumbers = $$('.stat-number');
        if (!statNumbers.length) return;

        // Store targets before zeroing them out
        const targets = Array.from(statNumbers).map(el => {
            const raw = el.textContent.trim();
            const num = parseInt(raw.replace(/[^0-9]/g, ''), 10) || 0;
            const suffix = raw.replace(/[0-9]/g, '').trim();
            return { el, num, suffix, started: false };
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const target = targets.find(t => t.el === entry.target);
                if (!target || target.started) return;
                target.started = true;
                animateCount(target.el, target.num, target.suffix);
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.5 });

        statNumbers.forEach(el => observer.observe(el));
    }

    function animateCount(el, target, suffix) {
        const duration = 1200;
        const start = performance.now();
        const step = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(eased * target);
            el.textContent = current + suffix;
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = target + suffix;
                el.classList.add('count-pulse');
                setTimeout(() => el.classList.remove('count-pulse'), 200);
            }
        };
        requestAnimationFrame(step);
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
