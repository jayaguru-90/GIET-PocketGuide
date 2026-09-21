// Navigation.js (FastAPI + Client-Side Dijkstra Fallback for Standalone Vercel Support)
document.addEventListener('DOMContentLoaded', () => {
    const API_URL = "http://127.0.0.1:8000";

    // ================= 1. DOM REFERENCES & STATE =================
    const waypointsContainer = document.getElementById('waypoints-container');
    const addStopBtn = document.getElementById('add-stop-btn');
    const findRouteBtn = document.getElementById('find-route-btn');
    const clearRouteBtn = document.getElementById('clear-route-btn');
    const startNavBtn = document.getElementById('start-nav-btn');
    const simulateBtn = document.getElementById('simulate-btn');
    const routeOutput = document.getElementById('route-output');
    const routeOptionsContainer = document.getElementById('route-options-container');
    const routeCardsList = document.getElementById('route-cards-list');
    const buildingSearch = document.getElementById('building-search');
    const searchResults = document.getElementById('search-results');
    const loadingScreen = document.getElementById('loading-screen');
    const navPanel = document.getElementById('nav-panel');
    const togglePanelBtn = document.getElementById('toggle-panel-btn');

    const GIET_CENTER = [19.0485, 83.8320];
    const ROUTE_PALETTE = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];

    let buildings = {};
    let markerLayers = {};
    let placeNamesSorted = [];
    let calculatedRoutes = [];
    let renderedPolylines = [];
    let activeRouteIndex = 0;
    let currentRouteCoords = [];

    // Client-side graph store for standalone Dijkstra
    let clientGraph = {};
    let clientNodes = [];
    let clientSegments = [];
    let rawGeoJSON = null;

    let userMarker = null;
    let userAccuracyCircle = null;
    let watchId = null;
    let simulationInterval = null;

    function hideLoader() {
        if (!loadingScreen) return;
        loadingScreen.classList.add('hidden');
        loadingScreen.style.display = 'none';
        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 200);
    }

    const safetyTimer = setTimeout(hideLoader, 3000);

    // ================= 2. LEAFLET MAP =================
    const map = L.map('map', {
        zoomControl: false,
        maxZoom: 22,
        tap: false
    }).setView(GIET_CENTER, 18);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 22,
        maxNativeZoom: 20,
        attribution: '&copy; Google Maps'
    }).addTo(map);

    // ================= 3. UTILITIES & GEOMETRY =================
    function getPlaceIcon(name) {
        const n = name.toLowerCase();
        if (n.includes('gate')) return '🚪';
        if (n.includes('temple')) return '🛕';
        if (n.includes('library')) return '📚';
        if (n.includes('canteen') || n.includes('parlour') || n.includes('parloor')) return '☕';
        if (n.includes('bus')) return '🚌';
        if (n.includes('parking')) return '🅿️';
        if (n.includes('school')) return '🏫';
        if (n.includes('court') || n.includes('ground') || n.includes('pool')) return '⚽';
        return '🏛️';
    }

    function populateSelectElement(selectElem, placeholder = "Choose Location") {
        selectElem.innerHTML = `<option value="">${placeholder}</option>`;
        placeNamesSorted.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            selectElem.appendChild(opt);
        });
    }

    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function toKey(lat, lng) {
        return `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
    }

    function parseKey(key) {
        return key.split(',').map(Number);
    }

    function projectPointOnSegment(p, a, b) {
        const x = p[1], y = p[0];
        const x1 = a[1], y1 = a[0];
        const x2 = b[1], y2 = b[0];
        const dx = x2 - x1, dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return a;
        const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
        return [y1 + t * dy, x1 + t * dx];
    }

    // ================= 4. BUILD CLIENT GRAPH (OFFLINE ROUTING) =================
    function buildClientGraph(geojson) {
        clientGraph = {};
        clientNodes = [];
        clientSegments = [];
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
            if (!clientGraph[uKey].some(e => e.node === vKey)) {
                clientGraph[uKey].push({ node: vKey, weight: d, coord: vCoord });
            }
            if (!clientGraph[vKey].some(e => e.node === uKey)) {
                clientGraph[vKey].push({ node: uKey, weight: d, coord: uCoord });
            }
        }

        (geojson.features || []).forEach(feat => {
            const geom = feat.geometry || {};
            if (geom.type === 'LineString') {
                const coords = geom.coordinates || [];
                for (let i = 0; i < coords.length - 1; i++) {
                    const u = [coords[i][1], coords[i][0]];
                    const v = [coords[i + 1][1], coords[i + 1][0]];
                    addEdge(toKey(u[0], u[1]), toKey(v[0], v[1]), u, v);
                    clientSegments.push({ u, v });
                }
            }
        });

        // Bridge gaps within 8 meters
        for (let i = 0; i < clientNodes.length; i++) {
            const p1 = parseKey(clientNodes[i]);
            for (let j = i + 1; j < clientNodes.length; j++) {
                const p2 = parseKey(clientNodes[j]);
                if (getDistance(p1[0], p1[1], p2[0], p2[1]) <= 8.0) {
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

        for (let i = 0; i < clientSegments.length; i++) {
            const seg = clientSegments[i];
            const proj = projectPointOnSegment([lat, lng], seg.u, seg.v);
            const d = getDistance(lat, lng, proj[0], proj[1]);
            if (d < minD) {
                minD = d;
                bestKey = toKey(proj[0], proj[1]);
                const uKey = toKey(seg.u[0], seg.u[1]);
                const vKey = toKey(seg.v[0], seg.v[1]);
                if (!clientGraph[bestKey]) clientGraph[bestKey] = [];
                clientGraph[bestKey].push({ node: uKey, weight: getDistance(proj[0], proj[1], seg.u[0], seg.u[1]), coord: seg.u });
                clientGraph[bestKey].push({ node: vKey, weight: getDistance(proj[0], proj[1], seg.v[0], seg.v[1]), coord: seg.v });
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

            if (node === endKey) {
                return { path: currentPath, cost };
            }

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

    function computeClientSideRoutes(waypoints) {
        const coords = waypoints.map(w => buildings[w]);
        const routes = [];
        const penalized = {};
        const isMulti = waypoints.length > 2;

        for (let iter = 0; iter < 5; iter++) {
            let fullCoords = [];
            let allNodePath = [];
            let failed = false;

            for (let leg = 0; leg < coords.length - 1; leg++) {
                const p1 = coords[leg];
                const p2 = coords[leg + 1];
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
                if (routes.length >= (isMulti ? 2 : 3)) break;
            }

            if (allNodePath.length > 3) {
                const midStart = Math.max(1, Math.floor(allNodePath.length * 0.2));
                const midEnd = Math.min(allNodePath.length - 1, Math.floor(allNodePath.length * 0.8));
                for (let i = midStart; i < midEnd; i++) {
                    const k = `${allNodePath[i]}|${allNodePath[i + 1]}`;
                    penalized[k] = (penalized[k] || 1.0) * 2.2;
                }
            }
        }

        routes.sort((a, b) => a.totalDistance - b.totalDistance);

        const names = [
            "Shortest Route (Via Walkway / Shortcut)",
            "Alternative 1 (Via Swimming Pool Road)",
            "Alternative 2 (Via Campus Road / Garden)"
        ];

        return routes.map((r, idx) => ({
            name: isMulti ? (idx === 0 ? "Shortest Multi-Stop Route" : `Multi-Stop Route ${idx + 1}`) : (names[idx] || `Alternative ${idx}`),
            path: r.path,
            totalDistance: r.totalDistance
        }));
    }

    // ================= 5. LOAD CAMPUS DATA (HYBRID ENGINE) =================
    function processGeoJSONData(data) {
        rawGeoJSON = data;
        buildings = {};
        placeNamesSorted = [];

        L.geoJSON(data, {
            style: (feature) => {
                if (feature.geometry.type === 'LineString') {
                    return {
                        color: '#f8fafc',
                        weight: 3.5,
                        opacity: 0.85,
                        dashArray: '5, 5',
                        className: 'campus-walkway-base'
                    };
                }
                return { color: '#3b82f6', weight: 2 };
            },
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, {
                    radius: 5,
                    fillColor: '#ffffff',
                    color: '#2563eb',
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 1
                });
            },
            onEachFeature: (feature, layer) => {
                const name = feature.properties?.name?.trim();
                if (feature.geometry.type === 'Point' && name) {
                    markerLayers[name] = layer;
                    buildings[name] = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
                    placeNamesSorted.push(name);

                    const icon = getPlaceIcon(name);
                    layer.bindTooltip(`<span>${icon}</span> <span>${name}</span>`, {
                        permanent: true,
                        direction: 'top',
                        offset: [0, -6],
                        className: 'satellite-label'
                    });
                }
            }
        }).addTo(map);

        placeNamesSorted.sort();

        // Build client-side graph for instant offline pathfinding
        buildClientGraph(data);

        const selects = waypointsContainer.querySelectorAll('.location-select');
        if (selects[0]) populateSelectElement(selects[0], "Choose Starting Point");
        if (selects[1]) populateSelectElement(selects[1], "Choose Destination");

        clearTimeout(safetyTimer);
        hideLoader();
    }

    // Try FastAPI first, fall back directly to static file for Vercel
    fetch(`${API_URL}/api/campus-data`)
        .then(res => {
            if (!res.ok) throw new Error("Backend offline");
            return res.json();
        })
        .then(data => processGeoJSONData(data.geojson))
        .catch(() => {
            fetch('assets/data/giet_campus.geojson')
                .then(res => res.json())
                .then(data => processGeoJSONData(data))
                .catch(err => {
                    console.error("Critical error loading GeoJSON:", err);
                    clearTimeout(safetyTimer);
                    hideLoader();
                });
        });

    // ================= 6. LIVE SEARCH =================
    if (buildingSearch && searchResults) {
        buildingSearch.addEventListener('input', () => {
            const query = buildingSearch.value.trim().toLowerCase();
            searchResults.innerHTML = '';

            if (!query) {
                searchResults.style.display = 'none';
                return;
            }

            const matchedPlaces = placeNamesSorted.filter(p => p.toLowerCase().includes(query));
            if (matchedPlaces.length === 0) {
                searchResults.style.display = 'none';
                return;
            }

            matchedPlaces.slice(0, 8).forEach(place => {
                const item = document.createElement('div');
                item.className = 'search-item';
                item.innerHTML = `${getPlaceIcon(place)} <strong>${place}</strong>`;

                item.addEventListener('click', () => {
                    buildingSearch.value = place;
                    searchResults.style.display = 'none';

                    const selects = waypointsContainer.querySelectorAll('.location-select');
                    if (selects.length > 1) {
                        selects[selects.length - 1].value = place;
                    }

                    const coords = buildings[place];
                    if (coords) {
                        map.flyTo(coords, 20, { duration: 1.2 });
                        if (markerLayers[place]) markerLayers[place].openTooltip();
                    }
                });
                searchResults.appendChild(item);
            });
            searchResults.style.display = 'block';
        });

        document.addEventListener('click', (e) => {
            if (!buildingSearch.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });
    }

    // ================= 7. NEXT DESTINATION MANAGER =================
    function updateDestinationLabels() {
        const selects = waypointsContainer.querySelectorAll('.stop-row .location-select');
        selects.forEach((sel, idx) => {
            const destNum = idx + 2;
            const currentVal = sel.value;
            populateSelectElement(sel, `Next Destination ${destNum}`);
            sel.value = currentVal;
        });
    }

    if (addStopBtn) {
        addStopBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const existingExtraStops = waypointsContainer.querySelectorAll('.stop-row').length;
            const destNumber = existingExtraStops + 2;

            const div = document.createElement('div');
            div.className = 'input-group stop-row';

            div.innerHTML = `
                <select class="location-select" style="flex: 1;"></select>
                <button type="button" class="btn-remove-stop" title="Remove stop">✕</button>
            `;

            waypointsContainer.appendChild(div);
            populateSelectElement(div.querySelector('select'), `Next Destination ${destNumber}`);

            div.querySelector('.btn-remove-stop').addEventListener('click', () => {
                div.remove();
                updateDestinationLabels();
                calculateLimits();
            });

            const panelBody = document.querySelector('.panel-body');
            if (panelBody) panelBody.scrollTop = panelBody.scrollHeight;
            calculateLimits();
        });
    }

    // ================= 8. ROUTE RENDERING & SWITCHING =================
    function selectActiveRoute(index) {
        activeRouteIndex = index;
        const selectedRoute = calculatedRoutes[index];
        currentRouteCoords = selectedRoute.path;

        renderedPolylines.forEach((polyGroup, idx) => {
            const isSelected = idx === index;
            const visibleLine = polyGroup.visibleLine;

            if (isSelected) {
                visibleLine.setStyle({
                    color: polyGroup.color,
                    weight: 8,
                    opacity: 1.0,
                    dashArray: null
                });
                visibleLine.bringToFront();
            } else {
                visibleLine.setStyle({
                    color: polyGroup.color,
                    weight: 5,
                    opacity: 0.75,
                    dashArray: '8, 8'
                });
            }
        });

        const cards = routeCardsList.children;
        for (let i = 0; i < cards.length; i++) {
            cards[i].classList.toggle('active', i === index);
        }

        if (routeOutput) {
            routeOutput.style.display = 'block';
            routeOutput.innerHTML = `
                <div style="font-size: 13px;">
                    <strong style="color: ${ROUTE_PALETTE[index] || '#2563eb'}">${selectedRoute.name}</strong><br>
                    Walking Distance: <strong>${selectedRoute.totalDistance} meters</strong><br>
                    Estimated Time: ~${Math.ceil(selectedRoute.totalDistance / 75)} mins
                </div>
            `;
        }

        updateUserPosition(currentRouteCoords[0][0], currentRouteCoords[0][1], 8);
    }

    function renderRoutes(routes) {
        renderedPolylines.forEach(group => {
            if (group && group.visibleLine) map.removeLayer(group.visibleLine);
            if (group && group.hitArea) map.removeLayer(group.hitArea);
        });
        renderedPolylines = [];
        routeCardsList.innerHTML = '';

        for (let idx = routes.length - 1; idx >= 0; idx--) {
            const route = routes[idx];
            const isShortest = idx === 0;
            const routeColor = ROUTE_PALETTE[idx] || '#64748b';

            const visibleLine = L.polyline(route.path, {
                color: routeColor,
                weight: isShortest ? 8 : 5,
                opacity: isShortest ? 1.0 : 0.75,
                dashArray: isShortest ? null : '8, 8',
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(map);

            const hitArea = L.polyline(route.path, {
                color: 'transparent',
                weight: 24,
                opacity: 0
            }).addTo(map);

            hitArea.on('click', () => selectActiveRoute(idx));
            visibleLine.on('click', () => selectActiveRoute(idx));

            renderedPolylines[idx] = { visibleLine, hitArea, color: routeColor };
        }

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
                <div class="route-card-sub" style="margin-left: 16px;">${route.totalDistance} meters • Road verified</div>
            `;
            card.addEventListener('click', () => selectActiveRoute(idx));
            routeCardsList.appendChild(card);
        });

        routeOptionsContainer.style.display = 'block';
        selectActiveRoute(0);

        if (renderedPolylines[0]) {
            map.fitBounds(renderedPolylines[0].visibleLine.getBounds(), { padding: [60, 60] });
        }
        calculateLimits();
    }

    function updateUserPosition(lat, lng, accuracy = 5) {
        if (!userMarker) {
            userMarker = L.circleMarker([lat, lng], {
                radius: 8,
                fillColor: '#facc15',
                color: '#ffffff',
                weight: 3,
                opacity: 1,
                fillOpacity: 1
            }).addTo(map);

            userAccuracyCircle = L.circle([lat, lng], {
                radius: accuracy,
                color: '#facc15',
                fillColor: '#fde047',
                fillOpacity: 0.2,
                weight: 1
            }).addTo(map);
        } else {
            userMarker.setLatLng([lat, lng]);
            userAccuracyCircle.setLatLng([lat, lng]);
            userAccuracyCircle.setRadius(accuracy);
        }
    }

    // ================= 9. ROUTE COMPUTATION (HYBRID FASTAPI + LOCAL) =================
    if (findRouteBtn) {
        findRouteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const selects = Array.from(waypointsContainer.querySelectorAll('.location-select'));
            const selectedPoints = selects.map(s => s.value).filter(val => val !== '');

            if (selectedPoints.length < 2) {
                alert("Please select at least a Starting Point and Destination.");
                return;
            }

            try {
                // 1. Try FastAPI backend
                const res = await fetch(`${API_URL}/api/routes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ waypoints: selectedPoints })
                });

                if (!res.ok) throw new Error("Backend response error");
                const data = await res.json();
                calculatedRoutes = data.routes;
            } catch {
                // 2. Fall back to local client-side Dijkstra calculation immediately
                calculatedRoutes = computeClientSideRoutes(selectedPoints);
            }

            if (!calculatedRoutes || calculatedRoutes.length === 0) {
                alert("No route found between selected points.");
                return;
            }

            renderRoutes(calculatedRoutes);

            if (window.innerWidth <= 640 && navPanel) {
                setTimeout(snapToCollapsed, 300);
            }
        });
    }

    if (clearRouteBtn) {
        clearRouteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            renderedPolylines.forEach(group => {
                if (group && group.visibleLine) map.removeLayer(group.visibleLine);
                if (group && group.hitArea) map.removeLayer(group.hitArea);
            });
            renderedPolylines = [];
            calculatedRoutes = [];
            currentRouteCoords = [];

            if (simulationInterval) {
                clearInterval(simulationInterval);
                simulationInterval = null;
                if (simulateBtn) simulateBtn.textContent = "▶️ Simulate Walk";
            }
            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
                if (startNavBtn) startNavBtn.textContent = "🚶 GPS Live";
            }
            if (userMarker) {
                map.removeLayer(userMarker);
                map.removeLayer(userAccuracyCircle);
                userMarker = null;
                userAccuracyCircle = null;
            }

            if (buildingSearch) buildingSearch.value = '';
            if (searchResults) searchResults.style.display = 'none';

            const selects = waypointsContainer.querySelectorAll('.location-select');
            selects.forEach(s => s.value = '');

            const extraRows = waypointsContainer.querySelectorAll('.stop-row');
            extraRows.forEach(row => row.remove());

            if (routeOutput) routeOutput.style.display = 'none';
            if (routeOptionsContainer) routeOptionsContainer.style.display = 'none';
            map.setView(GIET_CENTER, 18);
            calculateLimits();
        });
    }

    // ================= 10. MOBILE BOTTOM SHEET GESTURES =================
    let isDragging = false;
    let startY = 0;
    let currentTranslateY = 0;
    let maxTranslate = 0;
    let isCollapsed = false;
    const VISIBLE_PEEK_HEIGHT = 70;

    function calculateLimits() {
        if (!navPanel) return;
        const panelHeight = navPanel.offsetHeight;
        maxTranslate = Math.max(0, panelHeight - VISIBLE_PEEK_HEIGHT);
    }

    function snapToCollapsed() {
        calculateLimits();
        isCollapsed = true;
        currentTranslateY = maxTranslate;
        navPanel.style.transform = `translateY(${maxTranslate}px)`;
    }

    function snapToExpanded() {
        isCollapsed = false;
        currentTranslateY = 0;
        navPanel.style.transform = 'translateY(0px)';
    }

    const dragHandle = document.querySelector('.panel-toggle-btn') || togglePanelBtn;

    if (dragHandle && navPanel) {
        dragHandle.addEventListener('touchstart', (e) => {
            if (window.innerWidth > 640) return;
            isDragging = true;
            startY = e.touches[0].clientY;
            calculateLimits();
            navPanel.style.transition = 'none';
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const deltaY = e.touches[0].clientY - startY;
            let newTranslate = (isCollapsed ? maxTranslate : 0) + deltaY;

            if (newTranslate < 0) newTranslate = 0;
            if (newTranslate > maxTranslate) newTranslate = maxTranslate;

            currentTranslateY = newTranslate;
            navPanel.style.transform = `translateY(${newTranslate}px)`;
        }, { passive: true });

        window.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            navPanel.style.transition = '';
            calculateLimits();

            const snapThreshold = maxTranslate * 0.35;
            if (!isCollapsed) {
                if (currentTranslateY > snapThreshold) snapToCollapsed();
                else snapToExpanded();
            } else {
                if (currentTranslateY < maxTranslate - snapThreshold) snapToExpanded();
                else snapToCollapsed();
            }
        });
    }

    if (togglePanelBtn) {
        togglePanelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (isCollapsed) snapToExpanded();
            else snapToCollapsed();
        });
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 640) {
            navPanel.style.transform = '';
        } else if (isCollapsed) {
            snapToCollapsed();
        }
    });

    // ================= 11. GPS LIVE & SIMULATION =================
    if (startNavBtn) {
        startNavBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert("Geolocation is not supported by your mobile browser.");
                return;
            }

            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
                startNavBtn.textContent = "🚶 GPS Live";
                return;
            }

            startNavBtn.textContent = "⏹️ Stop GPS";

            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    const accuracy = pos.coords.accuracy;

                    updateUserPosition(lat, lng, accuracy);
                    map.panTo([lat, lng]);
                },
                (err) => {
                    console.error(err);
                    alert("Unable to fetch GPS: " + err.message);
                },
                { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
            );
        });
    }

    if (simulateBtn) {
        simulateBtn.addEventListener('click', () => {
            if (currentRouteCoords.length < 2) {
                alert("Select endpoints and click 'Find Routes' first.");
                return;
            }

            if (simulationInterval) {
                clearInterval(simulationInterval);
                simulationInterval = null;
                simulateBtn.textContent = "▶️ Simulate Walk";
                return;
            }

            simulateBtn.textContent = "⏸️ Pause Walk";

            let animationPoints = [];
            for (let i = 0; i < currentRouteCoords.length - 1; i++) {
                const p1 = currentRouteCoords[i];
                const p2 = currentRouteCoords[i + 1];
                const steps = 15;
                for (let s = 0; s <= steps; s++) {
                    const lat = p1[0] + (p2[0] - p1[0]) * (s / steps);
                    const lng = p1[1] + (p2[1] - p1[1]) * (s / steps);
                    animationPoints.push([lat, lng]);
                }
            }

            let stepIndex = 0;
            simulationInterval = setInterval(() => {
                if (stepIndex >= animationPoints.length) {
                    clearInterval(simulationInterval);
                    simulationInterval = null;
                    simulateBtn.textContent = "▶️ Simulate Walk";
                    alert("You have reached your destination!");
                    return;
                }

                const [lat, lng] = animationPoints[stepIndex];
                updateUserPosition(lat, lng, 3);
                map.panTo([lat, lng]);
                stepIndex++;
            }, 150);
        });
    }
});