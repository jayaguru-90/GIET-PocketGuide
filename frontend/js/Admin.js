document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // 1. CREDENTIALS & AUTH CONTROLLER
    // -------------------------------------------------------------
    const ADMIN_USER = 'admin';
    const ADMIN_PASS = '1234';

    const authOverlay = document.getElementById('auth-overlay');
    const authForm = document.getElementById('auth-form');
    const userInput = document.getElementById('admin-user');
    const passInput = document.getElementById('admin-pass');
    const authError = document.getElementById('auth-error');
    const adminApp = document.getElementById('admin-app');
    const logoutBtn = document.getElementById('logout-btn');

    // Check existing session state
    function updateAuthState() {
        const isAuth = sessionStorage.getItem('giet_admin_authenticated') === 'true';
        if (isAuth) {
            authOverlay.style.opacity = '0';
            authOverlay.style.pointerEvents = 'none';
            setTimeout(() => {
                authOverlay.style.display = 'none';
            }, 300);

            adminApp.classList.remove('admin-app-locked');

            // Force Leaflet to recalculate dimensions after unlocking
            if (window.adminMapInstance) {
                setTimeout(() => {
                    window.adminMapInstance.invalidateSize();
                }, 150);
            }
        } else {
            authOverlay.style.display = 'flex';
            authOverlay.style.opacity = '1';
            authOverlay.style.pointerEvents = 'auto';
            adminApp.classList.add('admin-app-locked');
        }
    }

    // Handle Form Submit
    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const enteredUser = userInput.value.trim();
            const enteredPass = passInput.value.trim();

            if (enteredUser === ADMIN_USER && enteredPass === ADMIN_PASS) {
                sessionStorage.setItem('giet_admin_authenticated', 'true');
                authError.style.display = 'none';
                userInput.value = '';
                passInput.value = '';
                updateAuthState();
            } else {
                authError.style.display = 'block';
                authError.textContent = "Invalid username or password (User: admin, Pass: giet@2026)";
                passInput.value = '';
                passInput.focus();
            }
        });
    }

    // Logout Handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm("Log out of the administrator control panel?")) {
                sessionStorage.removeItem('giet_admin_authenticated');
                updateAuthState();
            }
        });
    }

    // -------------------------------------------------------------
    // 2. GOOGLE HYBRID SATELLITE MAP INITIALIZATION
    // -------------------------------------------------------------
    const GIET_CENTER = [19.0485, 83.8320];

    const googleHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 21,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
    });

    const osmRoads = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors'
    });

    const map = L.map('admin-map', {
        center: GIET_CENTER,
        zoom: 17,
        zoomControl: false,
        layers: [googleHybrid]
    });
    window.adminMapInstance = map;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const baseMaps = {
        "🛰️ Google Satellite Live": googleHybrid,
        "🗺️ Standard Street Map": osmRoads
    };
    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

    // -------------------------------------------------------------
    // 3. GEOJSON & BADGE PILL MARKERS
    // -------------------------------------------------------------
    let geojsonData = { type: "FeatureCollection", features: [] };
    let currentBadgesLayer = L.layerGroup().addTo(map);
    let temporaryPin = null;
    let editingLocationIndex = null;

    const locNameInput = document.getElementById('location-name');
    const locLatInput = document.getElementById('location-lat');
    const locLngInput = document.getElementById('location-lng');
    const formHeading = document.getElementById('form-heading');
    const formModeBadge = document.getElementById('form-mode-badge');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const saveLocationBtn = document.getElementById('save-location-btn');
    const locationsListEl = document.getElementById('locations-list');
    const searchInput = document.getElementById('search-locations');
    const exportBtn = document.getElementById('export-geojson-btn');

    cancelEditBtn.style.display = 'none';

    function getContextIcon(name) {
        const lower = name.toLowerCase();
        if (lower.includes('temple')) return '🛕';
        if (lower.includes('library')) return '📚';
        if (lower.includes('mess') || lower.includes('canteen') || lower.includes('parlour')) return '🍛';
        if (lower.includes('park') || lower.includes('garden')) return '🌳';
        if (lower.includes('parking')) return '🅿️';
        if (lower.includes('ground') || lower.includes('pool') || lower.includes('court')) return '⚽';
        if (lower.includes('bus') || lower.includes('gate')) return '🚪';
        if (lower.includes('hostel')) return '🏠';
        return '🏛️';
    }

    // Fetch GeoJSON
    fetch('giet_campus.geojson')
        .then(res => {
            if (!res.ok) throw new Error("Could not load giet_campus.geojson");
            return res.json();
        })
        .then(data => {
            geojsonData = data;
            renderMapLayers();
            renderSidebarList();
        })
        .catch(err => {
            console.warn("Starting with empty collection:", err);
            renderSidebarList();
        });

    function renderMapLayers() {
        currentBadgesLayer.clearLayers();

        geojsonData.features.forEach((feature, index) => {
            if (feature.geometry.type === 'Point') {
                const [lng, lat] = feature.geometry.coordinates;
                const name = feature.properties?.name || "Campus Location";
                const icon = getContextIcon(name);

                const badgeIcon = L.divIcon({
                    className: 'custom-map-pill-wrapper',
                    html: `
                        <div class="campus-badge-pill" id="badge-pill-${index}">
                            <span class="badge-icon">${icon}</span>
                            <span class="badge-title">${name}</span>
                        </div>
                    `,
                    iconSize: null,
                    iconAnchor: [60, 16]
                });

                const marker = L.marker([lat, lng], { icon: badgeIcon });

                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    selectLocationForEdit(index);
                });

                marker.addTo(currentBadgesLayer);
            }
        });
    }

    function renderSidebarList(filterText = '') {
        locationsListEl.innerHTML = '';

        const pointFeatures = geojsonData.features
            .map((feature, originalIndex) => ({ feature, originalIndex }))
            .filter(item => item.feature.geometry.type === 'Point');

        const filtered = pointFeatures.filter(item => {
            const name = item.feature.properties?.name || '';
            return name.toLowerCase().includes(filterText.toLowerCase());
        });

        if (filtered.length === 0) {
            locationsListEl.innerHTML = `<div style="text-align:center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.88rem;">No matching locations found.</div>`;
            return;
        }

        filtered.forEach(({ feature, originalIndex }) => {
            const name = feature.properties?.name || 'Unnamed Location';
            const [lng, lat] = feature.geometry.coordinates;
            const icon = getContextIcon(name);

            const itemCard = document.createElement('div');
            itemCard.className = `location-item ${editingLocationIndex === originalIndex ? 'active' : ''}`;

            itemCard.innerHTML = `
                <div>
                    <div class="loc-name">${icon} ${name}</div>
                    <div class="loc-coords">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
                </div>
                <div class="loc-item-actions">
                    <button class="action-icon-btn edit" title="Edit Place">✏️</button>
                    <button class="action-icon-btn delete" title="Delete Place">🗑️</button>
                </div>
            `;

            itemCard.querySelector('.edit').addEventListener('click', (e) => {
                e.stopPropagation();
                selectLocationForEdit(originalIndex);
            });

            itemCard.querySelector('.delete').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete "${name}" from campus locations?`)) {
                    deleteLocation(originalIndex);
                }
            });

            itemCard.addEventListener('click', () => {
                map.flyTo([lat, lng], 18, { duration: 0.8 });
                selectLocationForEdit(originalIndex);
            });

            locationsListEl.appendChild(itemCard);
        });
    }

    map.on('click', (e) => {
        const lat = parseFloat(e.latlng.lat.toFixed(6));
        const lng = parseFloat(e.latlng.lng.toFixed(6));

        locLatInput.value = lat;
        locLngInput.value = lng;

        if (temporaryPin) {
            temporaryPin.setLatLng([lat, lng]);
        } else {
            temporaryPin = L.marker([lat, lng], { draggable: true }).addTo(map);
            temporaryPin.on('dragend', (dragEvent) => {
                const pos = dragEvent.target.getLatLng();
                locLatInput.value = pos.lat.toFixed(6);
                locLngInput.value = pos.lng.toFixed(6);
            });
        }
    });

    function selectLocationForEdit(index) {
        editingLocationIndex = index;
        const feature = geojsonData.features[index];
        const [lng, lat] = feature.geometry.coordinates;
        const name = feature.properties?.name || '';

        locNameInput.value = name;
        locLatInput.value = lat;
        locLngInput.value = lng;

        formHeading.textContent = "Edit Location";
        formModeBadge.textContent = "Updating Item";
        saveLocationBtn.textContent = "💾 Update Location";
        cancelEditBtn.style.display = "inline-flex";

        if (temporaryPin) map.removeLayer(temporaryPin);
        temporaryPin = L.marker([lat, lng], { draggable: true }).addTo(map);
        temporaryPin.on('dragend', (dragEvent) => {
            const pos = dragEvent.target.getLatLng();
            locLatInput.value = pos.lat.toFixed(6);
            locLngInput.value = pos.lng.toFixed(6);
        });

        document.querySelectorAll('.campus-badge-pill').forEach(el => el.classList.remove('selected'));
        const activePill = document.getElementById(`badge-pill-${index}`);
        if (activePill) activePill.classList.add('selected');

        map.panTo([lat, lng]);
        renderSidebarList(searchInput.value);
    }

    function resetForm() {
        editingLocationIndex = null;
        locNameInput.value = '';
        locLatInput.value = '';
        locLngInput.value = '';

        formHeading.textContent = "Add Location";
        formModeBadge.textContent = "📍 Click Map to Set";
        saveLocationBtn.textContent = "➕ Save Location";
        cancelEditBtn.style.display = "none";

        document.querySelectorAll('.campus-badge-pill').forEach(el => el.classList.remove('selected'));

        if (temporaryPin) {
            map.removeLayer(temporaryPin);
            temporaryPin = null;
        }

        renderSidebarList(searchInput.value);
    }

    cancelEditBtn.addEventListener('click', resetForm);

    document.getElementById('location-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const name = locNameInput.value.trim();
        const lat = parseFloat(locLatInput.value);
        const lng = parseFloat(locLngInput.value);

        if (!name || isNaN(lat) || isNaN(lng)) {
            alert("Please provide a valid location name and coordinates.");
            return;
        }

        if (editingLocationIndex !== null) {
            geojsonData.features[editingLocationIndex].properties.name = name;
            geojsonData.features[editingLocationIndex].geometry.coordinates = [lng, lat];
        } else {
            const newFeature = {
                type: "Feature",
                properties: { name: name },
                geometry: {
                    type: "Point",
                    coordinates: [lng, lat]
                }
            };
            geojsonData.features.push(newFeature);
        }

        renderMapLayers();
        resetForm();
    });

    function deleteLocation(index) {
        geojsonData.features.splice(index, 1);
        if (editingLocationIndex === index) {
            resetForm();
        }
        renderMapLayers();
        renderSidebarList(searchInput.value);
    }

    searchInput.addEventListener('input', (e) => {
        renderSidebarList(e.target.value);
    });

    exportBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojsonData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "giet_campus.geojson");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    });

    // Check auth on page load
    updateAuthState();
});