/* ===========================================================================
   Admin Panel — Full Portfolio Management
   Auth, Upload, Photo CRUD, Project CRUD, Data Editing
   =========================================================================== */

(function () {
    'use strict';

    /* -------------------------------------------------------------------
     * Constants
     * ------------------------------------------------------------------- */
    const API_URL      = '/api/portfolio';
    const UPLOAD_URL   = '/api/upload';
    const SAVE_URL     = '/api/portfolio/save';
    const VERIFY_URL   = '/api/admin/verify';
    const DELETE_URL   = '/api/upload/delete';
    const FORGOT_URL   = '/api/admin/forgot';
    const PASSWORD_URL = '/api/admin/password';

    /* -------------------------------------------------------------------
     * State
     * ------------------------------------------------------------------- */
    let data           = null;   // Full portfolio data object
    let token          = '';     // Admin auth token
    let currentSection = 'dashboard';
    let modalCallback  = null;   // For modal confirm/cancel

    /* -------------------------------------------------------------------
     * DOM Helpers
     * ------------------------------------------------------------------- */
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    function escapeHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    /* ===================================================================
     * INITIALIZATION
     * =================================================================== */
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        setupLoginForm();
        setupNavigation();
        setupLogout();
        setupMobileSidebar();

        // Check for existing session
        token = sessionStorage.getItem('adminToken') || '';
        if (token) verifyToken();
    }

    /* ===================================================================
     * AUTHENTICATION
     * =================================================================== */
    function setupLoginForm() {
        const form = $('#login-form');
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pw = $('#login-password').value.trim();
            if (!pw) return;
            token = pw;
            await verifyToken();
        });

        const forgotLink = $('#forgot-password-link');
        if (forgotLink) {
            forgotLink.addEventListener('click', async (e) => {
                e.preventDefault();
                forgotLink.textContent = 'Sending email...';
                forgotLink.style.pointerEvents = 'none';
                try {
                    const res = await fetch(FORGOT_URL, { method: 'POST' });
                    const data = await res.json();
                    if (res.ok) {
                        $('#login-error').style.color = 'var(--green)';
                        $('#login-error').textContent = 'Reset email sent! Check your inbox.';
                    } else {
                        throw new Error(data.error || 'Failed to send reset email');
                    }
                } catch (err) {
                    $('#login-error').style.color = 'var(--red)';
                    $('#login-error').textContent = err.message;
                }
                forgotLink.textContent = 'Forgot Password?';
                forgotLink.style.pointerEvents = 'auto';
            });
        }
    }

    async function verifyToken() {
        try {
            const res = await fetch(VERIFY_URL, {
                method: 'POST',
                headers: { 'X-Admin-Token': token }
            });
            if (res.ok) {
                sessionStorage.setItem('adminToken', token);
                showAdmin();
            } else {
                throw new Error('Invalid');
            }
        } catch {
            sessionStorage.removeItem('adminToken');
            token = '';
            const err = $('#login-error');
            if (err) err.textContent = 'Invalid password. Please try again.';
            showLogin();
        }
    }

    function showAdmin() {
        $('#login-overlay').style.display = 'none';
        $('#admin-layout').style.display = 'flex';
        loadData();
    }

    function showLogin() {
        $('#login-overlay').style.display = 'flex';
        $('#admin-layout').style.display = 'none';
    }

    function setupLogout() {
        const btn = $('#logout-btn');
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem('adminToken');
            token = '';
            data = null;
            $('#login-password').value = '';
            $('#login-error').textContent = '';
            showLogin();
        });
    }

    /* ===================================================================
     * DATA MANAGEMENT
     * =================================================================== */
    async function loadData() {
        try {
            const res = await fetch(API_URL);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            data = await res.json();
            renderAll();
        } catch (err) {
            showToast('Failed to load portfolio data: ' + err.message, 'error');
        }
    }

    async function saveData() {
        try {
            const res = await fetch(SAVE_URL, {
                method: 'POST',
                headers: {
                    'X-Admin-Token': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data, null, 4)
            });
            if (!res.ok) throw new Error('Save failed');
            return true;
        } catch (err) {
            showToast('Failed to save: ' + err.message, 'error');
            return false;
        }
    }

    /* -------------------------------------------------------------------
     * Dynamic Image Compression (Client-Side)
     * ------------------------------------------------------------------- */
    async function compressImage(file, maxWidth = 1920, quality = 0.8) {
        if (!file.type.startsWith('image/')) return file;
        if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (blob) {
                            // Convert blob back to a File object with the original name
                            resolve(new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            }));
                        } else {
                            resolve(file);
                        }
                    }, 'image/jpeg', quality);
                };
                img.onerror = () => resolve(file);
            };
            reader.onerror = () => resolve(file);
        });
    }

    async function uploadFile(file, filename, folder) {
        let url = `${UPLOAD_URL}?filename=${encodeURIComponent(filename)}`;
        if (folder) url += `&folder=${encodeURIComponent(folder)}`;

        // Compress the image dynamically before uploading
        const compressedFile = await compressImage(file);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'X-Admin-Token': token,
                'Content-Type': 'application/octet-stream'
            },
            body: compressedFile
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Upload failed');
        }
        return await res.json();
    }

    /* ===================================================================
     * RENDER ALL
     * =================================================================== */
    function renderAll() {
        renderDashboard();
        renderPhotos();
        renderProjects();
        renderDataSection();
        setupUpload();
    }

    /* ===================================================================
     * NAVIGATION
     * =================================================================== */
    function setupNavigation() {
        $$('.sidebar-nav .nav-item').forEach((item) => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                if (section) switchSection(section);
                // Close mobile sidebar
                const sidebar = $('#sidebar');
                if (sidebar) sidebar.classList.remove('open');
            });
        });
    }

    function switchSection(name) {
        currentSection = name;
        // Update nav
        $$('.sidebar-nav .nav-item').forEach((n) =>
            n.classList.toggle('active', n.dataset.section === name)
        );
        // Show section
        $$('.content-section').forEach((s) =>
            s.classList.toggle('active', s.id === 'section-' + name)
        );
    }

    function setupMobileSidebar() {
        const toggle = $('#mobile-sidebar-toggle');
        const sidebar = $('#sidebar');
        if (!toggle || !sidebar) return;
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    /* ===================================================================
     * DASHBOARD
     * =================================================================== */
    function renderDashboard() {
        if (!data) return;

        // Stats
        const stats = [
            { icon: '🖼️', value: data.photos ? data.photos.length : 0, label: 'Gallery Photos' },
            { icon: '📁', value: data.portfolios ? data.portfolios.reduce((n, p) => n + (p.photos ? p.photos.length : 0), 0) : 0, label: 'Project Photos' },
            { icon: '🏷️', value: data.categories ? data.categories.filter(c => c !== 'All').length : 0, label: 'Categories' },
            { icon: '🏆', value: data.awards ? data.awards.length : 0, label: 'Awards' },
            { icon: '👥', value: data.clients ? data.clients.length : 0, label: 'Clients' },
            { icon: '⭐', value: data.highlights ? data.highlights.length : 0, label: 'Highlights' }
        ];

        const statsGrid = $('#stats-grid');
        if (statsGrid) {
            statsGrid.innerHTML = stats.map(s => `
                <div class="stat-card">
                    <div class="stat-icon">${s.icon}</div>
                    <div class="stat-value">${s.value}</div>
                    <div class="stat-label">${s.label}</div>
                </div>
            `).join('');
        }

        // Recent photos
        const recentGrid = $('#recent-grid');
        if (recentGrid && data.photos) {
            const recent = data.photos.slice(-8).reverse();
            recentGrid.innerHTML = recent.length ? recent.map(p => `
                <div class="recent-thumb">
                    <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.title)}" loading="lazy">
                    <div class="recent-title">${escapeHtml(p.title)}</div>
                </div>
            `).join('') : '<div class="empty-state"><p>No photos yet</p></div>';
        }
    }

    /* ===================================================================
     * UPLOAD
     * =================================================================== */
    let uploadSetup = false;

    function setupUpload() {
        if (uploadSetup) return;
        uploadSetup = true;

        const zone = $('#upload-zone');
        const fileInput = $('#file-input');
        const clearBtn = $('#clear-queue-btn');

        if (!zone || !fileInput) return;

        // Click to browse
        zone.addEventListener('click', (e) => {
            if (e.target.closest('.upload-browse') || e.target === zone || e.target.closest('.upload-zone-inner')) {
                fileInput.click();
            }
        });

        // Drag events
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            handleFiles(e.dataTransfer.files);
        });

        // File input
        fileInput.addEventListener('change', () => {
            handleFiles(fileInput.files);
            fileInput.value = '';
        });

        // Clear queue
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                $('#queue-items').innerHTML = '';
                $('#upload-queue').style.display = 'none';
            });
        }
    }

    function handleFiles(fileList) {
        const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
        if (files.length === 0) {
            showToast('Please select image files', 'warning');
            return;
        }

        const queue = $('#upload-queue');
        const items = $('#queue-items');
        queue.style.display = 'block';

        files.forEach(file => {
            const item = createUploadItem(file);
            items.appendChild(item);
        });
    }

    function createUploadItem(file) {
        const item = document.createElement('div');
        item.className = 'upload-item';

        // Auto-title from filename
        const nameBase = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
        const autoTitle = nameBase.charAt(0).toUpperCase() + nameBase.slice(1);

        // Build category options
        const cats = (data && data.categories) ? data.categories : ['All'];
        const catOptions = cats
            .filter(c => c !== 'All')
            .map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
            .join('');

        // Build target options (gallery + projects)
        let targetOptions = '<option value="gallery">Main Gallery</option>';
        if (data && data.portfolios) {
            data.portfolios.forEach((p, i) => {
                targetOptions += `<option value="project-${i}">${escapeHtml(p.icon + ' ' + p.type)} Project</option>`;
            });
        }

        item.innerHTML = `
            <div class="upload-preview">
                <img src="" alt="Preview">
            </div>
            <div class="upload-form">
                <div class="form-row">
                    <div class="form-group" style="flex:2">
                        <label>Title</label>
                        <input type="text" class="text-input upload-title" value="${escapeHtml(autoTitle)}" placeholder="Photo title">
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Category</label>
                        <select class="select-input upload-category">${catOptions}</select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea class="text-input upload-desc" placeholder="Brief description of the photo" rows="2"></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group" style="flex:1">
                        <label>Add To</label>
                        <select class="select-input upload-target">${targetOptions}</select>
                    </div>
                </div>
                <div class="upload-actions">
                    <button class="btn btn-primary upload-btn">Upload & Add</button>
                    <button class="btn btn-ghost remove-btn">Remove</button>
                </div>
                <div class="upload-progress" style="display:none;">
                    <div class="progress-bar"><div class="progress-fill"></div></div>
                    <span class="progress-text">Uploading...</span>
                </div>
            </div>
        `;

        // Store file reference
        item._file = file;

        // Load preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = item.querySelector('.upload-preview img');
            if (img) img.src = e.target.result;
        };
        reader.readAsDataURL(file);

        // Upload button
        item.querySelector('.upload-btn').addEventListener('click', () => {
            processUploadItem(item);
        });

        // Remove button
        item.querySelector('.remove-btn').addEventListener('click', () => {
            item.remove();
            if ($('#queue-items').children.length === 0) {
                $('#upload-queue').style.display = 'none';
            }
        });

        return item;
    }

    async function processUploadItem(item) {
        const file = item._file;
        const title = item.querySelector('.upload-title').value.trim() || 'Untitled';
        const category = item.querySelector('.upload-category').value || 'All';
        const description = item.querySelector('.upload-desc').value.trim();
        const target = item.querySelector('.upload-target').value;

        const progress = item.querySelector('.upload-progress');
        const progressFill = item.querySelector('.progress-fill');
        const progressText = item.querySelector('.progress-text');
        const uploadBtn = item.querySelector('.upload-btn');
        const removeBtn = item.querySelector('.remove-btn');

        // Show progress
        progress.style.display = 'flex';
        uploadBtn.disabled = true;
        removeBtn.disabled = true;
        progressFill.style.width = '30%';
        progressText.textContent = 'Uploading image...';

        try {
            // Determine folder for projects
            let folder = '';
            if (target.startsWith('project-')) {
                const idx = parseInt(target.split('-')[1]);
                if (data.portfolios && data.portfolios[idx]) {
                    folder = data.portfolios[idx].type.toLowerCase();
                }
            }

            // Step 1: Upload the file
            const result = await uploadFile(file, file.name, folder);
            progressFill.style.width = '70%';
            progressText.textContent = 'Saving metadata...';

            // Step 2: Add to portfolio data
            if (target === 'gallery') {
                if (!data.photos) data.photos = [];
                const maxId = data.photos.reduce((max, p) => Math.max(max, p.id || 0), 0);
                data.photos.push({
                    id: maxId + 1,
                    title: title,
                    category: category,
                    url: result.url,
                    thumbnail: result.url,
                    description: description
                });
            } else if (target.startsWith('project-')) {
                const idx = parseInt(target.split('-')[1]);
                if (data.portfolios && data.portfolios[idx]) {
                    if (!data.portfolios[idx].photos) data.portfolios[idx].photos = [];
                    data.portfolios[idx].photos.push({
                        title: title,
                        url: result.url,
                        description: description
                    });
                }
            }

            // Step 3: Save portfolio data
            const saved = await saveData();
            if (!saved) throw new Error('Failed to save portfolio data');

            // Success!
            progressFill.style.width = '100%';
            progressText.textContent = '✓ Done!';
            item.classList.add('upload-success');
            showToast(`"${title}" uploaded successfully!`, 'success');

            // Refresh views
            renderDashboard();
            renderPhotos();
            renderProjects();

            // Remove item after a short delay
            setTimeout(() => {
                item.remove();
                if ($('#queue-items').children.length === 0) {
                    $('#upload-queue').style.display = 'none';
                }
            }, 2000);

        } catch (err) {
            progressFill.style.width = '100%';
            progressFill.style.background = 'var(--red)';
            progressText.textContent = '✕ Failed: ' + err.message;
            item.classList.add('upload-error');
            uploadBtn.disabled = false;
            removeBtn.disabled = false;
            showToast('Upload failed: ' + err.message, 'error');
        }
    }

    /* ===================================================================
     * PHOTO MANAGEMENT
     * =================================================================== */
    function renderPhotos() {
        if (!data || !data.photos) return;

        const grid = $('#admin-photos-grid');
        const filter = $('#photo-filter');
        const search = $('#photo-search');
        if (!grid) return;

        // Update filter dropdown
        if (filter) {
            const cats = data.categories || ['All'];
            filter.innerHTML = '<option value="All">All Categories</option>' +
                cats.filter(c => c !== 'All').map(c =>
                    `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
                ).join('');

            // Detach and reattach event listener
            filter.onchange = () => renderPhotoGrid();
        }

        if (search) {
            search.oninput = () => renderPhotoGrid();
        }

        renderPhotoGrid();
    }

    function renderPhotoGrid() {
        const grid = $('#admin-photos-grid');
        if (!grid || !data || !data.photos) return;

        const filterVal = ($('#photo-filter') || {}).value || 'All';
        const searchVal = (($('#photo-search') || {}).value || '').toLowerCase();

        let photos = [...data.photos];

        // Apply category filter
        if (filterVal !== 'All') {
            photos = photos.filter(p => {
                if (Array.isArray(p.category)) return p.category.includes(filterVal);
                return p.category === filterVal;
            });
        }

        // Apply search
        if (searchVal) {
            photos = photos.filter(p =>
                (p.title || '').toLowerCase().includes(searchVal) ||
                (p.description || '').toLowerCase().includes(searchVal)
            );
        }

        if (photos.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <div class="empty-state-icon">🖼️</div>
                    <h3>No photos found</h3>
                    <p>Try adjusting your search or filter.</p>
                </div>`;
            return;
        }

        grid.innerHTML = photos.map(p => {
            const catText = Array.isArray(p.category) ? p.category.join(', ') : (p.category || '');
            return `
                <div class="admin-photo-card" data-id="${p.id}">
                    <div class="admin-photo-img">
                        <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.title)}" loading="lazy">
                    </div>
                    <div class="admin-photo-info">
                        <h3>${escapeHtml(p.title)}</h3>
                        <span class="admin-photo-cat">${escapeHtml(catText)}</span>
                        <p>${escapeHtml(p.description)}</p>
                    </div>
                    <div class="admin-photo-actions">
                        <button class="btn btn-ghost btn-sm btn-edit-photo" data-id="${p.id}">Edit</button>
                        <button class="btn btn-danger btn-sm btn-delete-photo" data-id="${p.id}">Delete</button>
                    </div>
                </div>`;
        }).join('');

        // Event delegation
        grid.onclick = (e) => {
            const editBtn = e.target.closest('.btn-edit-photo');
            const deleteBtn = e.target.closest('.btn-delete-photo');
            if (editBtn) editPhoto(parseInt(editBtn.dataset.id));
            if (deleteBtn) deletePhoto(parseInt(deleteBtn.dataset.id));
        };
    }

    function editPhoto(id) {
        const photo = data.photos.find(p => p.id === id);
        if (!photo) return;

        const cats = (data.categories || []).filter(c => c !== 'All');
        const currentCat = Array.isArray(photo.category) ? photo.category.join(', ') : (photo.category || '');

        showModal('Edit Photo', `
            <div class="form-group">
                <label>Title</label>
                <input type="text" class="text-input" id="edit-title" value="${escapeHtml(photo.title)}">
            </div>
            <div class="form-group">
                <label>Category (comma-separated for multiple)</label>
                <input type="text" class="text-input" id="edit-category" value="${escapeHtml(currentCat)}"
                    placeholder="e.g. Street, Documentary">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea class="text-input" id="edit-desc" rows="3">${escapeHtml(photo.description)}</textarea>
            </div>
            <div class="form-group">
                <label>URL</label>
                <input type="text" class="text-input" id="edit-url" value="${escapeHtml(photo.url)}">
            </div>
        `, async () => {
            photo.title = $('#edit-title').value.trim();
            const catStr = $('#edit-category').value.trim();
            photo.category = catStr.includes(',')
                ? catStr.split(',').map(c => c.trim()).filter(Boolean)
                : catStr;
            photo.description = $('#edit-desc').value.trim();
            photo.url = $('#edit-url').value.trim();
            photo.thumbnail = photo.url;

            const saved = await saveData();
            if (saved) {
                showToast('Photo updated!', 'success');
                renderPhotos();
                renderDashboard();
            }
        });
    }

    function deletePhoto(id) {
        const photo = data.photos.find(p => p.id === id);
        if (!photo) return;

        showModal('Delete Photo', `
            <p>Are you sure you want to remove <strong>"${escapeHtml(photo.title)}"</strong> from the gallery?</p>
            <p style="color: var(--text-secondary); font-size: 0.8125rem; margin-top: 8px;">
                The image file will remain on the server but won't appear in the portfolio.
            </p>
        `, async () => {
            data.photos = data.photos.filter(p => p.id !== id);
            // Also remove from highlights if referenced
            if (data.highlights) {
                data.highlights = data.highlights.filter(h => h.photo_id !== id);
            }
            const saved = await saveData();
            if (saved) {
                showToast('Photo removed', 'success');
                renderPhotos();
                renderDashboard();
                renderDataSection();
            }
        }, 'Delete', 'btn-danger');
    }

    /* ===================================================================
     * PROJECT MANAGEMENT
     * =================================================================== */
    function renderProjects() {
        const list = $('#projects-list');
        if (!list || !data || !data.portfolios) return;

        list.innerHTML = data.portfolios.map((folder, fi) => {
            const photoCount = folder.photos ? folder.photos.length : 0;
            const photosHtml = (folder.photos || []).map((p, pi) => `
                <div class="project-photo-thumb" data-fi="${fi}" data-pi="${pi}">
                    <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.title)}" loading="lazy">
                    <button class="project-photo-remove" data-fi="${fi}" data-pi="${pi}" title="Remove">&times;</button>
                </div>
            `).join('');

            return `
                <div class="project-card" data-fi="${fi}">
                    <div class="project-card-header" data-fi="${fi}">
                        <div class="project-card-header-left">
                            <span class="project-card-icon">${folder.icon || '📁'}</span>
                            <div>
                                <div class="project-card-name">${escapeHtml(folder.type)}</div>
                                <div class="project-card-count">${photoCount} photo${photoCount !== 1 ? 's' : ''} · ${escapeHtml(folder.description || '')}</div>
                            </div>
                        </div>
                        <span class="project-card-chevron">▼</span>
                    </div>
                    <div class="project-card-body">
                        <div class="project-photos-grid">${photosHtml || '<p class="empty-state" style="padding:12px;">No photos yet</p>'}</div>
                        <div class="project-card-actions">
                            <button class="btn btn-ghost btn-sm btn-project-edit" data-fi="${fi}">Edit Folder</button>
                            <button class="btn btn-danger btn-sm btn-project-delete" data-fi="${fi}">Delete Folder</button>
                        </div>
                    </div>
                </div>`;
        }).join('');

        // Event delegation
        list.onclick = (e) => {
            // Toggle expand
            const header = e.target.closest('.project-card-header');
            if (header) {
                const card = header.closest('.project-card');
                card.classList.toggle('expanded');
                return;
            }

            // Remove photo
            const removeBtn = e.target.closest('.project-photo-remove');
            if (removeBtn) {
                e.stopPropagation();
                const fi = parseInt(removeBtn.dataset.fi);
                const pi = parseInt(removeBtn.dataset.pi);
                removeProjectPhoto(fi, pi);
                return;
            }

            // Edit folder
            const editBtn = e.target.closest('.btn-project-edit');
            if (editBtn) {
                editProjectFolder(parseInt(editBtn.dataset.fi));
                return;
            }

            // Delete folder
            const delBtn = e.target.closest('.btn-project-delete');
            if (delBtn) {
                deleteProjectFolder(parseInt(delBtn.dataset.fi));
                return;
            }
        };

        // Add Project button
        const addBtn = $('#add-project-btn');
        if (addBtn) {
            addBtn.onclick = () => addProjectFolder();
        }
    }

    async function removeProjectPhoto(fi, pi) {
        if (!data.portfolios[fi] || !data.portfolios[fi].photos[pi]) return;
        const photo = data.portfolios[fi].photos[pi];

        showModal('Remove Photo', `
            <p>Remove <strong>"${escapeHtml(photo.title)}"</strong> from this project?</p>
        `, async () => {
            data.portfolios[fi].photos.splice(pi, 1);
            const saved = await saveData();
            if (saved) {
                showToast('Photo removed from project', 'success');
                renderProjects();
                renderDashboard();
            }
        }, 'Remove', 'btn-danger');
    }

    function editProjectFolder(fi) {
        const folder = data.portfolios[fi];
        if (!folder) return;

        showModal('Edit Project Folder', `
            <div class="form-group">
                <label>Type / Name</label>
                <input type="text" class="text-input" id="edit-proj-type" value="${escapeHtml(folder.type)}">
            </div>
            <div class="form-group">
                <label>Icon (emoji)</label>
                <input type="text" class="text-input" id="edit-proj-icon" value="${escapeHtml(folder.icon || '')}" style="max-width:80px">
            </div>
            <div class="form-group">
                <label>Description</label>
                <input type="text" class="text-input" id="edit-proj-desc" value="${escapeHtml(folder.description || '')}">
            </div>
        `, async () => {
            folder.type = $('#edit-proj-type').value.trim() || folder.type;
            folder.icon = $('#edit-proj-icon').value.trim() || '📁';
            folder.description = $('#edit-proj-desc').value.trim();
            const saved = await saveData();
            if (saved) {
                showToast('Project folder updated!', 'success');
                renderProjects();
            }
        });
    }

    function deleteProjectFolder(fi) {
        const folder = data.portfolios[fi];
        if (!folder) return;

        showModal('Delete Project Folder', `
            <p>Are you sure you want to delete the <strong>"${escapeHtml(folder.type)}"</strong> project folder?</p>
            <p style="color: var(--text-secondary); font-size: 0.8125rem; margin-top: 8px;">
                This will remove the folder and all its photo references (files stay on server).
            </p>
        `, async () => {
            data.portfolios.splice(fi, 1);
            const saved = await saveData();
            if (saved) {
                showToast('Project folder deleted', 'success');
                renderProjects();
                renderDashboard();
            }
        }, 'Delete', 'btn-danger');
    }

    function addProjectFolder() {
        showModal('Add Project Folder', `
            <div class="form-group">
                <label>Type / Name</label>
                <input type="text" class="text-input" id="new-proj-type" placeholder="e.g. Wedding">
            </div>
            <div class="form-group">
                <label>Icon (emoji)</label>
                <input type="text" class="text-input" id="new-proj-icon" placeholder="💍" style="max-width:80px">
            </div>
            <div class="form-group">
                <label>Description</label>
                <input type="text" class="text-input" id="new-proj-desc" placeholder="Wedding Photography">
            </div>
        `, async () => {
            const type = $('#new-proj-type').value.trim();
            if (!type) {
                showToast('Please enter a project name', 'warning');
                return;
            }
            if (!data.portfolios) data.portfolios = [];
            data.portfolios.push({
                type: type,
                icon: $('#new-proj-icon').value.trim() || '📁',
                description: $('#new-proj-desc').value.trim(),
                photos: []
            });
            const saved = await saveData();
            if (saved) {
                showToast('Project folder created!', 'success');
                renderProjects();
                renderDashboard();
            }
        });
    }

    /* ===================================================================
     * DATA EDITING — Highlights, Awards, Services, Clients, Testimonials, Categories, Site Info
     * =================================================================== */
    let activeDataTab = 'highlights';

    function renderDataSection() {
        // Tab clicks
        $$('.data-tab').forEach(tab => {
            tab.onclick = () => {
                activeDataTab = tab.dataset.tab;
                $$('.data-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeDataTab));
                renderDataContent();
            };
        });
        renderDataContent();
    }

    function renderDataContent() {
        const container = $('#data-content');
        if (!container || !data) return;

        switch (activeDataTab) {
            case 'highlights':   renderHighlightsEditor(container); break;
            case 'awards':       renderAwardsEditor(container); break;
            case 'services':     renderServicesEditor(container); break;
            case 'clients':      renderClientsEditor(container); break;
            case 'testimonials': renderTestimonialsEditor(container); break;
            case 'categories':   renderCategoriesEditor(container); break;
            case 'siteinfo':     renderSiteInfoEditor(container); break;
            case 'settings':     renderSettingsEditor(container); break;
        }
    }

    /* --- Highlights --- */
    function renderHighlightsEditor(container) {
        const highlights = data.highlights || [];
        const photos = data.photos || [];

        container.innerHTML = highlights.map((h, i) => {
            const photo = photos.find(p => p.id === h.photo_id);
            return `
                <div class="data-item">
                    <div class="data-item-content">
                        <div class="data-item-title">${photo ? escapeHtml(photo.title) : 'Photo #' + h.photo_id}</div>
                        <div class="data-item-subtitle">"${escapeHtml(h.pullquote)}"</div>
                    </div>
                    <div class="data-item-actions">
                        <button class="btn btn-ghost btn-sm" data-action="edit-highlight" data-index="${i}">Edit</button>
                        <button class="btn btn-danger btn-sm" data-action="delete-highlight" data-index="${i}">✕</button>
                    </div>
                </div>`;
        }).join('') + `
            <button class="btn btn-primary" data-action="add-highlight" style="margin-top:12px;">+ Add Highlight</button>`;

        container.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const idx = parseInt(btn.dataset.index);

            if (action === 'add-highlight') {
                addHighlight();
            } else if (action === 'edit-highlight') {
                editHighlight(idx);
            } else if (action === 'delete-highlight') {
                data.highlights.splice(idx, 1);
                saveData().then(ok => {
                    if (ok) { showToast('Highlight removed', 'success'); renderDataContent(); }
                });
            }
        };
    }

    function addHighlight() {
        const photos = data.photos || [];
        const options = photos.map(p => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');

        showModal('Add Highlight', `
            <div class="form-group">
                <label>Photo</label>
                <select class="select-input" id="hl-photo">${options}</select>
            </div>
            <div class="form-group">
                <label>Pullquote</label>
                <textarea class="text-input" id="hl-quote" rows="2" placeholder="A short, poetic quote..."></textarea>
            </div>
        `, async () => {
            if (!data.highlights) data.highlights = [];
            data.highlights.push({
                photo_id: parseInt($('#hl-photo').value),
                pullquote: $('#hl-quote').value.trim()
            });
            const saved = await saveData();
            if (saved) { showToast('Highlight added!', 'success'); renderDataContent(); }
        });
    }

    function editHighlight(idx) {
        const h = data.highlights[idx];
        if (!h) return;
        const photos = data.photos || [];
        const options = photos.map(p =>
            `<option value="${p.id}" ${p.id === h.photo_id ? 'selected' : ''}>${escapeHtml(p.title)}</option>`
        ).join('');

        showModal('Edit Highlight', `
            <div class="form-group">
                <label>Photo</label>
                <select class="select-input" id="hl-photo">${options}</select>
            </div>
            <div class="form-group">
                <label>Pullquote</label>
                <textarea class="text-input" id="hl-quote" rows="2">${escapeHtml(h.pullquote)}</textarea>
            </div>
        `, async () => {
            h.photo_id = parseInt($('#hl-photo').value);
            h.pullquote = $('#hl-quote').value.trim();
            const saved = await saveData();
            if (saved) { showToast('Highlight updated!', 'success'); renderDataContent(); }
        });
    }

    /* --- Awards --- */
    function renderAwardsEditor(container) {
        const awards = data.awards || [];
        container.innerHTML = awards.map((a, i) => `
            <div class="data-item">
                <div class="data-item-content">
                    <div class="data-item-title">${escapeHtml(a.title)} (${a.year})</div>
                    <div class="data-item-subtitle">${escapeHtml(a.organization)} — ${escapeHtml(a.description)}</div>
                </div>
                <div class="data-item-actions">
                    <button class="btn btn-ghost btn-sm" data-action="edit" data-index="${i}">Edit</button>
                    <button class="btn btn-danger btn-sm" data-action="delete" data-index="${i}">✕</button>
                </div>
            </div>
        `).join('') + `<button class="btn btn-primary" data-action="add" style="margin-top:12px;">+ Add Award</button>`;

        container.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const idx = parseInt(btn.dataset.index);
            if (btn.dataset.action === 'add') {
                showModal('Add Award', awardFormHtml({}), async () => {
                    if (!data.awards) data.awards = [];
                    data.awards.push(readAwardForm());
                    if (await saveData()) { showToast('Award added!', 'success'); renderDataContent(); renderDashboard(); }
                });
            } else if (btn.dataset.action === 'edit') {
                showModal('Edit Award', awardFormHtml(awards[idx]), async () => {
                    Object.assign(awards[idx], readAwardForm());
                    if (await saveData()) { showToast('Award updated!', 'success'); renderDataContent(); }
                });
            } else if (btn.dataset.action === 'delete') {
                data.awards.splice(idx, 1);
                saveData().then(ok => { if (ok) { showToast('Award removed', 'success'); renderDataContent(); renderDashboard(); } });
            }
        };
    }

    function awardFormHtml(a) {
        return `
            <div class="form-group"><label>Title</label><input class="text-input" id="award-title" value="${escapeHtml(a.title || '')}"></div>
            <div class="form-group"><label>Organization</label><input class="text-input" id="award-org" value="${escapeHtml(a.organization || '')}"></div>
            <div class="form-group"><label>Year</label><input type="number" class="text-input" id="award-year" value="${a.year || new Date().getFullYear()}"></div>
            <div class="form-group"><label>Description</label><textarea class="text-input" id="award-desc" rows="2">${escapeHtml(a.description || '')}</textarea></div>`;
    }

    function readAwardForm() {
        return {
            title: $('#award-title').value.trim(),
            organization: $('#award-org').value.trim(),
            year: parseInt($('#award-year').value) || new Date().getFullYear(),
            description: $('#award-desc').value.trim()
        };
    }

    /* --- Services --- */
    function renderServicesEditor(container) {
        const services = data.services || [];
        container.innerHTML = services.map((s, i) => `
            <div class="data-item">
                <div class="data-item-content">
                    <div class="data-item-title">${s.icon || ''} ${escapeHtml(s.title)}</div>
                    <div class="data-item-subtitle">${escapeHtml(s.description)}</div>
                </div>
                <div class="data-item-actions">
                    <button class="btn btn-ghost btn-sm" data-action="edit" data-index="${i}">Edit</button>
                    <button class="btn btn-danger btn-sm" data-action="delete" data-index="${i}">✕</button>
                </div>
            </div>
        `).join('') + `<button class="btn btn-primary" data-action="add" style="margin-top:12px;">+ Add Service</button>`;

        container.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const idx = parseInt(btn.dataset.index);
            if (btn.dataset.action === 'add') {
                showModal('Add Service', serviceFormHtml({}), async () => {
                    if (!data.services) data.services = [];
                    data.services.push(readServiceForm());
                    if (await saveData()) { showToast('Service added!', 'success'); renderDataContent(); }
                });
            } else if (btn.dataset.action === 'edit') {
                showModal('Edit Service', serviceFormHtml(services[idx]), async () => {
                    Object.assign(services[idx], readServiceForm());
                    if (await saveData()) { showToast('Service updated!', 'success'); renderDataContent(); }
                });
            } else if (btn.dataset.action === 'delete') {
                data.services.splice(idx, 1);
                saveData().then(ok => { if (ok) { showToast('Service removed', 'success'); renderDataContent(); } });
            }
        };
    }

    function serviceFormHtml(s) {
        return `
            <div class="form-group"><label>Icon (emoji)</label><input class="text-input" id="svc-icon" value="${escapeHtml(s.icon || '')}" style="max-width:80px"></div>
            <div class="form-group"><label>Title</label><input class="text-input" id="svc-title" value="${escapeHtml(s.title || '')}"></div>
            <div class="form-group"><label>Description</label><textarea class="text-input" id="svc-desc" rows="2">${escapeHtml(s.description || '')}</textarea></div>
            <div class="form-group"><label>Features (one per line)</label><textarea class="text-input" id="svc-features" rows="4">${(s.features || []).join('\n')}</textarea></div>`;
    }

    function readServiceForm() {
        return {
            icon: $('#svc-icon').value.trim() || '📷',
            title: $('#svc-title').value.trim(),
            description: $('#svc-desc').value.trim(),
            features: $('#svc-features').value.split('\n').map(f => f.trim()).filter(Boolean)
        };
    }

    /* --- Clients --- */
    function renderClientsEditor(container) {
        const clients = data.clients || [];
        container.innerHTML = clients.map((c, i) => `
            <div class="data-item">
                <div class="data-item-content">
                    <div class="data-item-title">${escapeHtml(c.name)}</div>
                    <div class="data-item-subtitle">${escapeHtml(c.type || '')}</div>
                </div>
                <div class="data-item-actions">
                    <button class="btn btn-ghost btn-sm" data-action="edit" data-index="${i}">Edit</button>
                    <button class="btn btn-danger btn-sm" data-action="delete" data-index="${i}">✕</button>
                </div>
            </div>
        `).join('') + `<button class="btn btn-primary" data-action="add" style="margin-top:12px;">+ Add Client</button>`;

        container.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const idx = parseInt(btn.dataset.index);
            if (btn.dataset.action === 'add') {
                showModal('Add Client', clientFormHtml({}), async () => {
                    if (!data.clients) data.clients = [];
                    data.clients.push(readClientForm());
                    if (await saveData()) { showToast('Client added!', 'success'); renderDataContent(); renderDashboard(); }
                });
            } else if (btn.dataset.action === 'edit') {
                showModal('Edit Client', clientFormHtml(clients[idx]), async () => {
                    Object.assign(clients[idx], readClientForm());
                    if (await saveData()) { showToast('Client updated!', 'success'); renderDataContent(); }
                });
            } else if (btn.dataset.action === 'delete') {
                data.clients.splice(idx, 1);
                saveData().then(ok => { if (ok) { showToast('Client removed', 'success'); renderDataContent(); renderDashboard(); } });
            }
        };
    }

    function clientFormHtml(c) {
        return `
            <div class="form-group"><label>Name</label><input class="text-input" id="client-name" value="${escapeHtml(c.name || '')}"></div>
            <div class="form-group"><label>Type</label>
                <select class="select-input" id="client-type">
                    <option value="organization" ${c.type === 'organization' ? 'selected' : ''}>Organization</option>
                    <option value="brand" ${c.type === 'brand' ? 'selected' : ''}>Brand</option>
                    <option value="institution" ${c.type === 'institution' ? 'selected' : ''}>Institution</option>
                    <option value="individual" ${c.type === 'individual' ? 'selected' : ''}>Individual</option>
                </select>
            </div>`;
    }

    function readClientForm() {
        return {
            name: $('#client-name').value.trim(),
            type: $('#client-type').value
        };
    }

    /* --- Testimonials --- */
    function renderTestimonialsEditor(container) {
        const testimonials = data.testimonials || [];
        container.innerHTML = testimonials.map((t, i) => `
            <div class="data-item">
                <div class="data-item-content">
                    <div class="data-item-title">${escapeHtml(t.name)} — ${escapeHtml(t.role)}</div>
                    <div class="data-item-subtitle">"${escapeHtml(t.quote)}" ${'★'.repeat(t.rating || 0)}</div>
                </div>
                <div class="data-item-actions">
                    <button class="btn btn-ghost btn-sm" data-action="edit" data-index="${i}">Edit</button>
                    <button class="btn btn-danger btn-sm" data-action="delete" data-index="${i}">✕</button>
                </div>
            </div>
        `).join('') + `<button class="btn btn-primary" data-action="add" style="margin-top:12px;">+ Add Testimonial</button>`;

        container.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const idx = parseInt(btn.dataset.index);
            if (btn.dataset.action === 'add') {
                showModal('Add Testimonial', testimonialFormHtml({}), async () => {
                    if (!data.testimonials) data.testimonials = [];
                    data.testimonials.push(readTestimonialForm());
                    if (await saveData()) { showToast('Testimonial added!', 'success'); renderDataContent(); }
                });
            } else if (btn.dataset.action === 'edit') {
                showModal('Edit Testimonial', testimonialFormHtml(testimonials[idx]), async () => {
                    Object.assign(testimonials[idx], readTestimonialForm());
                    if (await saveData()) { showToast('Testimonial updated!', 'success'); renderDataContent(); }
                });
            } else if (btn.dataset.action === 'delete') {
                data.testimonials.splice(idx, 1);
                saveData().then(ok => { if (ok) { showToast('Testimonial removed', 'success'); renderDataContent(); } });
            }
        };
    }

    function testimonialFormHtml(t) {
        return `
            <div class="form-group"><label>Name</label><input class="text-input" id="test-name" value="${escapeHtml(t.name || '')}"></div>
            <div class="form-group"><label>Role</label><input class="text-input" id="test-role" value="${escapeHtml(t.role || '')}"></div>
            <div class="form-group"><label>Quote</label><textarea class="text-input" id="test-quote" rows="3">${escapeHtml(t.quote || '')}</textarea></div>
            <div class="form-group"><label>Rating (1-5)</label><input type="number" class="text-input" id="test-rating" min="1" max="5" value="${t.rating || 5}" style="max-width:80px"></div>`;
    }

    function readTestimonialForm() {
        return {
            name: $('#test-name').value.trim(),
            role: $('#test-role').value.trim(),
            quote: $('#test-quote').value.trim(),
            rating: Math.min(5, Math.max(1, parseInt($('#test-rating').value) || 5))
        };
    }

    /* --- Categories --- */
    function renderCategoriesEditor(container) {
        const categories = (data.categories || []).filter(c => c !== 'All');
        container.innerHTML = `
            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 16px;">
                Manage your photo categories. "All" is always included automatically.
            </p>` +
            categories.map((c, i) => `
                <div class="data-item">
                    <div class="data-item-content">
                        <div class="data-item-title">${escapeHtml(c)}</div>
                    </div>
                    <div class="data-item-actions">
                        <button class="btn btn-danger btn-sm" data-action="delete" data-index="${i}">✕</button>
                    </div>
                </div>
            `).join('') + `
            <div style="display:flex; gap:8px; margin-top:12px;">
                <input type="text" class="text-input" id="new-cat-name" placeholder="New category name" style="max-width:250px;">
                <button class="btn btn-primary" data-action="add">Add</button>
            </div>`;

        container.onclick = async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            if (btn.dataset.action === 'add') {
                const name = $('#new-cat-name').value.trim();
                if (!name) return;
                if (!data.categories) data.categories = ['All'];
                if (!data.categories.includes(name)) {
                    data.categories.push(name);
                    if (await saveData()) { showToast('Category added!', 'success'); renderDataContent(); }
                } else {
                    showToast('Category already exists', 'warning');
                }
            } else if (btn.dataset.action === 'delete') {
                const idx = parseInt(btn.dataset.index);
                const catName = categories[idx];
                // Find the actual index in data.categories (which includes 'All')
                const realIdx = data.categories.indexOf(catName);
                if (realIdx > -1) {
                    data.categories.splice(realIdx, 1);
                    if (await saveData()) { showToast('Category removed', 'success'); renderDataContent(); renderDashboard(); }
                }
            }
        };
    }

    /* --- Site Info --- */
    function renderSiteInfoEditor(container) {
        const site = data.site || {};
        container.innerHTML = `
            <div class="panel">
                <h3 class="panel-title" style="margin-bottom:16px;">Site Information</h3>
                <div style="display:flex; flex-direction:column; gap:14px;">
                    <div class="form-group"><label>Title</label><input class="text-input" id="site-title" value="${escapeHtml(site.title || '')}"></div>
                    <div class="form-group"><label>Tagline</label><input class="text-input" id="site-tagline" value="${escapeHtml(site.tagline || '')}"></div>
                    <div class="form-group"><label>Author Name</label><input class="text-input" id="site-author" value="${escapeHtml(site.author || '')}"></div>
                    <div class="form-group"><label>Bio</label><textarea class="text-input" id="site-bio" rows="5">${escapeHtml(site.bio || '')}</textarea></div>
                    <div class="form-group"><label>Author Photo URL</label><input class="text-input" id="site-photo" value="${escapeHtml(site.author_photo || '')}"></div>
                    <div class="form-group"><label>Contact Email</label><input class="text-input" id="site-email" value="${escapeHtml(site.contact_email || '')}"></div>
                </div>
                <h3 class="panel-title" style="margin: 24px 0 16px;">Social Links</h3>
                <div style="display:flex; flex-direction:column; gap:14px;">
                    <div class="form-group"><label>LinkedIn</label><input class="text-input" id="site-linkedin" value="${escapeHtml((site.social || {}).linkedin || '')}"></div>
                    <div class="form-group"><label>Instagram</label><input class="text-input" id="site-instagram" value="${escapeHtml((site.social || {}).instagram || '')}"></div>
                    <div class="form-group"><label>Facebook</label><input class="text-input" id="site-facebook" value="${escapeHtml((site.social || {}).facebook || '')}"></div>
                </div>
                <button class="btn btn-primary" id="save-site-info" style="margin-top:20px;">Save Site Info</button>
            </div>`;

        const saveBtn = $('#save-site-info');
        if (saveBtn) {
            saveBtn.onclick = async () => {
                if (!data.site) data.site = {};
                data.site.title = $('#site-title').value.trim();
                data.site.tagline = $('#site-tagline').value.trim();
                data.site.author = $('#site-author').value.trim();
                data.site.bio = $('#site-bio').value.trim();
                data.site.author_photo = $('#site-photo').value.trim();
                data.site.contact_email = $('#site-email').value.trim();
                if (!data.site.social) data.site.social = {};
                data.site.social.linkedin = $('#site-linkedin').value.trim();
                data.site.social.instagram = $('#site-instagram').value.trim();
                data.site.social.facebook = $('#site-facebook').value.trim();

                if (await saveData()) {
                    showToast('Site info saved!', 'success');
                }
            };
        }
    }

    /* --- Settings --- */
    function renderSettingsEditor(container) {
        container.innerHTML = `
            <div class="panel">
                <h3 class="panel-title" style="margin-bottom:16px;">Security Settings</h3>
                <div style="display:flex; flex-direction:column; gap:14px; max-width: 400px;">
                    <div class="form-group">
                        <label>New Password</label>
                        <input type="password" class="text-input" id="new-admin-password" placeholder="Enter new password">
                    </div>
                    <div class="form-group">
                        <label>Confirm Password</label>
                        <input type="password" class="text-input" id="confirm-admin-password" placeholder="Confirm new password">
                    </div>
                    <button class="btn btn-primary" id="change-password-btn" style="margin-top:10px;">Change Password</button>
                </div>
                <p id="password-msg" style="margin-top: 12px; font-size: 0.875rem;"></p>
            </div>
            
            <div class="panel">
                <h3 class="panel-title" style="margin-bottom:16px;">Email Configuration</h3>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 16px;">
                    To use the "Forgot Password" feature, please create or update the <code>src/email_config.json</code> file on your server with your Gmail address, Gmail App Password, and recipient email.
                </p>
                <pre style="background: var(--bg-input); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); font-size: 0.8125rem; overflow-x: auto;">
{
    "gmail_address": "your.email@gmail.com",
    "gmail_app_password": "your-16-char-app-password",
    "recipient_email": "your.email@gmail.com"
}</pre>
            </div>`;

        const btn = $('#change-password-btn');
        if (btn) {
            btn.addEventListener('click', async () => {
                const pass = $('#new-admin-password').value.trim();
                const confirm = $('#confirm-admin-password').value.trim();
                const msg = $('#password-msg');

                if (!pass) {
                    msg.style.color = 'var(--red)';
                    msg.textContent = 'Please enter a password.';
                    return;
                }
                if (pass !== confirm) {
                    msg.style.color = 'var(--red)';
                    msg.textContent = 'Passwords do not match.';
                    return;
                }

                btn.disabled = true;
                btn.textContent = 'Saving...';
                
                try {
                    const res = await fetch(PASSWORD_URL, {
                        method: 'POST',
                        headers: {
                            'X-Admin-Token': token,
                            'Content-Type': 'text/plain'
                        },
                        body: pass
                    });
                    
                    const data = await res.json();
                    if (res.ok) {
                        msg.style.color = 'var(--green)';
                        msg.textContent = 'Password changed successfully! You will need to log in again.';
                        showToast('Password updated!', 'success');
                        
                        // Log out after a brief delay
                        setTimeout(() => {
                            sessionStorage.removeItem('adminToken');
                            token = '';
                            window.location.reload();
                        }, 2000);
                    } else {
                        throw new Error(data.error || 'Failed to change password');
                    }
                } catch (err) {
                    msg.style.color = 'var(--red)';
                    msg.textContent = err.message;
                    btn.disabled = false;
                    btn.textContent = 'Change Password';
                }
            });
        }
    }

    /* ===================================================================
     * MODAL
     * =================================================================== */
    function showModal(title, bodyHtml, onConfirm, confirmText, confirmClass) {
        const overlay = $('#modal-overlay');
        const titleEl = $('#modal-title');
        const bodyEl = $('#modal-body');
        const confirmBtn = $('#modal-confirm');
        const cancelBtn = $('#modal-cancel');
        const closeBtn = $('#modal-close');

        titleEl.textContent = title;
        bodyEl.innerHTML = bodyHtml;
        confirmBtn.textContent = confirmText || 'Save';
        confirmBtn.className = 'btn ' + (confirmClass || 'btn-primary');
        overlay.style.display = 'flex';

        // Cleanup previous listeners
        const newConfirm = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        const newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        const newClose = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newClose, closeBtn);

        const closeModal = () => { overlay.style.display = 'none'; };

        newConfirm.addEventListener('click', async () => {
            if (onConfirm) await onConfirm();
            closeModal();
        });

        newCancel.addEventListener('click', closeModal);
        newClose.addEventListener('click', closeModal);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        }, { once: true });
    }

    /* ===================================================================
     * TOAST NOTIFICATIONS
     * =================================================================== */
    function showToast(message, type) {
        const container = $('#toast-container');
        if (!container) return;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type || 'info'}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span>${escapeHtml(message)}</span>
        `;

        container.appendChild(toast);

        // Remove after animation
        setTimeout(() => {
            toast.remove();
        }, 4000);
    }

})();
