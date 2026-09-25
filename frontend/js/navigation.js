document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_URL = isLocal ? "http://127.0.0.1:8000" : "https://giet-campus-api.onrender.com";

    // ================= 1. DOM REFERENCES & STATE =================
    const waypointsContainer = document.getElementById('waypoints-container');
    const startSelect = document.getElementById('start-select');
    const destSelect = document.getElementById('destination-select');
    const addStopBtn = document.getElementById('add-stop-btn');
    const findRouteBtn = document.getElementById('find-route-btn');
    const clearRouteBtn = document.getElementById('clear-route-btn');
    const startNavBtn = document.getElementById('start-nav-btn');
    const simulateBtn = document.getElementById('simulate-btn');
    const routeOutput = document.getElementById('route-output');
    const routeOptionsContainer = document.getElementById('route-options-container');
    const routeCardsList = document.getElementById('route-cards-list');
    const turnStepsContainer = document.getElementById('turn-steps-container');
    const turnStepsList = document.getElementById('turn-steps-list');
    const turnHud = document.getElementById('turn-by-turn-hud');
    const turnIcon = document.getElementById('turn-icon');
    const turnInstruction = document.getElementById('turn-instruction');
    const turnDistance = document.getElementById('turn-distance');
    const exitHudBtn = document.getElementById('exit-nav-btn');

    const utilChips = document.querySelectorAll('.util-chip');
    const buildingSearch = document.getElementById('building-search');
    const searchResults = document.getElementById('search-results');
    const loadingScreen = document.getElementById('loading-screen');
    const navPanel = document.getElementById('nav-panel');
    const togglePanelBtn = document.getElementById('toggle-panel-btn');

    const GIET_CENTER = [19.0485, 83.8320];
    const ROUTE_PALETTE = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];

    let campusGeoJSON = null;
    let buildings = {};
    let markerLayers = {};
    let placeNamesSorted = [];
    let calculatedRoutes = [];
    let activeRouteIndex = 0;

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
    let turnInstructions = [];
    let utilityMarkers = [];

    function hideLoader() {
        if (!loadingScreen) return;
        loadingScreen.classList.add('hidden');
        setTimeout(() => { if (map) map.invalidateSize(); }, 200);
    }
    const safetyTimer = setTimeout(hideLoader, 3000);

    // ================= 2. PURE SATELLITE BASE MAP (NO DEFAULT GOOGLE LABELS) =================
    const map = L.map('map', {
        zoomControl: false,
        maxZoom: 22,
        tap: false
    }).setView(GIET_CENTER, 18);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // lyrs=s strips all default business text, shop markers, and street names
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 22,
        maxNativeZoom: 20,
        attribution: '&copy; Google Satellite &mdash; GIET University'
    }).addTo(map);

    // ================= 3. UTILITY ICONS & OVERLAYS =================
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
                else if (cat.includes('washroom') || cat.includes('restroom') || name.toLowerCase().includes('washroom') || name.toLowerCase().includes('toilet')) matchType = 'washroom';
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

    // ================= 4. GEOMETRY & GRAPH HELPERS =================
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

    // ================= 5. TURN-BY-TURN INSTRUCTIONS =================
    function generateTurnInstructions(coords) {
        if (!coords || coords.length < 2) return [];
        const instructions = [];
        let accumulatedDistance = 0;

        instructions.push({
            action: "start",
            icon: "📍",
            text: "Start walking along the path",
            distance: 0,
            coord: coords[0]
        });

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
                const icon = diff > 0 ? "↗️" : "↖️";
                instructions.push({
                    action: "turn",
                    icon: icon,
                    text: `${turnType} onto connecting path`,
                    distance: Math.round(accumulatedDistance),
                    coord: pCurr
                });
                accumulatedDistance = 0;
            }
        }

        const finalSeg = getDistance(coords[coords.length - 2][0], coords[coords.length - 2][1], coords[coords.length - 1][0], coords[coords.length - 1][1]);
        accumulatedDistance += finalSeg;

        instructions.push({
            action: "arrive",
            icon: "🏁",
            text: "Arrive at destination doorway",
            distance: Math.round(accumulatedDistance),
            coord: coords[coords.length - 1]
        });

        return instructions;
    }

    function renderTurnDirections(instructions) {
        turnStepsList.innerHTML = '';
        instructions.forEach((step, idx) => {
            const div = document.createElement('div');
            div.className = `turn-step-item ${idx === 0 ? 'active' : ''}`;
            div.innerHTML = `
                <span style="font-size: 1.2rem;">${step.icon}</span>
                <div>
                    <div><strong>${step.text}</strong></div>
                    <div style="color: #64748b; font-size: 11px;">${step.distance > 0 ? `After ${step.distance} meters` : 'Start'}</div>
                </div>
            `;
            turnStepsList.appendChild(div);
        });
        turnStepsContainer.classList.remove('hidden');
    }

    // ================= 6. LIVE GPS & DYNAMIC LINE ERASING =================
    function updateUserLiveLocation(lat, lng, accuracy = 5) {
        currentUserLat = lat;
        currentUserLng = lng;

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

            if (remainingRoutePolyline) {
                remainingRoutePolyline.setLatLngs(remainingCoords);
            }

            if (!breadcrumbPolyline) {
                breadcrumbPolyline = L.polyline(walkedCoords, {
                    color: '#94a3b8',
                    weight: 4,
                    opacity: 0.5,
                    dashArray: '3, 6'
                }).addTo(map);
            } else {
                breadcrumbPolyline.setLatLngs(walkedCoords);
            }

            updateHudInstruction(remainingCoords, currentPos);
        }
    }

    function updateHudInstruction(remainingCoords, currentPos) {
        if (!turnInstructions || turnInstructions.length === 0) return;

        let nextTurn = null;
        for (let i = 0; i < turnInstructions.length; i++) {
            const d = getDistance(currentPos[0], currentPos[1], turnInstructions[i].coord[0], turnInstructions[i].coord[1]);
            if (d > 8) {
                nextTurn = turnInstructions[i];
                nextTurn.liveDist = Math.round(d);
                break;
            }
        }

        if (nextTurn) {
            turnHud.classList.remove('hidden');
            turnIcon.textContent = nextTurn.icon;
            turnInstruction.textContent = nextTurn.text;
            turnDistance.textContent = `in ${nextTurn.liveDist} meters`;
        } else {
            turnHud.classList.remove('hidden');
            turnIcon.textContent = "🏁";
            turnInstruction.textContent = "Approaching destination";
            turnDistance.textContent = "within 5 meters";
        }
    }

    // ================= 7. ROUTE RENDERING =================
    function selectActiveRoute(index) {
        activeRouteIndex = index;
        const selectedRoute = calculatedRoutes[index];
        fullRouteCoords = selectedRoute.path;

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

        const cards = routeCardsList.children;
        for (let i = 0; i < cards.length; i++) {
            cards[i].classList.toggle('active', i === index);
        }

        if (routeOutput) {
            routeOutput.classList.remove('hidden');
            routeOutput.innerHTML = `
                <div style="font-size: 13px;">
                    <strong style="color: ${ROUTE_PALETTE[index] || '#10b981'}">${selectedRoute.name}</strong><br>
                    Distance: <strong>${selectedRoute.totalDistance} meters</strong> (~${Math.ceil(selectedRoute.totalDistance / 75)} mins)
                </div>
            `;
        }

        map.fitBounds(remainingRoutePolyline.getBounds(), { padding: [50, 50] });
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
                <div class="route-card-sub" style="margin-left: 16px;">${route.totalDistance} meters • Road verified</div>
            `;
            card.addEventListener('click', () => selectActiveRoute(idx));
            routeCardsList.appendChild(card);
        });

        routeOptionsContainer.classList.remove('hidden');
        selectActiveRoute(0);
    }

    // ================= 8. MULTI-STOP DROPDOWN POPULATOR =================
    function populateDropdown(selectElem, placeholder = "Choose Location") {
        selectElem.innerHTML = `<option value="">${placeholder}</option>`;
        placeNamesSorted.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            selectElem.appendChild(opt);
        });
    }

    function updateDestinationLabels() {
        const stopRows = waypointsContainer.querySelectorAll('.stop-row .location-select');
        stopRows.forEach((sel, idx) => {
            const destNum = idx + 2;
            const currentVal = sel.value;
            populateDropdown(sel, `Next Destination ${destNum}`);
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
                <div class="point-badge" style="background:#8b5cf6;">${String.fromCharCode(67 + existingExtraStops)}</div>
                <select class="location-select" style="flex: 1;"></select>
                <button type="button" class="btn-remove-stop" title="Remove stop">✕</button>
            `;

            waypointsContainer.appendChild(div);
            populateDropdown(div.querySelector('select'), `Next Destination ${destNumber}`);

            div.querySelector('.btn-remove-stop').addEventListener('click', () => {
                div.remove();
                updateDestinationLabels();
            });

            const panelBody = document.querySelector('.panel-body');
            if (panelBody) panelBody.scrollTop = panelBody.scrollHeight;
        });
    }

    // ================= 9. LOAD CAMPUS GEOJSON =================
    function processGeoJSONData(data) {
        campusGeoJSON = data;
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
        buildClientGraph(data);

        // Populate Destination dropdown
        populateDropdown(destSelect, "Choose Destination");

        // Populate Start Dropdown (Includes Live Location)
        startSelect.innerHTML = `<option value="LIVE_LOCATION">📍 My Live Location (GPS)</option>`;
        placeNamesSorted.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            startSelect.appendChild(opt);
        });

        clearTimeout(safetyTimer);
        hideLoader();

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => updateUserLiveLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
                () => console.warn("GPS permission pending")
            );
        }
    }

    fetch(`${API_URL}/api/campus-data`)
        .then(res => res.json())
        .then(data => processGeoJSONData(data.geojson))
        .catch(() => {
            fetch('assets/data/giet_campus.geojson')
                .then(res => res.json())
                .then(data => processGeoJSONData(data))
                .catch(err => {
                    console.error("Critical error:", err);
                    clearTimeout(safetyTimer);
                    hideLoader();
                });
        });

    function getPlaceIcon(name) {
        const n = name.toLowerCase();
        if (n.includes('gate')) return '🚪';
        if (n.includes('temple')) return '🛕';
        if (n.includes('library')) return '📚';
        if (n.includes('canteen') || n.includes('parlour') || n.includes('parloor')) return '☕';
        if (n.includes('bus')) return '🚌';
        if (n.includes('parking')) return '🅿️';
        if (n.includes('water') || n.includes('cooler')) return '🚰';
        if (n.includes('washroom') || n.includes('restroom')) return '🚻';
        if (n.includes('medical') || n.includes('first aid')) return '🏥';
        return '🏛️';
    }

    // ================= 10. MULTI-WAYPOINT ROUTE CALCULATION =================
    if (findRouteBtn) {
        findRouteBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            // Collect all dropdowns dynamically (Start, End, and all Next Destinations)
            const allSelects = Array.from(waypointsContainer.querySelectorAll('.location-select'));
            const selectedPoints = [];
            const coordsArray = [];

            for (let i = 0; i < allSelects.length; i++) {
                const val = allSelects[i].value.trim();
                if (!val) continue;

                if (val === "LIVE_LOCATION") {
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
                    selectedPoints.push("My Location");
                    coordsArray.push([currentUserLat, currentUserLng]);
                } else if (buildings[val]) {
                    selectedPoints.push(val);
                    coordsArray.push(buildings[val]);
                }
            }

            if (coordsArray.length < 2) {
                alert("Please select at least a Starting Point and Destination.");
                return;
            }

            // Client-side fallback supports chaining 3+ waypoints seamlessly
            const routes = computeClientSideRoutes(coordsArray);
            if (!routes || routes.length === 0) {
                alert("No route connected between the selected locations.");
                return;
            }

            renderRoutes(routes);
        });
    }

    // ================= 11. GPS LIVE WATCH & SIMULATION =================
    if (startNavBtn) {
        startNavBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert("Geolocation not supported by this browser.");
                return;
            }

            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
                startNavBtn.innerHTML = `<i class="fa-solid fa-location-arrow"></i> <span>Start Live GPS</span>`;
                startNavBtn.classList.remove('btn-danger');
                turnHud.classList.add('hidden');
                return;
            }

            startNavBtn.innerHTML = `<i class="fa-solid fa-stop"></i> <span>Stop GPS</span>`;
            startNavBtn.classList.add('btn-danger');

            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    updateUserLiveLocation(lat, lng, pos.coords.accuracy);
                    map.panTo([lat, lng]);
                },
                (err) => alert("GPS Error: " + err.message),
                { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
            );
        });
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
                simulateBtn.innerHTML = `<i class="fa-solid fa-play"></i> <span>Simulate Walk</span>`;
                return;
            }

            simulateBtn.innerHTML = `<i class="fa-solid fa-pause"></i> <span>Pause Walk</span>`;

            let animationPoints = [];
            for (let i = 0; i < fullRouteCoords.length - 1; i++) {
                const p1 = fullRouteCoords[i];
                const p2 = fullRouteCoords[i + 1];
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
                    simulateBtn.innerHTML = `<i class="fa-solid fa-play"></i> <span>Simulate Walk</span>`;
                    alert("You have arrived at your destination!");
                    return;
                }

                const [lat, lng] = animationPoints[stepIndex];
                updateUserLiveLocation(lat, lng, 3);
                map.panTo([lat, lng]);
                stepIndex++;
            }, 120);
        });
    }

    if (clearRouteBtn) {
        clearRouteBtn.addEventListener('click', () => {
            if (remainingRoutePolyline) map.removeLayer(remainingRoutePolyline);
            if (breadcrumbPolyline) map.removeLayer(breadcrumbPolyline);
            alternativePolylines.forEach(p => map.removeLayer(p));
            alternativePolylines = [];
            remainingRoutePolyline = null;
            breadcrumbPolyline = null;
            fullRouteCoords = [];

            if (simulationInterval) {
                clearInterval(simulationInterval);
                simulationInterval = null;
                simulateBtn.innerHTML = `<i class="fa-solid fa-play"></i> <span>Simulate Walk</span>`;
            }
            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
                startNavBtn.innerHTML = `<i class="fa-solid fa-location-arrow"></i> <span>Start Live GPS</span>`;
                startNavBtn.classList.remove('btn-danger');
            }

            // Remove all dynamically added stop rows
            const extraRows = waypointsContainer.querySelectorAll('.stop-row');
            extraRows.forEach(row => row.remove());

            destSelect.value = '';
            startSelect.value = 'LIVE_LOCATION';

            turnHud.classList.add('hidden');
            turnStepsContainer.classList.add('hidden');
            routeOutput.classList.add('hidden');
            routeOptionsContainer.classList.add('hidden');
            map.setView(GIET_CENTER, 18);
        });
    }

    if (exitHudBtn) {
        exitHudBtn.addEventListener('click', () => turnHud.classList.add('hidden'));
    }

    // ================= 12. LIVE SEARCH DROPDOWN =================
    if (buildingSearch && searchResults) {
        buildingSearch.addEventListener('input', () => {
            const query = buildingSearch.value.trim().toLowerCase();
            searchResults.innerHTML = '';

            if (!query) {
                searchResults.classList.add('hidden');
                return;
            }

            const matchedPlaces = placeNamesSorted.filter(p => p.toLowerCase().includes(query));
            if (matchedPlaces.length === 0) {
                searchResults.classList.add('hidden');
                return;
            }

            matchedPlaces.slice(0, 8).forEach(place => {
                const item = document.createElement('div');
                item.className = 'search-item';
                item.innerHTML = `${getPlaceIcon(place)} <strong>${place}</strong>`;

                item.addEventListener('click', () => {
                    buildingSearch.value = place;
                    searchResults.classList.add('hidden');

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
            searchResults.classList.remove('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!buildingSearch.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.add('hidden');
            }
        });
    }
});