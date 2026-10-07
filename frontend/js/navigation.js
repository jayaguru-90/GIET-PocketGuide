document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_URL = isLocal ? "http://127.0.0.1:8000" : "https://giet-campus-api.onrender.com";

    // ================= 1. DOM REFERENCES & STATE =================
    const waypointsContainer = document.getElementById('waypoints-container');
    const startDisplay = document.getElementById('start-display');
    const destinationDisplay = document.getElementById('destination-display');
    const addStopBtn = document.getElementById('add-stop-btn');
    const findRouteBtn = document.getElementById('find-route-btn');
    const clearRouteBtn = document.getElementById('clear-route-btn');
    const startNavBtn = document.getElementById('start-nav-btn');
    const simulateBtn = document.getElementById('simulate-btn');
    const speedToggleBtn = document.getElementById('speed-toggle-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const routeOutput = document.getElementById('route-output');
    const routeOptionsContainer = document.getElementById('route-options-container');
    const routeCardsList = document.getElementById('route-cards-list');
    const turnStepsContainer = document.getElementById('turn-steps-container');
    const turnStepsList = document.getElementById('turn-steps-list');
    const stepsTotalCount = document.getElementById('steps-total-count');
    const turnHud = document.getElementById('turn-by-turn-hud');
    const turnIcon = document.getElementById('turn-icon');
    const turnInstruction = document.getElementById('turn-instruction');
    const turnDistance = document.getElementById('turn-distance');
    const exitHudBtn = document.getElementById('exit-hud-btn');
    const voiceToggleBtn = document.getElementById('voice-toggle-btn');
    const recenterFabBtn = document.getElementById('recenter-fab-btn');

    // Location Picker Modal Elements
    const locationPickerModal = document.getElementById('location-picker-modal');
    const pickerBackdrop = document.getElementById('picker-backdrop');
    const closePickerBtn = document.getElementById('close-picker-btn');
    const pickerTitle = document.getElementById('picker-title');
    const pickerFilterInput = document.getElementById('picker-filter-input');
    const pickerItemsList = document.getElementById('picker-items-list');

    const catChips = document.querySelectorAll('.cat-chip');
    const utilChips = document.querySelectorAll('.util-chip');
    const buildingSearch = document.getElementById('building-search');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const searchResults = document.getElementById('search-results');
    const loadingScreen = document.getElementById('loading-screen');
    const navPanel = document.getElementById('nav-panel');
    const togglePanelBtn = document.getElementById('toggle-panel-btn');

    const GIET_CENTER = [19.0485, 83.8320];
    const ROUTE_PALETTE = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];

    // Campus geographic fence
    const CAMPUS_BOUNDS = L.latLngBounds(
        [19.0430, 83.8260],
        [19.0545, 83.8395]
    );

    let campusGeoJSON = null;
    let buildings = {};
    let markerLayers = {};
    let placeMetadata = {};
    let placeNamesSorted = [];
    let calculatedRoutes = [];
    let activeRouteIndex = 0;

    // Indoor Rooms Cache for search & pickers
    let allIndoorRooms = [];

    let selectedWaypoints = {
        start: { id: "LIVE_LOCATION", name: "My Live Location (GPS)" },
        destination: null,
        extraStops: []
    };
    let activePickerTarget = null;
    let activeIndoorDestination = null; // Stores { building, roomCode, floorNum, roomName }

    let fullRouteCoords = [];
    let remainingRoutePolyline = null;
    let breadcrumbPolyline = null;
    let alternativePolylines = [];

    let clientGraph = {};
    let clientNodes = [];

    let currentUserLat = null;
    let currentUserLng = null;
    let userMarker = null;
    let userAccuracyCircle = null;
    let watchId = null;

    let simulationInterval = null;
    let simSpeedMultiplier = 1;
    const SPEED_OPTIONS = [1, 2, 4];
    let speedOptionIdx = 0;

    let turnInstructions = [];
    let utilityMarkers = [];
    let activeCategory = 'all';
    let isTrackingOrSimulating = false;

    // ================= 2. THEME ENGINE =================
    function initTheme() {
        const savedTheme = localStorage.getItem('giet-theme') || 'light';
        applyTheme(savedTheme);
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            if (themeToggleBtn) {
                themeToggleBtn.innerHTML = `<i class="fa-solid fa-sun" style="color:#fbbf24;"></i>`;
                themeToggleBtn.title = "Switch to Light Theme";
            }
        } else {
            document.body.classList.remove('dark-mode');
            if (themeToggleBtn) {
                themeToggleBtn.innerHTML = `<i class="fa-solid fa-moon"></i>`;
                themeToggleBtn.title = "Switch to Dark Theme";
            }
        }
        localStorage.setItem('giet-theme', theme);
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.body.classList.contains('dark-mode');
            applyTheme(isDark ? 'light' : 'dark');
        });
    }
    initTheme();

    // ================= 3. VOICE GUIDANCE =================
    let isVoiceEnabled = true;
    let spokenMilestones = new Set();

    function speakVoicePrompt(text) {
        if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.05;
        utterance.lang = 'en-US';

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
        if (preferredVoice) utterance.voice = preferredVoice;

        window.speechSynthesis.speak(utterance);
    }

    if (voiceToggleBtn) {
        voiceToggleBtn.addEventListener('click', () => {
            isVoiceEnabled = !isVoiceEnabled;
            voiceToggleBtn.classList.toggle('active', isVoiceEnabled);
            voiceToggleBtn.innerHTML = isVoiceEnabled 
                ? `<i class="fa-solid fa-volume-high"></i>` 
                : `<i class="fa-solid fa-volume-xmark"></i>`;
            
            if (isVoiceEnabled) {
                speakVoicePrompt("Voice assistance enabled.");
            } else {
                window.speechSynthesis.cancel();
            }
        });
    }

    function hideLoader() {
        if (!loadingScreen) return;
        loadingScreen.classList.add('hidden');
        loadingScreen.style.display = 'none';
        setTimeout(() => { if (map) map.invalidateSize(); }, 200);
    }
    const safetyTimer = setTimeout(hideLoader, 2000);

    // ================= 4. MAP INITIALIZATION WITH BOUNDS =================
    const map = L.map('map', {
        zoomControl: false,
        minZoom: 16,
        maxZoom: 22,
        tap: false,
        maxBounds: CAMPUS_BOUNDS,
        maxBoundsViscosity: 1.0
    }).setView(GIET_CENTER, 18);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 22,
        maxNativeZoom: 20,
        bounds: CAMPUS_BOUNDS,
        attribution: '&copy; Google Satellite &mdash; GIET University'
    }).addTo(map);

    // ================= 5. PLACE ICONS & CATEGORIES =================
    function getPlaceIcon(name, rawCategory = '') {
        const n = (name || '').toLowerCase().trim();
        const c = (rawCategory || '').toLowerCase().trim();

        if (n.includes('wc') || n.includes('washroom') || n.includes('restroom') || n.includes('toilet') || c.includes('washroom')) return '🚻';
        if (n.includes('dispensary') || n.includes('medical') || c.includes('medical')) return '🏥';
        if (n.includes('security') || n.includes('guard') || c.includes('security')) return '🛡️';
        if (n.includes('temple')) return '🛕';
        if (n.includes('canteen')) return '🍱';
        if (n.includes('mess')) return '🍲';
        if (n.includes('swimming') || n.includes('pool')) return '🏊‍♂️';
        if (n.includes('ground') || n.includes('stadium')) return '⚽';
        if (n.includes('bus')) return '🚌';
        if (n.includes('parking')) return '🅿️';
        if (n.includes('library')) return '📚';
        if (n.includes('auditorium')) return '🎭';
        if (n.includes('cse') || n.includes('csa')) return '💻';
        if (n.includes('bio tech')) return '🧪';
        if (n.includes('agriculture')) return '🌾';
        if (n.includes('mechanical')) return '⚙️';
        if (n.includes('admin')) return '🏛️';
        return '🏢';
    }

    function getCategoryClassification(name, rawCategory = '') {
        const n = name.toLowerCase();
        const c = rawCategory.toLowerCase();

        if (c.includes('academic') || n.includes('building') || n.includes('block') || n.includes('library') || n.includes('csa') || n.includes('bsh')) return 'academic';
        if (c.includes('hostel') || c.includes('mess') || n.startsWith('nc-') || n.includes('mess')) return 'hostel';
        if (c.includes('food') || n.includes('canteen') || n.includes('parlour')) return 'food';
        if (c.includes('sports') || n.includes('pool') || n.includes('ground')) return 'sports';
        if (c.includes('parking') || c.includes('gate') || n.includes('bus')) return 'parking';
        return 'academic';
    }

    function applyCategoryAndZoomFilter() {
        const currentZoom = map.getZoom();
        const isZoomedOut = currentZoom < 18;
        const majorLandmarks = ['admin block', 'library', 'canteen', 'giet temple', 'bus-stop', 'central mess', 'giet main ground'];

        Object.keys(markerLayers).forEach(name => {
            const layer = markerLayers[name];
            const meta = placeMetadata[name] || {};
            const itemCat = meta.category || 'academic';

            const categoryMatches = (activeCategory === 'all' || itemCat === activeCategory);
            const zoomMatches = !isZoomedOut || majorLandmarks.some(landmark => name.toLowerCase().includes(landmark));

            if (categoryMatches && zoomMatches) {
                if (!map.hasLayer(layer)) map.addLayer(layer);
            } else {
                if (map.hasLayer(layer)) map.removeLayer(layer);
            }
        });
    }

    map.on('zoomend', applyCategoryAndZoomFilter);

    catChips.forEach(chip => {
        chip.addEventListener('click', () => {
            catChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeCategory = chip.getAttribute('data-cat');
            applyCategoryAndZoomFilter();
        });
    });

    // ================= 6. UTILITIES OVERLAY =================
    function renderUtilities(filterType) {
        utilityMarkers.forEach(m => map.removeLayer(m));
        utilityMarkers = [];

        if (filterType === 'none' || !campusGeoJSON) return;

        (campusGeoJSON.features || []).forEach(feat => {
            if (feat.geometry && feat.geometry.type === 'Point') {
                const cat = (feat.properties.category || '').toLowerCase();
                const name = feat.properties.name || '';
                const [lng, lat] = feat.geometry.coordinates;

                let matchType = null;
                if (cat.includes('water') || name.toLowerCase().includes('water') || name.toLowerCase().includes('cooler')) matchType = 'water';
                else if (cat.includes('washroom') || cat.includes('restroom') || name.toLowerCase().includes('washroom') || name.toLowerCase().includes('toilet') || name.toLowerCase().includes('wc')) matchType = 'washroom';
                else if (cat.includes('medical') || name.toLowerCase().includes('first aid') || name.toLowerCase().includes('dispensary')) matchType = 'medical';
                else if (cat.includes('security') || cat.includes('gate') || name.toLowerCase().includes('security')) matchType = 'security';

                if (matchType && (filterType === 'all' || filterType === matchType)) {
                    const iconMap = { water: '🚰', washroom: '🚻', medical: '🏥', security: '🛡️' };
                    const customIcon = L.divIcon({
                        className: 'custom-util-icon',
                        html: `<div class="util-marker-pin util-pin-${matchType}">${iconMap[matchType]}</div>`,
                        iconSize: [28, 28],
                        iconAnchor: [14, 14]
                    });

                    const m = L.marker([lat, lng], { icon: customIcon }).addTo(map);
                    m.bindPopup(`<strong>${name}</strong><br><small style="text-transform: capitalize;">${matchType}</small>`);
                    utilityMarkers.push(m);
                }
            }
        });
    }

    utilChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const type = chip.getAttribute('data-type');
            if (chip.classList.contains('active')) {
                chip.classList.remove('active');
                renderUtilities('none');
            } else {
                utilChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                renderUtilities(type);
            }
        });
    });

    // ================= 7. CLIENT DIJKSTRA ROUTING ENGINE =================
    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function toKey(lat, lng) { return `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`; }
    function parseKey(key) { return key.split(',').map(Number); }

    function getBearing(lat1, lon1, lat2, lon2) {
        const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
        const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
                  Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    function buildClientGraph(geojson) {
        clientGraph = {};
        clientNodes = [];
        const nodeSet = new Set();

        function regNode(k) {
            if (!nodeSet.has(k)) {
                nodeSet.add(k);
                clientNodes.push(k);
            }
        }

        function addEdge(uKey, vKey, uCoord, vCoord) {
            if (uKey === vKey) return;
            const d = getDistance(uCoord[0], uCoord[1], vCoord[0], vCoord[1]);
            regNode(uKey);
            regNode(vKey);
            if (!clientGraph[uKey]) clientGraph[uKey] = [];
            if (!clientGraph[vKey]) clientGraph[vKey] = [];
            if (!clientGraph[uKey].some(e => e.node === vKey)) clientGraph[uKey].push({ node: vKey, weight: d, coord: vCoord });
            if (!clientGraph[vKey].some(e => e.node === uKey)) clientGraph[vKey].push({ node: uKey, weight: d, coord: uCoord });
        }

        (geojson.features || []).forEach(feat => {
            const geom = feat.geometry || {};
            if (geom.type === 'LineString') {
                const coords = geom.coordinates || [];
                for (let i = 0; i < coords.length - 1; i++) {
                    const u = [coords[i][1], coords[i][0]];
                    const v = [coords[i + 1][1], coords[i + 1][0]];
                    addEdge(toKey(u[0], u[1]), toKey(v[0], v[1]), u, v);
                }
            }
        });

        for (let i = 0; i < clientNodes.length; i++) {
            const p1 = parseKey(clientNodes[i]);
            for (let j = i + 1; j < clientNodes.length; j++) {
                const p2 = parseKey(clientNodes[j]);
                if (getDistance(p1[0], p1[1], p2[0], p2[1]) <= 12.0) {
                    addEdge(clientNodes[i], clientNodes[j], p1, p2);
                }
            }
        }
    }

    function findNearestGraphNode(lat, lng) {
        let bestKey = null;
        let minD = Infinity;
        for (let i = 0; i < clientNodes.length; i++) {
            const [nLat, nLng] = parseKey(clientNodes[i]);
            const d = getDistance(lat, lng, nLat, nLng);
            if (d < minD) {
                minD = d;
                bestKey = clientNodes[i];
            }
        }
        return bestKey;
    }

    function dijkstraSearch(startKey, endKey, penalized = {}) {
        const queue = [{ cost: 0, node: startKey, path: [] }];
        const bestCost = { [startKey]: 0 };
        const visited = new Set();

        while (queue.length > 0) {
            queue.sort((a, b) => a.cost - b.cost);
            const { cost, node, path } = queue.shift();

            if (visited.has(node)) continue;
            visited.add(node);
            const currentPath = [...path, node];

            if (node === endKey) return { path: currentPath, cost };

            const edges = clientGraph[node] || [];
            for (let i = 0; i < edges.length; i++) {
                const edge = edges[i];
                if (visited.has(edge.node)) continue;

                const edgeKey1 = `${node}|${edge.node}`;
                const edgeKey2 = `${edge.node}|${node}`;
                const multiplier = penalized[edgeKey1] || penalized[edgeKey2] || 1.0;
                const nextCost = cost + (edge.weight * multiplier);

                if (nextCost < (bestCost[edge.node] || Infinity)) {
                    bestCost[edge.node] = nextCost;
                    queue.push({ cost: nextCost, node: edge.node, path: currentPath });
                }
            }
        }
        return null;
    }

    function computeClientSideRoutes(coordsArray) {
        const routes = [];
        const penalized = {};
        const isMulti = coordsArray.length > 2;

        for (let iter = 0; iter < 3; iter++) {
            let fullCoords = [];
            let allNodePath = [];
            let failed = false;

            for (let leg = 0; leg < coordsArray.length - 1; leg++) {
                const p1 = coordsArray[leg];
                const p2 = coordsArray[leg + 1];
                const startNode = findNearestGraphNode(p1[0], p1[1]);
                const endNode = findNearestGraphNode(p2[0], p2[1]);

                if (!startNode || !endNode) {
                    failed = true;
                    break;
                }

                const result = dijkstraSearch(startNode, endNode, penalized);
                if (!result || !result.path) {
                    failed = true;
                    break;
                }

                const legCoords = [p1, ...result.path.map(parseKey), p2];
                if (fullCoords.length > 0) {
                    fullCoords.push(...legCoords.slice(1));
                    allNodePath.push(...result.path.slice(1));
                } else {
                    fullCoords.push(...legCoords);
                    allNodePath.push(...result.path);
                }
            }

            if (failed || fullCoords.length < 2) break;

            let dist = 0;
            for (let i = 0; i < fullCoords.length - 1; i++) {
                dist += getDistance(fullCoords[i][0], fullCoords[i][1], fullCoords[i + 1][0], fullCoords[i + 1][1]);
            }

            const isDistinct = !routes.some(r => Math.abs(r.totalDistance - dist) < 10);
            if (isDistinct) {
                routes.push({ path: fullCoords, totalDistance: Math.round(dist) });
                if (routes.length >= 3) break;
            }

            if (allNodePath.length > 3) {
                for (let i = 1; i < allNodePath.length - 2; i++) {
                    const k = `${allNodePath[i]}|${allNodePath[i + 1]}`;
                    penalized[k] = (penalized[k] || 1.0) * 2.2;
                }
            }
        }

        routes.sort((a, b) => a.totalDistance - b.totalDistance);
        return routes.map((r, idx) => ({
            name: isMulti ? (idx === 0 ? "Shortest Multi-Stop Route" : `Multi-Stop Route ${idx + 1}`) : (idx === 0 ? "Shortest Route (Via Walkway)" : `Alternative Route ${idx + 1}`),
            path: r.path,
            totalDistance: r.totalDistance
        }));
    }

    // ================= 8. TURN-BY-TURN INSTRUCTIONS =================
    function generateTurnInstructions(coords) {
        if (!coords || coords.length < 2) return [];
        const instructions = [];
        let accumulatedDistance = 0;

        instructions.push({ id: "step_start", action: "start", icon: "📍", text: "Start walking along the path", distance: 0, coord: coords[0] });

        for (let i = 1; i < coords.length - 1; i++) {
            const pPrev = coords[i - 1];
            const pCurr = coords[i];
            const pNext = coords[i + 1];

            const segDist = getDistance(pPrev[0], pPrev[1], pCurr[0], pCurr[1]);
            accumulatedDistance += segDist;

            const b1 = getBearing(pPrev[0], pPrev[1], pCurr[0], pCurr[1]);
            const b2 = getBearing(pCurr[0], pCurr[1], pNext[0], pNext[1]);

            let diff = b2 - b1;
            while (diff < -180) diff += 360;
            while (diff > 180) diff -= 360;

            if (Math.abs(diff) >= 32) {
                const turnType = diff > 0 ? "Turn Right" : "Turn Left";
                const icon = diff > 0 ? "↗" : "↖️";
                instructions.push({
                    id: `turn_${i}_${Math.round(pCurr[0] * 1000)}`,
                    action: "turn",
                    icon: icon,
                    text: `${turnType} onto connecting walkway`,
                    distance: Math.round(accumulatedDistance),
                    coord: pCurr
                });
                accumulatedDistance = 0;
            }
        }

        const finalSeg = getDistance(coords[coords.length - 2][0], coords[coords.length - 2][1], coords[coords.length - 1][0], coords[coords.length - 1][1]);
        accumulatedDistance += finalSeg;

        instructions.push({ id: "step_arrive", action: "arrive", icon: "🏁", text: "Arrive at destination doorway", distance: Math.round(accumulatedDistance), coord: coords[coords.length - 1] });
        return instructions;
    }

    function renderTurnDirections(instructions) {
        turnStepsList.innerHTML = '';
        instructions.forEach((step, idx) => {
            const div = document.createElement('div');
            div.className = `turn-step-item ${idx === 0 ? 'active' : ''}`;
            div.innerHTML = `
                <span style="font-size: 1.25rem;">${step.icon}</span>
                <div>
                    <div><strong>${step.text}</strong></div>
                    <div style="color: #64748b; font-size: 11.5px;">${step.distance > 0 ? `After ${step.distance} meters` : 'Origin'}</div>
                </div>
            `;
            turnStepsList.appendChild(div);
        });

        if (stepsTotalCount) stepsTotalCount.textContent = `${instructions.length} steps`;
        turnStepsContainer.classList.remove('hidden');
    }

    // ================= 9. LIVE GPS & POLYLINE TRIMMING =================
    function updateUserLiveLocation(lat, lng, accuracy = 5) {
        currentUserLat = lat;
        currentUserLng = lng;

        if (recenterFabBtn) recenterFabBtn.classList.remove('hidden');

        if (!userMarker) {
            const userIcon = L.divIcon({
                className: 'user-pulse-marker',
                html: `<div style="width: 18px; height: 18px; background: #38bdf8; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 0 14px #0284c7;"></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9]
            });
            userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
            userAccuracyCircle = L.circle([lat, lng], { radius: accuracy, color: '#38bdf8', weight: 1, fillOpacity: 0.15 }).addTo(map);
        } else {
            userMarker.setLatLng([lat, lng]);
            userAccuracyCircle.setLatLng([lat, lng]);
            userAccuracyCircle.setRadius(accuracy);
        }

        if (fullRouteCoords.length > 1) {
            updateDynamicBreadcrumb([lat, lng]);
        }
    }

    if (recenterFabBtn) {
        recenterFabBtn.addEventListener('click', () => {
            if (currentUserLat && currentUserLng) {
                map.flyTo([currentUserLat, currentUserLng], 19, { duration: 0.8 });
            }
        });
    }

    function updateDynamicBreadcrumb(currentPos) {
        let closestIdx = 0;
        let minD = Infinity;

        for (let i = 0; i < fullRouteCoords.length; i++) {
            const d = getDistance(currentPos[0], currentPos[1], fullRouteCoords[i][0], fullRouteCoords[i][1]);
            if (d < minD) {
                minD = d;
                closestIdx = i;
            }
        }

        if (minD < 18) {
            const remainingCoords = [currentPos, ...fullRouteCoords.slice(closestIdx + 1)];
            const walkedCoords = fullRouteCoords.slice(0, closestIdx + 1);

            if (remainingRoutePolyline) remainingRoutePolyline.setLatLngs(remainingCoords);
            if (!breadcrumbPolyline) {
                breadcrumbPolyline = L.polyline(walkedCoords, { color: '#94a3b8', weight: 4, opacity: 0.5, dashArray: '3, 6' }).addTo(map);
            } else {
                breadcrumbPolyline.setLatLngs(walkedCoords);
            }

            updateHudInstruction(remainingCoords, currentPos);
        }
    }

    function showArrivalTransitionModal() {
        if (!activeIndoorDestination) return;
        if (document.getElementById('arrival-popup-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'arrival-popup-overlay';
        overlay.className = 'arrival-popup-overlay';
        overlay.innerHTML = `
            <div class="arrival-popup-card">
                <div class="arrival-icon-badge">
                    <i class="fa-solid fa-door-open"></i>
                </div>
                <h3 style="color:#ffffff; font-size:18px; font-weight:800; margin:0;">You Have Arrived!</h3>
                <p style="color:#94a3b8; font-size:13px; line-height:1.5; margin:0;">
                    Reached <strong>${activeIndoorDestination.building}</strong>.<br>
                    Destination room: <strong style="color:#38bdf8;">${activeIndoorDestination.roomCode}</strong> (Floor ${activeIndoorDestination.floorNum}).
                </p>
                <a href="building.html?name=${encodeURIComponent(activeIndoorDestination.building)}&floor=${activeIndoorDestination.floorNum}&room=${encodeURIComponent(activeIndoorDestination.roomCode)}" 
                   class="btn-open-blueprint">
                    <i class="fa-solid fa-map"></i> View Floor ${activeIndoorDestination.floorNum} Layout &rarr;
                </a>
                <button type="button" id="close-arrival-btn" style="background:transparent; color:#64748b; font-size:12px; cursor:pointer; border:none; padding:4px;">
                    Stay on Outdoor Map
                </button>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#close-arrival-btn').addEventListener('click', () => {
            overlay.remove();
        });
    }

    function updateHudInstruction(remainingCoords, currentPos) {
        if (!turnInstructions || turnInstructions.length === 0) return;

        let nextTurn = null;
        for (let i = 0; i < turnInstructions.length; i++) {
            const step = turnInstructions[i];
            const d = getDistance(currentPos[0], currentPos[1], step.coord[0], step.coord[1]);
            if (d > 6) {
                nextTurn = step;
                nextTurn.liveDist = Math.round(d);
                break;
            }
        }

        if (nextTurn) {
            turnHud.classList.remove('hidden');
            turnIcon.textContent = nextTurn.icon;
            turnInstruction.textContent = nextTurn.text;
            turnDistance.textContent = `in ${nextTurn.liveDist} meters`;

            const approachKey = `approach_${nextTurn.id}`;
            if (nextTurn.liveDist <= 25 && nextTurn.liveDist > 8 && !spokenMilestones.has(approachKey)) {
                spokenMilestones.add(approachKey);
                speakVoicePrompt(`In ${nextTurn.liveDist} meters, ${nextTurn.text}`);
            }

            const executeKey = `execute_${nextTurn.id}`;
            if (nextTurn.liveDist <= 8 && !spokenMilestones.has(executeKey)) {
                spokenMilestones.add(executeKey);
                speakVoicePrompt(nextTurn.text);
            }
        } else {
            turnHud.classList.remove('hidden');
            turnIcon.textContent = "🏁";
            
            if (activeIndoorDestination) {
                turnInstruction.innerHTML = `
                    Arrived at ${activeIndoorDestination.building}!<br>
                    <a href="building.html?name=${encodeURIComponent(activeIndoorDestination.building)}&floor=${activeIndoorDestination.floorNum}&room=${encodeURIComponent(activeIndoorDestination.roomCode)}" 
                       style="display:inline-block; margin-top:4px; padding:3px 8px; background:#2563eb; color:#fff; border-radius:4px; font-weight:700; text-decoration:none; font-size:11px;">
                       🏢 Open Room ${activeIndoorDestination.roomCode} Layout &rarr;
                    </a>
                `;
                showArrivalTransitionModal();
            } else {
                turnInstruction.textContent = "Arrived at destination entrance";
            }
            turnDistance.textContent = "within 5 meters";

            if (!spokenMilestones.has("arrived")) {
                spokenMilestones.add("arrived");
                speakVoicePrompt("You have arrived at your destination doorway.");
            }
        }
    }

    // ================= 10. ROUTE VISUALIZATION =================
    function selectActiveRoute(index) {
        activeRouteIndex = index;
        const selectedRoute = calculatedRoutes[index];
        fullRouteCoords = selectedRoute.path;
        spokenMilestones.clear();

        if (remainingRoutePolyline) map.removeLayer(remainingRoutePolyline);
        if (breadcrumbPolyline) map.removeLayer(breadcrumbPolyline);
        alternativePolylines.forEach(p => map.removeLayer(p));
        alternativePolylines = [];
        breadcrumbPolyline = null;

        calculatedRoutes.forEach((r, idx) => {
            if (idx !== index) {
                const alt = L.polyline(r.path, {
                    color: ROUTE_PALETTE[idx] || '#64748b',
                    weight: 5,
                    opacity: 0.5,
                    dashArray: '8, 8'
                }).addTo(map);
                alt.on('click', () => selectActiveRoute(idx));
                alternativePolylines.push(alt);
            }
        });

        remainingRoutePolyline = L.polyline(fullRouteCoords, {
            color: ROUTE_PALETTE[index] || '#10b981',
            weight: 7,
            opacity: 1.0,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(map);

        turnInstructions = generateTurnInstructions(fullRouteCoords);
        renderTurnDirections(turnInstructions);

        const estTime = Math.ceil(selectedRoute.totalDistance / 75);
        speakVoicePrompt(`Route found. Distance is ${selectedRoute.totalDistance} meters, about ${estTime} minutes walk.`);

        const cards = routeCardsList.children;
        for (let i = 0; i < cards.length; i++) {
            cards[i].classList.toggle('active', i === index);
        }

        if (routeOutput) {
            routeOutput.classList.remove('hidden');
            let indoorBanner = '';
            if (activeIndoorDestination) {
                indoorBanner = `
                    <div style="margin-bottom:10px; padding:10px; background:rgba(37,99,235,0.22); border:1.5px solid #2563eb; border-radius:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:12px; color:#93c5fd; font-weight:800;">Target Room: ${activeIndoorDestination.roomCode}</span>
                            <span style="font-size:10px; background:#1e293b; padding:2px 6px; border-radius:4px; color:#cbd5e1;">Floor ${activeIndoorDestination.floorNum}</span>
                        </div>
                        <a href="building.html?name=${encodeURIComponent(activeIndoorDestination.building)}&floor=${activeIndoorDestination.floorNum}&room=${encodeURIComponent(activeIndoorDestination.roomCode)}" 
                           style="display:flex; align-items:center; justify-content:center; gap:6px; margin-top:8px; background:#2563eb; color:#ffffff; padding:7px 12px; border-radius:6px; font-size:12px; text-decoration:none; font-weight:700;">
                           🏢 Open Inside Floor Layout &rarr;
                        </a>
                    </div>
                `;
            }

            routeOutput.innerHTML = `
                ${indoorBanner}
                <div style="font-size: 13px;">
                    <strong style="color: ${ROUTE_PALETTE[index] || '#10b981'}">${selectedRoute.name}</strong><br>
                    Distance: <strong>${selectedRoute.totalDistance} meters</strong> (~${estTime} mins walk)
                </div>
            `;
        }

        if (!isTrackingOrSimulating && remainingRoutePolyline) {
            const isMobile = window.innerWidth <= 640;
            const bottomPadding = isMobile ? 180 : 40;
            const topPadding = isMobile ? 90 : 40;

            map.fitBounds(remainingRoutePolyline.getBounds(), {
                paddingTopLeft: [20, topPadding],
                paddingBottomRight: [20, bottomPadding],
                maxZoom: 19,
                animate: true
            });
        }
    }

    function renderRoutes(routes) {
        calculatedRoutes = routes;
        routeCardsList.innerHTML = '';

        routes.forEach((route, idx) => {
            const isShortest = idx === 0;
            const routeColor = ROUTE_PALETTE[idx] || '#64748b';

            const card = document.createElement('div');
            card.className = `route-card ${isShortest ? 'active' : ''}`;
            card.innerHTML = `
                <div class="route-card-title" style="display: flex; align-items: center; justify-content: space-between;">
                    <span style="display: flex; align-items: center; gap: 6px;">
                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${routeColor};"></span>
                        <strong>${route.name}</strong>
                    </span>
                    <span>~${Math.ceil(route.totalDistance / 75)} min</span>
                </div>
                <div class="route-card-sub" style="margin-left: 16px;">${route.totalDistance} meters • Walkway connected</div>
            `;
            card.addEventListener('click', () => selectActiveRoute(idx));
            routeCardsList.appendChild(card);
        });

        routeOptionsContainer.classList.remove('hidden');
        selectActiveRoute(0);
    }

    // ================= 11. IN-APP LOCATION PICKER (SCALABLE & GROUPED) =================
    let pickerCategoryFilter = 'all';

    function openLocationPicker(targetKey, titleText) {
        activePickerTarget = targetKey;
        pickerTitle.textContent = titleText || "Select Campus Location";
        pickerFilterInput.value = "";
        pickerCategoryFilter = 'all';
        renderPickerList("");
        locationPickerModal.classList.remove('hidden');
        setTimeout(() => pickerFilterInput.focus(), 100);
    }

    function closeLocationPicker() {
        locationPickerModal.classList.add('hidden');
        activePickerTarget = null;
    }

    function renderPickerCategoryBar() {
        let chipBar = document.getElementById('picker-category-chip-bar');
        const pickerSearchBox = document.querySelector('.picker-search-box');
        if (!chipBar && pickerSearchBox) {
            chipBar = document.createElement('div');
            chipBar.id = 'picker-category-chip-bar';
            chipBar.className = 'picker-filter-chips';
            pickerSearchBox.parentNode.insertBefore(chipBar, pickerItemsList);
        }

        if (!chipBar) return;

        const categories = [
            { key: 'all', label: 'All Places' },
            { key: 'classroom', label: 'Classrooms' },
            { key: 'laboratory', label: 'Labs' },
            { key: 'office', label: 'Offices' },
            { key: 'washroom', label: 'Washrooms' }
        ];

        chipBar.innerHTML = '';
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `picker-chip-btn ${pickerCategoryFilter === cat.key ? 'active' : ''}`;
            btn.textContent = cat.label;
            btn.addEventListener('click', () => {
                pickerCategoryFilter = cat.key;
                renderPickerCategoryBar();
                renderPickerList(pickerFilterInput.value);
            });
            chipBar.appendChild(btn);
        });
    }

    function renderPickerList(filterTerm) {
        renderPickerCategoryBar();
        pickerItemsList.innerHTML = "";
        const term = filterTerm.toLowerCase().trim();

        // 1. Live Location Option (Only for Starting point)
        if (activePickerTarget === 'start' && pickerCategoryFilter === 'all') {
            const liveItem = document.createElement('div');
            liveItem.className = 'picker-item';
            liveItem.innerHTML = `<span class="picker-item-icon">📍</span> <span>My Live Location (GPS)</span>`;
            liveItem.addEventListener('click', () => {
                selectedWaypoints.start = { id: "LIVE_LOCATION", name: "My Live Location (GPS)" };
                startDisplay.querySelector('.waypoint-text').textContent = "📍 My Live Location (GPS)";
                closeLocationPicker();
            });
            pickerItemsList.appendChild(liveItem);
        }

        // 2. Filter & Group Indoor Rooms
        let filteredRooms = allIndoorRooms.filter(r => {
            const matchesQuery = !term || 
                r.number.toLowerCase().includes(term) || 
                r.name.toLowerCase().includes(term) || 
                r.building.toLowerCase().includes(term);
            const matchesCat = pickerCategoryFilter === 'all' || (r.type || '').toLowerCase() === pickerCategoryFilter;
            return matchesQuery && matchesCat;
        });

        // Group rooms by Building -> Floor
        if (filteredRooms.length > 0) {
            const grouped = {};
            filteredRooms.forEach(rm => {
                const groupKey = `${rm.building} — Floor ${rm.floor_number}`;
                if (!grouped[groupKey]) grouped[groupKey] = [];
                grouped[groupKey].push(rm);
            });

            Object.keys(grouped).forEach(groupTitle => {
                const groupHeader = document.createElement('div');
                groupHeader.className = 'picker-group-heading';
                groupHeader.innerHTML = `
                    <span>🏢 ${groupTitle}</span>
                    <span style="font-size:10px; opacity:0.8;">${grouped[groupTitle].length} rooms</span>
                `;
                pickerItemsList.appendChild(groupHeader);

                grouped[groupTitle].forEach(rm => {
                    const item = document.createElement('div');
                    item.className = 'picker-item-room';

                    const isDuplicate = rm.name.trim().toLowerCase() === rm.number.trim().toLowerCase();
                    const titleText = isDuplicate ? rm.number : `${rm.number}: ${rm.name}`;
                    const category = (rm.type || 'classroom').toLowerCase();

                    item.innerHTML = `
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:16px;">🚪</span>
                            <div>
                                <div style="font-weight:700; color:#ffffff; font-size:13px;">${titleText}</div>
                                <div style="font-size:11px; color:#94a3b8;">${rm.building} &bull; Level ${rm.floor_number}</div>
                            </div>
                        </div>
                        <span class="room-item-badge ${category}">${rm.type || 'Room'}</span>
                    `;

                    item.addEventListener('click', () => {
                        handleSelectDestinationRoom(rm);
                        closeLocationPicker();
                    });
                    pickerItemsList.appendChild(item);
                });
            });
        }

        // 3. Outdoor Blocks & Sites
        if (pickerCategoryFilter === 'all') {
            const matchingPlaces = placeNamesSorted.filter(name => !term || name.toLowerCase().includes(term));
            if (matchingPlaces.length > 0) {
                const catLabel2 = document.createElement('div');
                catLabel2.className = 'picker-group-heading';
                catLabel2.style.color = '#94a3b8';
                catLabel2.innerHTML = `<span>🏛️ Campus Blocks & Landmarks</span>`;
                pickerItemsList.appendChild(catLabel2);

                matchingPlaces.forEach(name => {
                    const icon = getPlaceIcon(name);
                    const item = document.createElement('div');
                    item.className = 'picker-item';
                    item.innerHTML = `<span class="picker-item-icon">${icon}</span> <span>${name}</span>`;

                    item.addEventListener('click', () => {
                        if (activePickerTarget === 'start') {
                            selectedWaypoints.start = { id: name, name: name };
                            startDisplay.querySelector('.waypoint-text').textContent = `${icon} ${name}`;
                        } else if (activePickerTarget === 'destination') {
                            activeIndoorDestination = null;
                            selectedWaypoints.destination = { id: name, name: name };
                            const destText = destinationDisplay.querySelector('.waypoint-text');
                            destText.textContent = `${icon} ${name}`;
                            destText.classList.remove('placeholder');
                        } else if (typeof activePickerTarget === 'number') {
                            selectedWaypoints.extraStops[activePickerTarget] = { id: name, name: name };
                            const stopCard = waypointsContainer.querySelectorAll('.stop-row')[activePickerTarget];
                            if (stopCard) {
                                const txt = stopCard.querySelector('.waypoint-text');
                                txt.textContent = `${icon} ${name}`;
                                txt.classList.remove('placeholder');
                            }
                        }
                        closeLocationPicker();
                    });

                    pickerItemsList.appendChild(item);
                });
            }
        }
    }

    function handleSelectDestinationRoom(rm) {
        const hostBuilding = resolveHostBuildingName(rm.building);
        activeIndoorDestination = { 
            building: hostBuilding, 
            roomCode: rm.number, 
            floorNum: rm.floor_number,
            roomName: rm.name 
        };
        selectedWaypoints.destination = { id: hostBuilding, name: hostBuilding };

        const destText = destinationDisplay.querySelector('.waypoint-text');
        destText.textContent = `🚪 ${rm.number} (${hostBuilding})`;
        destText.classList.remove('placeholder');

        findRouteBtn.click();
    }

    function resolveHostBuildingName(bldgRaw) {
        const clean = bldgRaw.trim().toLowerCase();
        const found = Object.keys(buildings).find(k => k.toLowerCase() === clean || clean.includes(k.toLowerCase()) || k.toLowerCase().includes(clean));
        return found || bldgRaw;
    }

    if (startDisplay) startDisplay.parentElement.addEventListener('click', () => openLocationPicker('start', 'Choose Starting Point'));
    if (destinationDisplay) destinationDisplay.parentElement.addEventListener('click', () => openLocationPicker('destination', 'Choose Destination'));
    if (pickerFilterInput) pickerFilterInput.addEventListener('input', (e) => renderPickerList(e.target.value));
    if (closePickerBtn) closePickerBtn.addEventListener('click', closeLocationPicker);
    if (pickerBackdrop) pickerBackdrop.addEventListener('click', closeLocationPicker);

    if (addStopBtn) {
        addStopBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const stopIndex = selectedWaypoints.extraStops.length;
            selectedWaypoints.extraStops.push(null);

            const div = document.createElement('div');
            div.className = 'input-group waypoint-card stop-row';
            div.innerHTML = `
                <div class="point-badge" style="background:#8b5cf6;">${String.fromCharCode(67 + stopIndex)}</div>
                <div class="waypoint-display">
                    <span class="waypoint-text placeholder">Next Stop ${stopIndex + 1}</span>
                    <i class="fa-solid fa-chevron-down waypoint-arrow"></i>
                </div>
                <button type="button" class="btn-remove-stop" title="Remove stop">✕</button>
            `;

            waypointsContainer.appendChild(div);

            div.querySelector('.waypoint-display').addEventListener('click', () => {
                openLocationPicker(stopIndex, `Choose Stop ${stopIndex + 1}`);
            });

            div.querySelector('.btn-remove-stop').addEventListener('click', (ev) => {
                ev.stopPropagation();
                div.remove();
                selectedWaypoints.extraStops.splice(stopIndex, 1);
            });
        });
    }

    // ================= 12. MOBILE BOTTOM DRAWER & PEEK ENGINE =================
    let isDraggingHandle = false;
    let startTouchY = 0;
    let currentPanelState = 1;
    const dragArea = document.getElementById('panel-handle-area') || togglePanelBtn;

    function applySheetSnap(stateIndex) {
        if (window.innerWidth > 640 || !navPanel) return;
        currentPanelState = stateIndex;
        navPanel.style.transition = 'transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)';

        const panelHeight = navPanel.offsetHeight;
        if (stateIndex === 0) {
            navPanel.style.transform = 'translateY(0px)';
        } else {
            const peekVisibleHeight = 130;
            const peekOffset = Math.max(0, panelHeight - peekVisibleHeight);
            navPanel.style.transform = `translateY(${peekOffset}px)`;
        }
    }

    if (dragArea && navPanel) {
        dragArea.addEventListener('touchstart', (e) => {
            if (window.innerWidth > 640) return;
            isDraggingHandle = true;
            startTouchY = e.touches[0].clientY;
            navPanel.style.transition = 'none';
        }, { passive: true });

        dragArea.addEventListener('touchmove', (e) => {
            if (!isDraggingHandle) return;
            const deltaY = e.touches[0].clientY - startTouchY;
            const panelHeight = navPanel.offsetHeight;
            const peekOffset = Math.max(0, panelHeight - 130);

            let baseOffset = currentPanelState === 1 ? peekOffset : 0;
            let targetOffset = baseOffset + deltaY;
            if (targetOffset < 0) targetOffset = 0;
            if (targetOffset > peekOffset) targetOffset = peekOffset;

            navPanel.style.transform = `translateY(${targetOffset}px)`;
        }, { passive: true });

        dragArea.addEventListener('touchend', (e) => {
            if (!isDraggingHandle) return;
            isDraggingHandle = false;
            const endTouchY = e.changedTouches[0].clientY;
            const distanceMoved = endTouchY - startTouchY;

            if (distanceMoved > 35) applySheetSnap(1);
            else if (distanceMoved < -35) applySheetSnap(0);
            else applySheetSnap(currentPanelState);
        });
    }

    if (togglePanelBtn) {
        togglePanelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.innerWidth > 640) return;
            applySheetSnap(currentPanelState === 0 ? 1 : 0);
        });
    }

    // ================= 13. DATA INITIALIZER & INTERACTIVE POPUPS =================
    function createBuildingInteractivePopup(name, category) {
        const isNotBuilding = ["court", "ground", "parking", "bus-stop", "pool", "temple", "garden"].some(k => name.toLowerCase().includes(k));
        
        let html = `
            <div style="font-family:'Inter',sans-serif; min-width:200px; padding:4px;">
                <div style="font-weight:800; font-size:14px; color:#0f172a;">${name}</div>
                <div style="font-size:11px; color:#64748b; margin-bottom:8px;">${category || "Campus Location"}</div>
                
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <button type="button" class="btn-popup-route" style="background:#2563eb; color:#fff; padding:6px 10px; border-radius:6px; font-weight:700; font-size:11.5px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                        🎯 Set as Destination
                    </button>
                    ${!isNotBuilding ? `
                        <a href="building.html?name=${encodeURIComponent(name)}" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1; padding:6px 10px; border-radius:6px; font-weight:700; font-size:11px; text-decoration:none; text-align:center; display:flex; align-items:center; justify-content:center; gap:6px;">
                            🏢 View Inside Floor Layout &rarr;
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
        return html;
    }

    function processGeoJSONData(data) {
        campusGeoJSON = data;
        buildings = {};
        markerLayers = {};
        placeMetadata = {};
        placeNamesSorted = [];

        L.geoJSON(data, {
            style: (feature) => {
                if (feature.geometry.type === 'LineString') {
                    return { color: '#f8fafc', weight: 3.5, opacity: 0.85, dashArray: '5, 5', className: 'campus-walkway-base' };
                }
                return { color: '#3b82f6', weight: 2 };
            },
            pointToLayer: (feature, latlng) => {
                const name = feature.properties?.name?.trim() || '';
                const rawCat = feature.properties?.category || '';
                const icon = getPlaceIcon(name, rawCat);

                let dotColor = '#2563eb';
                if (icon === '🚻') dotColor = '#8b5cf6';
                else if (icon === '🏥') dotColor = '#ef4444';
                else if (icon === '🛡️') dotColor = '#f59e0b';
                else if (icon === '🏊‍♂️' || icon === '⚽') dotColor = '#10b981';

                return L.circleMarker(latlng, { radius: 6, fillColor: '#ffffff', color: dotColor, weight: 3, opacity: 1, fillOpacity: 1 });
            },
            onEachFeature: (feature, layer) => {
                const name = feature.properties?.name?.trim();
                const rawCat = feature.properties?.category || '';
                if (feature.geometry.type === 'Point' && name) {
                    markerLayers[name] = layer;
                    buildings[name] = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
                    placeMetadata[name] = { category: getCategoryClassification(name, rawCat) };
                    placeNamesSorted.push(name);

                    const icon = getPlaceIcon(name, rawCat);
                    layer.bindTooltip(`<span>${icon}</span> <span>${name}</span>`, {
                        permanent: true,
                        direction: 'top',
                        offset: [0, -6],
                        className: 'satellite-label'
                    });

                    const popupHtml = createBuildingInteractivePopup(name, rawCat);
                    layer.bindPopup(popupHtml);

                    layer.on('popupopen', (e) => {
                        const popupEl = e.popup.getElement();
                        const routeBtn = popupEl.querySelector('.btn-popup-route');
                        if (routeBtn) {
                            routeBtn.onclick = () => {
                                map.closePopup();
                                activeIndoorDestination = null;
                                selectedWaypoints.destination = { id: name, name: name };
                                const destText = destinationDisplay.querySelector('.waypoint-text');
                                destText.textContent = `${icon} ${name}`;
                                destText.classList.remove('placeholder');
                                findRouteBtn.click();
                            };
                        }
                    });
                }
            }
        }).addTo(map);

        placeNamesSorted.sort();
        buildClientGraph(data);
        applyCategoryAndZoomFilter();
        clearTimeout(safetyTimer);
        hideLoader();

        fetchIndoorRoomsDatabase();

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => updateUserLiveLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
                () => console.warn("GPS permission pending")
            );
        }
    }

    async function fetchIndoorRoomsDatabase() {
        try {
            const bRes = await fetch(`${API_URL}/api/admin/buildings-list`);
            const bldgs = await bRes.json();
            allIndoorRooms = [];

            for (const bldg of bldgs) {
                const fRes = await fetch(`${API_URL}/api/buildings/${encodeURIComponent(bldg)}/floors`);
                const floors = await fRes.json();
                floors.forEach(f => {
                    (f.rooms || []).forEach(r => {
                        allIndoorRooms.push({
                            number: r.number,
                            name: r.name,
                            type: r.type,
                            building: f.building_name,
                            floor_number: f.floor_number
                        });
                    });
                });
            }
        } catch (e) {
            allIndoorRooms = [
                { number: "CSA-4", name: "CSA 4 Classroom", type: "Classroom", building: "CSA block", floor_number: 3 },
                { number: "CSA-3", name: "CSA 3 Classroom", type: "Classroom", building: "CSA block", floor_number: 3 },
                { number: "CSA-2", name: "CSA 2 Classroom", type: "Classroom", building: "CSA block", floor_number: 3 },
                { number: "CSA-1", name: "CSA 1 Classroom", type: "Classroom", building: "CSA block", floor_number: 3 },
                { number: "BEE-LAB", name: "BEE LAB", type: "Laboratory", building: "CSA block", floor_number: 3 },
                { number: "BE-LAB", name: "BE LAB", type: "Laboratory", building: "CSA block", floor_number: 3 },
                { number: "MPMC-LAB", name: "MPMC LAB", type: "Laboratory", building: "CSA block", floor_number: 3 },
                { number: "FC-2", name: "FC-2 Exam Cell", type: "Office", building: "CSA block", floor_number: 3 }
            ];
        }
    }

    fetch('assets/data/giet_campus.geojson')
        .then(res => {
            if (!res.ok) throw new Error("Local bundle not available");
            return res.json();
        })
        .then(data => {
            processGeoJSONData(data);
            hideLoader();
            fetch(`${API_URL}/api/campus-data`, { signal: AbortSignal.timeout(5000) })
                .catch(() => console.log("Running on local dataset."));
        })
        .catch(err => {
            fetch(`${API_URL}/api/campus-data`)
                .then(res => res.json())
                .then(data => processGeoJSONData(data.geojson))
                .catch(apiErr => console.error("Error loading map data", apiErr))
                .finally(() => {
                    clearTimeout(safetyTimer);
                    hideLoader();
                });
        });

    // ================= 14. ROUTE TRIGGER =================
    if (findRouteBtn) {
        findRouteBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            if (!selectedWaypoints.destination) {
                alert("Please select a Destination point.");
                return;
            }

            const coordsArray = [];
            if (selectedWaypoints.start.id === "LIVE_LOCATION") {
                if (!currentUserLat || !currentUserLng) {
                    alert("Acquiring GPS location... Please ensure location permissions are enabled.");
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                            pos => {
                                updateUserLiveLocation(pos.coords.latitude, pos.coords.longitude);
                                findRouteBtn.click();
                            },
                            err => alert("Unable to get GPS location: " + err.message)
                        );
                    }
                    return;
                }
                coordsArray.push([currentUserLat, currentUserLng]);
            } else if (buildings[selectedWaypoints.start.id]) {
                coordsArray.push(buildings[selectedWaypoints.start.id]);
            }

            selectedWaypoints.extraStops.forEach(st => {
                if (st && buildings[st.id]) coordsArray.push(buildings[st.id]);
            });

            if (buildings[selectedWaypoints.destination.id]) {
                coordsArray.push(buildings[selectedWaypoints.destination.id]);
            }

            if (coordsArray.length < 2) {
                alert("Please verify your starting and destination points.");
                return;
            }

            const routes = computeClientSideRoutes(coordsArray);
            if (!routes || routes.length === 0) {
                alert("No route connected between the selected locations.");
                return;
            }

            renderRoutes(routes);

            if (window.innerWidth <= 640) {
                applySheetSnap(1);
            }
        });
    }

    // ================= 15. LIVE GPS WATCH & SIMULATION =================
    if (startNavBtn) {
        startNavBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert("Geolocation not supported by this browser.");
                return;
            }

            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
                isTrackingOrSimulating = false;
                startNavBtn.innerHTML = `<i class="fa-solid fa-location-arrow"></i> <span>Live GPS</span>`;
                startNavBtn.classList.remove('btn-danger');
                turnHud.classList.add('hidden');
                speakVoicePrompt("Navigation stopped.");
                return;
            }

            isTrackingOrSimulating = true;
            startNavBtn.innerHTML = `<i class="fa-solid fa-stop"></i> <span>Stop GPS</span>`;
            startNavBtn.classList.add('btn-danger');

            if (window.innerWidth <= 640) applySheetSnap(1);
            speakVoicePrompt("Starting GPS live navigation.");

            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    updateUserLiveLocation(lat, lng, pos.coords.accuracy);
                    map.panTo([lat, lng], { animate: true, duration: 0.5 });
                },
                (err) => alert("GPS Error: " + err.message),
                { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
            );
        });
    }

    function generateUniformAnimationPoints(coords, meterSpacing = 1.0) {
        const points = [];
        if (!coords || coords.length < 2) return points;

        for (let i = 0; i < coords.length - 1; i++) {
            const p1 = coords[i];
            const p2 = coords[i + 1];
            const segDist = getDistance(p1[0], p1[1], p2[0], p2[1]);
            const steps = Math.max(1, Math.round(segDist / meterSpacing));

            for (let s = 0; s < steps; s++) {
                const fraction = s / steps;
                const lat = p1[0] + (p2[0] - p1[0]) * fraction;
                const lng = p1[1] + (p2[1] - p1[1]) * fraction;
                points.push([lat, lng]);
            }
        }
        points.push(coords[coords.length - 1]);
        return points;
    }

    function runSimulationLoop(animationPoints, startIndex = 0) {
        if (simulationInterval) clearInterval(simulationInterval);

        const frameIntervalMs = Math.round(100 / simSpeedMultiplier);
        let stepIndex = startIndex;

        simulationInterval = setInterval(() => {
            if (stepIndex >= animationPoints.length) {
                clearInterval(simulationInterval);
                simulationInterval = null;
                isTrackingOrSimulating = false;
                simulateBtn.innerHTML = `<i class="fa-solid fa-play"></i> <span>Simulate</span>`;
                
                speakVoicePrompt("You have arrived at your destination!");
                if (activeIndoorDestination) {
                    showArrivalTransitionModal();
                } else {
                    alert("You have arrived at your destination!");
                }
                return;
            }

            const [lat, lng] = animationPoints[stepIndex];
            updateUserLiveLocation(lat, lng, 3);
            map.panTo([lat, lng], { animate: true, duration: frameIntervalMs / 1000 });
            stepIndex++;
            simulateBtn.setAttribute('data-current-idx', stepIndex);
        }, frameIntervalMs);
    }

    if (simulateBtn) {
        simulateBtn.addEventListener('click', () => {
            if (!fullRouteCoords || fullRouteCoords.length < 2) {
                alert("Find a route first to simulate walking.");
                return;
            }

            if (simulationInterval) {
                clearInterval(simulationInterval);
                simulationInterval = null;
                isTrackingOrSimulating = false;
                simulateBtn.innerHTML = `<i class="fa-solid fa-play"></i> <span>Simulate</span>`;
                speakVoicePrompt("Simulation paused.");
                return;
            }

            isTrackingOrSimulating = true;
            simulateBtn.innerHTML = `<i class="fa-solid fa-pause"></i> <span>Pause</span>`;

            if (window.innerWidth <= 640) applySheetSnap(1);
            speakVoicePrompt("Simulating walk.");

            const animationPoints = generateUniformAnimationPoints(fullRouteCoords, 1.0);
            window._simPointsCache = animationPoints;

            const savedIdx = parseInt(simulateBtn.getAttribute('data-current-idx') || '0', 10);
            const startAt = savedIdx >= animationPoints.length ? 0 : savedIdx;
            runSimulationLoop(animationPoints, startAt);
        });
    }

    if (speedToggleBtn) {
        speedToggleBtn.addEventListener('click', () => {
            speedOptionIdx = (speedOptionIdx + 1) % SPEED_OPTIONS.length;
            simSpeedMultiplier = SPEED_OPTIONS[speedOptionIdx];
            speedToggleBtn.textContent = `${simSpeedMultiplier}x`;

            if (simulationInterval && window._simPointsCache) {
                const currentIdx = parseInt(simulateBtn.getAttribute('data-current-idx') || '0', 10);
                runSimulationLoop(window._simPointsCache, currentIdx);
            }
        });
    }

    if (clearRouteBtn) {
        clearRouteBtn.addEventListener('click', () => {
            isTrackingOrSimulating = false;
            window.speechSynthesis.cancel();
            spokenMilestones.clear();

            if (remainingRoutePolyline) map.removeLayer(remainingRoutePolyline);
            if (breadcrumbPolyline) map.removeLayer(breadcrumbPolyline);
            alternativePolylines.forEach(p => map.removeLayer(p));
            alternativePolylines = [];
            remainingRoutePolyline = null;
            breadcrumbPolyline = null;
            fullRouteCoords = [];

            const arrivalModal = document.getElementById('arrival-popup-overlay');
            if (arrivalModal) arrivalModal.remove();

            if (simulationInterval) {
                clearInterval(simulationInterval);
                simulationInterval = null;
                simulateBtn.innerHTML = `<i class="fa-solid fa-play"></i> <span>Simulate</span>`;
                simulateBtn.removeAttribute('data-current-idx');
            }
            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
                startNavBtn.innerHTML = `<i class="fa-solid fa-location-arrow"></i> <span>Live GPS</span>`;
                startNavBtn.classList.remove('btn-danger');
            }

            const extraRows = waypointsContainer.querySelectorAll('.stop-row');
            extraRows.forEach(row => row.remove());
            selectedWaypoints.extraStops = [];

            selectedWaypoints.destination = null;
            activeIndoorDestination = null;

            const destText = destinationDisplay.querySelector('.waypoint-text');
            destText.textContent = "Choose Destination";
            destText.classList.add('placeholder');

            turnHud.classList.add('hidden');
            turnStepsContainer.classList.add('hidden');
            routeOutput.classList.add('hidden');
            routeOptionsContainer.classList.add('hidden');
            map.setView(GIET_CENTER, 18);

            if (window.innerWidth <= 640) applySheetSnap(1);
        });
    }

    if (exitHudBtn) {
        exitHudBtn.addEventListener('click', () => {
            turnHud.classList.add('hidden');
            window.speechSynthesis.cancel();
        });
    }

    // ================= 16. LIVE SEARCH =================
    if (buildingSearch && searchResults) {
        buildingSearch.addEventListener('input', () => {
            const query = buildingSearch.value.trim().toLowerCase();
            searchResults.innerHTML = '';

            if (searchClearBtn) searchClearBtn.classList.toggle('hidden', query.length === 0);
            if (!query) {
                searchResults.classList.add('hidden');
                return;
            }

            const matchedRooms = allIndoorRooms.filter(r => r.number.toLowerCase().includes(query) || r.name.toLowerCase().includes(query) || r.building.toLowerCase().includes(query));
            matchedRooms.slice(0, 6).forEach(rm => {
                const item = document.createElement('div');
                item.className = 'search-item';
                const isDuplicate = rm.name.trim().toLowerCase() === rm.number.trim().toLowerCase();
                const displayTitle = isDuplicate ? rm.number : `${rm.number}: ${rm.name}`;

                item.innerHTML = `
                    <span style="font-size:18px;">🚪</span> 
                    <div>
                        <strong>${displayTitle}</strong><br>
                        <small style="color:#64748b;">${rm.building} &bull; Floor ${rm.floor_number}</small>
                    </div>
                `;

                item.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    buildingSearch.value = `${rm.number} (${rm.building})`;
                    searchResults.classList.add('hidden');
                    handleSelectDestinationRoom(rm);
                });
                searchResults.appendChild(item);
            });

            const matchedPlaces = placeNamesSorted.filter(p => p.toLowerCase().includes(query));
            matchedPlaces.slice(0, 6).forEach(place => {
                const icon = getPlaceIcon(place);
                const item = document.createElement('div');
                item.className = 'search-item';
                item.innerHTML = `<span style="font-size:18px;">${icon}</span> <strong>${place}</strong>`;

                item.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    buildingSearch.value = place;
                    searchResults.classList.add('hidden');

                    activeIndoorDestination = null;
                    selectedWaypoints.destination = { id: place, name: place };
                    const destText = destinationDisplay.querySelector('.waypoint-text');
                    destText.textContent = `${icon} ${place}`;
                    destText.classList.remove('placeholder');

                    const coords = buildings[place];
                    if (coords) {
                        map.flyTo(coords, 19, { duration: 1.0 });
                        if (markerLayers[place]) markerLayers[place].openTooltip();
                    }

                    if (window.innerWidth <= 640) applySheetSnap(1);
                });

                searchResults.appendChild(item);
            });

            searchResults.classList.remove('hidden');
        });

        if (searchClearBtn) {
            searchClearBtn.addEventListener('click', () => {
                buildingSearch.value = '';
                searchResults.classList.add('hidden');
                searchClearBtn.classList.add('hidden');
            });
        }

        document.addEventListener('click', (e) => {
            if (!buildingSearch.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.add('hidden');
            }
        });
    }

    if (window.innerWidth <= 640) {
        setTimeout(() => applySheetSnap(1), 350);
    }
});