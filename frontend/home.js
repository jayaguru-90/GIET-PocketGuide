// 1. Initialize Map centered on GIET University Gunupur
const GIET_CENTER = [19.0485, 83.8320];
const map = L.map('map').setView(GIET_CENTER, 17);

// Free OpenStreetMap base tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// DOM Elements
const startSelect = document.getElementById('start-select');
const endSelect = document.getElementById('end-select');
const findRouteBtn = document.getElementById('find-route-btn');
const clearRouteBtn = document.getElementById('clear-route-btn');
const routeOutput = document.getElementById('route-output');

// Graph Data Structures
let buildings = {};        // Stores marker locations: { "Name": [lat, lng] }
let graph = {};            // Adjacency list: { "lat,lng": [ { node: "lat,lng", dist: meters, coord: [lat, lng] } ] }
let allGraphNodes = [];    // List of all road intersection points
let activeRouteLayer = null;

// Distance calculation helper (Haversine formula in meters)
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

// Convert coordinates to standard Node Key string
function toKey(lat, lng) {
    return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

// Add bidirectional edge between two vertices
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

// Find nearest node on the road network to any pin
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

// 2. Fetch GeoJSON and Build Network Graph
fetch('giet_campus.geojson')
    .then(res => {
        if (!res.ok) throw new Error("giet_campus.geojson not found in frontend/");
        return res.json();
    })
    .then(data => {
        // Step A: Parse drawn paths & add to graph
        data.features.forEach(feature => {
            if (feature.geometry.type === 'LineString') {
                const coords = feature.geometry.coordinates; // [ [lng, lat], ... ]
                for (let i = 0; i < coords.length - 1; i++) {
                    const u = [coords[i][1], coords[i][0]];
                    const v = [coords[i + 1][1], coords[i + 1][0]];
                    addEdge(toKey(u[0], u[1]), toKey(v[0], v[1]), u, v);
                }
            }
        });

        // Step B: Auto-bridge disconnected junctions (bridges gaps up to 35 meters)
        for (let i = 0; i < allGraphNodes.length; i++) {
            const [lat1, lng1] = allGraphNodes[i].split(',').map(Number);
            for (let j = i + 1; j < allGraphNodes.length; j++) {
                const [lat2, lng2] = allGraphNodes[j].split(',').map(Number);
                const d = getDistance(lat1, lng1, lat2, lng2);
                if (d < 35) {
                    addEdge(allGraphNodes[i], allGraphNodes[j], [lat1, lng1], [lat2, lng2]);
                }
            }
        }

        // Step C: Render paths and building markers
        L.geoJSON(data, {
            style: (feature) => {
                if (feature.geometry.type === 'LineString') {
                    return { color: '#2563eb', weight: 4, opacity: 0.85 };
                }
                return { color: '#10b981', weight: 2 };
            },
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, {
                    radius: 6,
                    fillColor: '#ef4444',
                    color: '#ffffff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.9
                });
            },
            onEachFeature: (feature, layer) => {
                const name = feature.properties?.name;
                if (feature.geometry.type === 'Point' && name) {
                    const lat = feature.geometry.coordinates[1];
                    const lng = feature.geometry.coordinates[0];
                    buildings[name] = [lat, lng];

                    layer.bindPopup(`<b>${name}</b>`);

                    // Populate Select options
                    const opt1 = document.createElement('option');
                    opt1.value = name;
                    opt1.textContent = name;
                    startSelect.appendChild(opt1);

                    const opt2 = document.createElement('option');
                    opt2.value = name;
                    opt2.textContent = name;
                    endSelect.appendChild(opt2);
                }
            }
        }).addTo(map);
    })
    .catch(err => {
        console.error("GeoJSON Error:", err);
    });

// 3. Dijkstra Shortest-Path Algorithm
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

// 4. Handle "Find Route" Action
findRouteBtn.addEventListener('click', () => {
    const startName = startSelect.value;
    const endName = endSelect.value;

    if (!startName || !endName) {
        alert("Please select both Start and Destination.");
        return;
    }

    if (startName === endName) {
        alert("Start and Destination cannot be the same place.");
        return;
    }

    const startCoords = buildings[startName];
    const endCoords = buildings[endName];

    const startNode = findClosestGraphNode(startCoords[0], startCoords[1]);
    const endNode = findClosestGraphNode(endCoords[0], endCoords[1]);

    if (!startNode.key || !endNode.key) {
        alert("Could not locate route path near these points.");
        return;
    }

    const result = dijkstra(startNode.key, endNode.key);

    if (result.path.length < 2) {
        alert("No connected walking path found between these locations.");
        return;
    }

    // Connect POI pins to path network
    const fullRoute = [startCoords, ...result.path, endCoords];
    const totalMeters = Math.round(result.totalDistance + startNode.dist + endNode.dist);

    if (activeRouteLayer) {
        map.removeLayer(activeRouteLayer);
    }

    // Highlight active pedestrian route
    activeRouteLayer = L.polyline(fullRoute, {
        color: '#dc2626',
        weight: 6,
        opacity: 0.95
    }).addTo(map);

    map.fitBounds(activeRouteLayer.getBounds(), { padding: [50, 50] });

    routeOutput.style.display = 'block';
    routeOutput.innerHTML = `Walking Distance: ~${totalMeters} meters<br>Estimated Time: ~${Math.ceil(totalMeters / 75)} mins`;
});

// 5. Clear Active Route
clearRouteBtn.addEventListener('click', () => {
    if (activeRouteLayer) {
        map.removeLayer(activeRouteLayer);
        activeRouteLayer = null;
    }
    startSelect.value = '';
    endSelect.value = '';
    routeOutput.style.display = 'none';
    map.setView(GIET_CENTER, 17);
});