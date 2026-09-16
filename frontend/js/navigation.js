document.addEventListener('DOMContentLoaded', () => {

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

    let buildings = {};
    let markerLayers = {};
    let placeNamesSorted = [];
    let graph = {};
    let allGraphNodes = [];
    let nodeSet = new Set();
    let rawLineSegments = [];
    let calculatedRoutes = [];
    let renderedPolylines = [];
    let activeRouteIndex = 0;
    let currentRouteCoords = [];

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

    const safetyTimer = setTimeout(hideLoader, 2500);

    // ================= 2. MAP & SATELLITE TILES =================
    const map = L.map('map', {
        zoomControl: false,
        maxZoom: 22
    }).setView(GIET_CENTER, 18);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 22,
        maxNativeZoom: 20,
        attribution: '&copy; Google Maps'
    }).addTo(map);

    // ================= 3. UTILITY & TOPOLOGY FUNCTIONS =================
    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function toKey(lat, lng) {
        return `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
    }

    function registerNode(key) {
        if (!nodeSet.has(key)) {
            nodeSet.add(key);
            allGraphNodes.push(key);
        }
    }

    function addEdge(uKey, vKey, uCoord, vCoord, weightMultiplier = 1.0) {
        if (uKey === vKey) return;
        const dist = getDistance(uCoord[0], uCoord[1], vCoord[0], vCoord[1]);
        const weight = dist * weightMultiplier;

        if (!graph[uKey]) graph[uKey] = [];
        if (!graph[vKey]) graph[vKey] = [];

        registerNode(uKey);
        registerNode(vKey);

        if (!graph[uKey].some(e => e.node === vKey)) {
            graph[uKey].push({ node: vKey, dist, weight, coord: vCoord });
        }
        if (!graph[vKey].some(e => e.node === uKey)) {
            graph[vKey].push({ node: uKey, dist, weight, coord: uCoord });
        }
    }

    function projectPointOnSegment(p, a, b) {
        const x = p[1], y = p[0];
        const x1 = a[1], y1 = a[0];
        const x2 = b[1], y2 = b[0];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return a;
        let t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        return [y1 + t * dy, x1 + t * dx];
    }

    function findBestEntryNode(targetLat, targetLng) {
        let bestCoord = null;
        let minDist = Infinity;
        let matchedSegment = null;

        for (let key of allGraphNodes) {
            const [lat, lng] = key.split(',').map(Number);
            const d = getDistance(targetLat, targetLng, lat, lng);
            if (d < minDist) {
                minDist = d;
                bestCoord = [lat, lng];
            }
        }

        for (let seg of rawLineSegments) {
            const proj = projectPointOnSegment([targetLat, targetLng], seg.u, seg.v);
            const d = getDistance(targetLat, targetLng, proj[0], proj[1]);
            if (d < minDist) {
                minDist = d;
                bestCoord = proj;
                matchedSegment = seg;
            }
        }

        if (bestCoord) {
            const bestKey = toKey(bestCoord[0], bestCoord[1]);
            registerNode(bestKey);

            if (matchedSegment) {
                const uKey = toKey(matchedSegment.u[0], matchedSegment.u[1]);
                const vKey = toKey(matchedSegment.v[0], matchedSegment.v[1]);
                addEdge(uKey, bestKey, matchedSegment.u, bestCoord, matchedSegment.weightMultiplier);
                addEdge(bestKey, vKey, bestCoord, matchedSegment.v, matchedSegment.weightMultiplier);
            }
            return { key: bestKey, coord: bestCoord, dist: minDist };
        }
        return { key: null, coord: null, dist: Infinity };
    }

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

    // ================= 4. FETCH GEOJSON & APPLY ROAD WEIGHTS =================
    fetch('assets/data/giet_campus.geojson')
        .then(res => {
            if (!res.ok) throw new Error("Could not load assets/data/giet_campus.geojson");
            return res.json();
        })
        .then(data => {
            const placeNames = [];

            // A. Ingest Lines with Priority Weights
            data.features.forEach(feature => {
                if (feature.geometry && feature.geometry.type === 'LineString') {
                    const coords = feature.geometry.coordinates;
                    const props = feature.properties || {};
                    const name = (props.name || '').toLowerCase();
                    const highway = (props.highway || '').toLowerCase();

                    // Line 51, 52, 53 are penalized footways; all others are primary
                    let weightMultiplier = 1.0;
                    if (props.weight_cost) {
                        weightMultiplier = Number(props.weight_cost);
                    } else if (highway === 'footway' || name.includes('line 51') || name.includes('line 52') || name.includes('line 53')) {
                        weightMultiplier = 4.5;
                    }

                    for (let i = 0; i < coords.length - 1; i++) {
                        const u = [coords[i][1], coords[i][0]];
                        const v = [coords[i + 1][1], coords[i + 1][0]];
                        addEdge(toKey(u[0], u[1]), toKey(v[0], v[1]), u, v, weightMultiplier);
                        rawLineSegments.push({ u, v, weightMultiplier });
                    }
                }
            });

            // B. Auto-bridge physical junctions within 6 meters (strictly prevents grass-crossing shortcuts)
            for (let i = 0; i < allGraphNodes.length; i++) {
                const [lat1, lng1] = allGraphNodes[i].split(',').map(Number);
                for (let j = i + 1; j < allGraphNodes.length; j++) {
                    const [lat2, lng2] = allGraphNodes[j].split(',').map(Number);
                    const d = getDistance(lat1, lng1, lat2, lng2);
                    if (d <= 6) {
                        addEdge(allGraphNodes[i], allGraphNodes[j], [lat1, lng1], [lat2, lng2], 1.0);
                    }
                }
            }

            // C. Layer Rendering
            L.geoJSON(data, {
                style: (feature) => {
                    if (feature.geometry.type === 'LineString') {
                        const isFootway = feature.properties?.highway === 'footway';
                        return {
                            color: isFootway ? '#94a3b8' : '#f8fafc',
                            weight: isFootway ? 2.5 : 4,
                            opacity: 0.7,
                            dashArray: isFootway ? '4, 4' : '6, 6',
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
                        const lat = feature.geometry.coordinates[1];
                        const lng = feature.geometry.coordinates[0];
                        buildings[name] = [lat, lng];
                        markerLayers[name] = layer;

                        const icon = getPlaceIcon(name);

                        layer.bindTooltip(`<span>${icon}</span> <span>${name}</span>`, {
                            permanent: true,
                            direction: 'top',
                            offset: [0, -6],
                            className: 'satellite-label'
                        });

                        placeNames.push(name);
                    }
                }
            }).addTo(map);

            placeNames.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            placeNamesSorted = placeNames;

            const selects = waypointsContainer.querySelectorAll('.location-select');
            if (selects[0]) populateSelectElement(selects[0], "Choose Starting Point");
            if (selects[1]) populateSelectElement(selects[1], "Choose Destination");

            clearTimeout(safetyTimer);
            hideLoader();
        })
        .catch(err => {
            console.error("GeoJSON load error:", err);
            clearTimeout(safetyTimer);
            hideLoader();
        });

    // ================= 5. LIVE SEARCH =================
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
                        if (markerLayers[place]) {
                            markerLayers[place].openTooltip();
                        }
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

    // ================= 6. DYNAMIC STOPS =================
    if (addStopBtn) {
        addStopBtn.addEventListener('click', () => {
            const rows = waypointsContainer.querySelectorAll('.stop-row');
            const newIndex = rows.length;

            const div = document.createElement('div');
            div.className = 'input-group stop-row';
            div.innerHTML = `
                <select class="location-select" data-stop="${newIndex}"></select>
                <button type="button" class="btn-remove-stop" title="Remove stop">✕</button>
            `;

            const lastRow = rows[rows.length - 1];
            waypointsContainer.insertBefore(div, lastRow);
            populateSelectElement(div.querySelector('select'), `Via Point ${newIndex}`);

            div.querySelector('.btn-remove-stop').addEventListener('click', () => {
                div.remove();
            });
        });
    }

    // ================= 7. WEIGHTED DIJKSTRA ROUTER =================
    function dijkstra(startKey, endKey, penalizedEdges = new Set(), penaltyFactor = 2.5) {
        const distances = {};
        const previous = {};
        const unvisited = new Set(allGraphNodes);

        allGraphNodes.forEach(node => {
            distances[node] = Infinity;
            previous[node] = null;
        });

        distances[startKey] = 0;

        while (unvisited.size > 0) {
            let current = null;
            let smallestDist = Infinity;

            for (let node of unvisited) {
                if (distances[node] < smallestDist) {
                    smallestDist = distances[node];
                    current = node;
                }
            }

            if (current === null || distances[current] === Infinity || current === endKey) break;
            unvisited.delete(current);

            const neighbors = graph[current] || [];
            for (let edge of neighbors) {
                if (unvisited.has(edge.node)) {
                    const edgeKeyF = `${current}->${edge.node}`;
                    const edgeKeyB = `${edge.node}->${current}`;

                    const isPenalized = penalizedEdges.has(edgeKeyF) || penalizedEdges.has(edgeKeyB);

                    let edgeCost = edge.weight;
                    if (isPenalized) {
                        edgeCost *= penaltyFactor;
                    }

                    const alt = distances[current] + edgeCost;
                    if (alt < distances[edge.node]) {
                        distances[edge.node] = alt;
                        previous[edge.node] = current;
                    }
                }
            }
        }

        const path = [];
        let curr = endKey;
        while (curr) {
            const [lat, lng] = curr.split(',').map(Number);
            path.unshift([lat, lng]);
            curr = previous[curr];
        }

        return { path, totalDistance: distances[endKey] };
    }

    function calculateSingleLeg(startCoords, endCoords, penalizedEdges = new Set()) {
        const startNode = findBestEntryNode(startCoords[0], startCoords[1]);
        const endNode = findBestEntryNode(endCoords[0], endCoords[1]);
        if (!startNode.key || !endNode.key) return null;

        const leg = dijkstra(startNode.key, endNode.key, penalizedEdges);
        if (!leg.path || leg.path.length < 1) return null;

        let actualDist = 0;
        for (let p = 0; p < leg.path.length - 1; p++) {
            actualDist += getDistance(leg.path[p][0], leg.path[p][1], leg.path[p + 1][0], leg.path[p + 1][1]);
        }

        return {
            path: [startCoords, ...leg.path, endCoords],
            totalDistance: Math.round(actualDist + startNode.dist + endNode.dist)
        };
    }

    function calculateMultiStopRoute(points, penalizedEdges = new Set()) {
        let fullPath = [];
        let totalDist = 0;

        for (let i = 0; i < points.length - 1; i++) {
            const leg = calculateSingleLeg(buildings[points[i]], buildings[points[i + 1]], penalizedEdges);
            if (!leg) return null;

            if (fullPath.length > 0) {
                fullPath.push(...leg.path.slice(1));
            } else {
                fullPath.push(...leg.path);
            }
            totalDist += leg.totalDistance;
        }

        return { path: fullPath, totalDistance: totalDist };
    }

    function findAlternativeRoute(points, primaryRoute) {
        const penalizedEdges = new Set();
        for (let i = 1; i < primaryRoute.path.length - 2; i++) {
            const u = toKey(primaryRoute.path[i][0], primaryRoute.path[i][1]);
            const v = toKey(primaryRoute.path[i + 1][0], primaryRoute.path[i + 1][1]);
            penalizedEdges.add(`${u}->${v}`);
            penalizedEdges.add(`${v}->${u}`);
        }

        const alt = calculateMultiStopRoute(points, penalizedEdges);
        const primarySig = primaryRoute.path.map(p => toKey(p[0], p[1])).join('|');

        if (alt && alt.path.map(p => toKey(p[0], p[1])).join('|') !== primarySig) {
            if (alt.totalDistance <= primaryRoute.totalDistance * 1.35) {
                return alt;
            }
        }
        return null;
    }

    // ================= 8. DUAL-ROUTE RENDERING =================
    function selectActiveRoute(index) {
        activeRouteIndex = index;
        const selectedRoute = calculatedRoutes[index];
        currentRouteCoords = selectedRoute.path;

        renderedPolylines.forEach((polyGroup, idx) => {
            const isSelected = idx === index;
            const visibleLine = polyGroup.visibleLine;

            if (isSelected) {
                visibleLine.setStyle({
                    color: '#2563eb', // Google Active Blue
                    weight: 7,
                    opacity: 0.95,
                    dashArray: null
                });
                visibleLine.bringToFront();
            } else {
                visibleLine.setStyle({
                    color: '#94a3b8', // Alternate Gray
                    weight: 5,
                    opacity: 0.8,
                    dashArray: '8, 6'
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
                    <strong>${selectedRoute.name}</strong><br>
                    Walking Distance: ~${selectedRoute.totalDistance} meters<br>
                    Estimated Time: ~${Math.ceil(selectedRoute.totalDistance / 75)} mins
                </div>
            `;
        }

        updateUserPosition(currentRouteCoords[0][0], currentRouteCoords[0][1], 8);
    }

    function renderRoutes(routes) {
        renderedPolylines.forEach(group => {
            map.removeLayer(group.visibleLine);
            map.removeLayer(group.hitArea);
        });
        renderedPolylines = [];
        routeCardsList.innerHTML = '';

        routes.forEach((route, idx) => {
            const isPrimary = idx === 0;

            const visibleLine = L.polyline(route.path, {
                color: isPrimary ? '#2563eb' : '#94a3b8',
                weight: isPrimary ? 7 : 5,
                opacity: isPrimary ? 0.95 : 0.8,
                dashArray: isPrimary ? null : '8, 6',
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(map);

            const hitArea = L.polyline(route.path, {
                color: 'transparent',
                weight: 22,
                opacity: 0
            }).addTo(map);

            hitArea.on('click', () => selectActiveRoute(idx));
            visibleLine.on('click', () => selectActiveRoute(idx));

            renderedPolylines.push({ visibleLine, hitArea });

            const card = document.createElement('div');
            card.className = `route-card ${isPrimary ? 'active' : ''}`;
            card.innerHTML = `
                <div class="route-card-title">
                    <span>${route.name}</span>
                    <span>~${Math.ceil(route.totalDistance / 75)} min</span>
                </div>
                <div class="route-card-sub">${route.totalDistance} meters • Road verified</div>
            `;
            card.addEventListener('click', () => selectActiveRoute(idx));
            routeCardsList.appendChild(card);
        });

        routeOptionsContainer.style.display = 'block';
        selectActiveRoute(0);

        if (renderedPolylines[0]) {
            map.fitBounds(renderedPolylines[0].visibleLine.getBounds(), { padding: [60, 60] });
        }
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

    // ================= 9. ROUTE ACTIONS =================
    if (findRouteBtn) {
        findRouteBtn.addEventListener('click', () => {
            const selects = Array.from(waypointsContainer.querySelectorAll('.location-select'));
            const selectedPoints = selects.map(s => s.value).filter(val => val !== '');

            if (selectedPoints.length < 2) {
                alert("Please select at least a Starting Point and Destination.");
                return;
            }

            calculatedRoutes = [];

            // 1. Primary Route (Follows main road automatically)
            const primary = calculateMultiStopRoute(selectedPoints);
            if (!primary) {
                alert("No connected walking path found across these locations.");
                return;
            }
            primary.name = selectedPoints.length > 2 ? "Multi-Stop (Main Road)" : "Fastest (Main Road)";
            calculatedRoutes.push(primary);

            // 2. Alternative Route
            const alternative = findAlternativeRoute(selectedPoints, primary);
            if (alternative) {
                alternative.name = selectedPoints.length > 2 ? "Multi-Stop (Alternative)" : "Alternative Route";
                calculatedRoutes.push(alternative);
            }

            renderRoutes(calculatedRoutes);

            if (window.innerWidth <= 640 && navPanel) {
                setTimeout(snapToCollapsed, 250);
            }
        });
    }

    if (clearRouteBtn) {
        clearRouteBtn.addEventListener('click', () => {
            renderedPolylines.forEach(group => {
                map.removeLayer(group.visibleLine);
                map.removeLayer(group.hitArea);
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

            const rows = waypointsContainer.querySelectorAll('.stop-row');
            for (let i = 1; i < rows.length - 1; i++) {
                rows[i].remove();
            }

            if (routeOutput) routeOutput.style.display = 'none';
            if (routeOptionsContainer) routeOptionsContainer.style.display = 'none';
            map.setView(GIET_CENTER, 18);
        });
    }

    // ================= 10. BOTTOM SHEET GESTURES =================
    let isDragging = false;
    let startY = 0;
    let currentTranslateY = 0;
    let maxTranslate = 0;
    let isCollapsed = false;
    const VISIBLE_PEEK_HEIGHT = 68;

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

    function onDragStart(e) {
        if (window.innerWidth > 640) return;
        isDragging = true;
        startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        calculateLimits();
        navPanel.classList.add('dragging');
    }

    function onDragMove(e) {
        if (!isDragging) return;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        const deltaY = clientY - startY;

        let newTranslate = (isCollapsed ? maxTranslate : 0) + deltaY;
        if (newTranslate < 0) newTranslate = 0;
        if (newTranslate > maxTranslate) newTranslate = maxTranslate;

        currentTranslateY = newTranslate;
        navPanel.style.transform = `translateY(${newTranslate}px)`;
        if (e.cancelable) e.preventDefault();
    }

    function onDragEnd() {
        if (!isDragging) return;
        isDragging = false;
        navPanel.classList.remove('dragging');
        calculateLimits();

        const snapThreshold = maxTranslate * 0.35;
        if (!isCollapsed) {
            if (currentTranslateY > snapThreshold) snapToCollapsed();
            else snapToExpanded();
        } else {
            if (currentTranslateY < maxTranslate - snapThreshold) snapToExpanded();
            else snapToCollapsed();
        }
    }

    if (togglePanelBtn && navPanel) {
        const dragHandleArea = document.querySelector('.nav-panel-header') || togglePanelBtn;

        togglePanelBtn.addEventListener('mousedown', onDragStart);
        togglePanelBtn.addEventListener('touchstart', onDragStart, { passive: true });
        dragHandleArea.addEventListener('mousedown', onDragStart);
        dragHandleArea.addEventListener('touchstart', onDragStart, { passive: true });

        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('touchmove', onDragMove, { passive: false });
        window.addEventListener('mouseup', onDragEnd);
        window.addEventListener('touchend', onDragEnd);

        togglePanelBtn.addEventListener('click', () => {
            if (isCollapsed) snapToExpanded();
            else snapToCollapsed();
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 640) {
                navPanel.style.transform = '';
            } else if (isCollapsed) {
                snapToCollapsed();
            }
        });
    }

    // ================= 11. GPS & SIMULATION =================
    if (startNavBtn) {
        startNavBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert("Geolocation is not supported by your browser.");
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