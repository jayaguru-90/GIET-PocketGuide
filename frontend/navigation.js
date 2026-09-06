document.addEventListener('DOMContentLoaded', () => {

    // ================= 1. DOM REFERENCES & STATE =================
    const startSelect = document.getElementById('start-select');
    const endSelect = document.getElementById('end-select');
    const findRouteBtn = document.getElementById('find-route-btn');
    const clearRouteBtn = document.getElementById('clear-route-btn');
    const startNavBtn = document.getElementById('start-nav-btn');
    const simulateBtn = document.getElementById('simulate-btn');
    const routeOutput = document.getElementById('route-output');
    const loadingScreen = document.getElementById('loading-screen');
    const navPanel = document.getElementById('nav-panel');
    const togglePanelBtn = document.getElementById('toggle-panel-btn');

    const GIET_CENTER = [19.0485, 83.8320];

    let buildings = {};
    let graph = {};
    let allGraphNodes = [];
    let activeRouteLayer = null;
    let currentRouteCoords = [];

    let userMarker = null;
    let userAccuracyCircle = null;
    let watchId = null;
    let simulationInterval = null;

    // Self-healing dismiss function
    function hideLoader() {
        if (!loadingScreen) return;
        loadingScreen.classList.add('hidden');
        loadingScreen.style.display = 'none';
        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 200);
    }

    // Safety fallback: guaranteed removal after 2.5s
    const safetyTimer = setTimeout(hideLoader, 2500);

    // ================= 2. MAP & CLEAN PURE SATELLITE TILES =================
    const map = L.map('map', {
        zoomControl: false,
        maxZoom: 22
    }).setView(GIET_CENTER, 18);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Pure photographic satellite view without default text
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 22,
        maxNativeZoom: 20,
        attribution: '&copy; Google Maps'
    }).addTo(map);

    // ================= 3. UTILITY & GRAPH FUNCTIONS =================
    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function toKey(lat, lng) {
        return `${lat.toFixed(6)},${lng.toFixed(6)}`;
    }

    function addEdge(uKey, vKey, uCoord, vCoord) {
        const dist = getDistance(uCoord[0], uCoord[1], vCoord[0], vCoord[1]);
        if (!graph[uKey]) {
            graph[uKey] = [];
            allGraphNodes.push(uKey);
        }
        if (!graph[vKey]) {
            graph[vKey] = [];
            allGraphNodes.push(vKey);
        }
        graph[uKey].push({ node: vKey, dist, coord: vCoord });
        graph[vKey].push({ node: uKey, dist, coord: uCoord });
    }

    function findClosestGraphNode(targetLat, targetLng) {
        let closestKey = null;
        let minDist = Infinity;

        for (let key of allGraphNodes) {
            const [lat, lng] = key.split(',').map(Number);
            const d = getDistance(targetLat, targetLng, lat, lng);
            if (d < minDist) {
                minDist = d;
                closestKey = key;
            }
        }
        return { key: closestKey, dist: minDist };
    }

    // Helper: Select suitable category icon for pins
    function getPlaceIcon(name) {
        const n = name.toLowerCase();
        if (n.includes('gate')) return '🚪';
        if (n.includes('temple')) return '🛕';
        if (n.includes('library')) return '📚';
        if (n.includes('canteen') || n.includes('parloor')) return '☕';
        if (n.includes('bus')) return '🚌';
        if (n.includes('parking')) return '🅿️';
        return '🏛️';
    }

    // ================= 4. LOAD GEOJSON, BUILD GRAPH & MODERN LABELS =================
    fetch('giet_campus.geojson')
        .then(res => {
            if (!res.ok) throw new Error("Could not find giet_campus.geojson");
            return res.json();
        })
        .then(data => {
            const placeNames = [];

            // Step A: Parse Lines for the graph
            data.features.forEach(feature => {
                if (feature.geometry && feature.geometry.type === 'LineString') {
                    const coords = feature.geometry.coordinates;
                    for (let i = 0; i < coords.length - 1; i++) {
                        const u = [coords[i][1], coords[i][0]];
                        const v = [coords[i + 1][1], coords[i + 1][0]];
                        addEdge(toKey(u[0], u[1]), toKey(v[0], v[1]), u, v);
                    }
                }
            });

            // Step B: Auto-bridge only minor gaps (reduced from 35m to 12m to prevent false shortcuts across buildings)
            for (let i = 0; i < allGraphNodes.length; i++) {
                const [lat1, lng1] = allGraphNodes[i].split(',').map(Number);
                for (let j = i + 1; j < allGraphNodes.length; j++) {
                    const [lat2, lng2] = allGraphNodes[j].split(',').map(Number);
                    const d = getDistance(lat1, lng1, lat2, lng2);
                    if (d < 12) { // 12 meters strictly keeps paths on actual walkways
                        addEdge(allGraphNodes[i], allGraphNodes[j], [lat1, lng1], [lat2, lng2]);
                    }
                }
            }
            // Step C: Render paths and pins with modern visual aesthetics
            L.geoJSON(data, {
                style: (feature) => {
                    if (feature.geometry.type === 'LineString') {
                        return {
                            color: '#f8fafc',
                            weight: 3.5,
                            opacity: 0.7,
                            dashArray: '6, 6',
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
                    const name = feature.properties?.name;
                    if (feature.geometry.type === 'Point' && name) {
                        const lat = feature.geometry.coordinates[1];
                        const lng = feature.geometry.coordinates[0];
                        buildings[name] = [lat, lng];

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

            // Step D: Sort alphabetically (A to Z)
            placeNames.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

            placeNames.forEach(name => {
                if (startSelect) {
                    const opt1 = document.createElement('option');
                    opt1.value = name;
                    opt1.textContent = name;
                    startSelect.appendChild(opt1);
                }
                if (endSelect) {
                    const opt2 = document.createElement('option');
                    opt2.value = name;
                    opt2.textContent = name;
                    endSelect.appendChild(opt2);
                }
            });

            clearTimeout(safetyTimer);
            hideLoader();
        })
        .catch(err => {
            console.error("GeoJSON error:", err);
            clearTimeout(safetyTimer);
            hideLoader();
        });

    // ================= 5. DIJKSTRA PATHFINDING =================
    function dijkstra(startKey, endKey) {
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

            if (current === null || distances[current] === Infinity) break;
            if (current === endKey) break;

            unvisited.delete(current);

            const neighbors = graph[current] || [];
            for (let edge of neighbors) {
                if (unvisited.has(edge.node)) {
                    const alt = distances[current] + edge.dist;
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

    // ================= 6. NAVIGATION ACTIONS & PANEL TOGGLE =================
    if (togglePanelBtn && navPanel) {
        togglePanelBtn.addEventListener('click', () => {
            navPanel.classList.toggle('collapsed');
        });
    }

    if (findRouteBtn) {
        findRouteBtn.addEventListener('click', () => {
            const startName = startSelect.value;
            const endName = endSelect.value;

            if (!startName || !endName) {
                alert("Please select both Start and Destination.");
                return;
            }
            if (startName === endName) {
                alert("Start and Destination cannot be the same.");
                return;
            }

            const startCoords = buildings[startName];
            const endCoords = buildings[endName];

            const startNode = findClosestGraphNode(startCoords[0], startCoords[1]);
            const endNode = findClosestGraphNode(endCoords[0], endCoords[1]);

            if (!startNode.key || !endNode.key) {
                alert("No walkway network detected nearby.");
                return;
            }

            const result = dijkstra(startNode.key, endNode.key);
            if (result.path.length < 2) {
                alert("No connected walking path found between these spots.");
                return;
            }

            currentRouteCoords = [startCoords, ...result.path, endCoords];
            const totalMeters = Math.round(result.totalDistance + startNode.dist + endNode.dist);

            if (activeRouteLayer) {
                map.removeLayer(activeRouteLayer);
            }

            // Glowing blue electric line
            activeRouteLayer = L.polyline(currentRouteCoords, {
                color: '#38bdf8',
                weight: 6,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
                className: 'active-nav-route'
            }).addTo(map);

            map.fitBounds(activeRouteLayer.getBounds(), { padding: [60, 60] });
            updateUserPosition(startCoords[0], startCoords[1], 8);

            if (routeOutput) {
                routeOutput.style.display = 'block';
                routeOutput.innerHTML = `Walking Distance: ~${totalMeters} meters<br>Estimated Time: ~${Math.ceil(totalMeters / 75)} mins`;
            }

            // Auto-collapse bottom card on mobile to reveal route
            if (window.innerWidth <= 640 && navPanel) {
                navPanel.classList.add('collapsed');
            }
        });
    }

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
                alert("Select endpoints and click 'Find Route' first.");
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

    if (clearRouteBtn) {
        clearRouteBtn.addEventListener('click', () => {
            if (activeRouteLayer) {
                map.removeLayer(activeRouteLayer);
                activeRouteLayer = null;
            }
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
            currentRouteCoords = [];
            if (startSelect) startSelect.value = '';
            if (endSelect) endSelect.value = '';
            if (routeOutput) routeOutput.style.display = 'none';
            map.setView(GIET_CENTER, 18);
        });
    }
});