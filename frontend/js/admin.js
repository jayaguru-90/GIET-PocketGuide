/**
 * GIET University Admin Spatial Management Studio
 * Complete Implementation:
 * - Native Draggable Walkway Nodes & Campus Building Pins
 * - Clickable Midpoint Handles (+) to Insert Vertices
 * - Right-Click / Contextmenu to Delete Vertices
 * - Dynamic Route Distance Calculations
 * - Magnetic Snapping across all Paths & Pins
 * - Live GeoJSON Import & Export Backup Engine
 */

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocal ? "http://127.0.0.1:8000" : "https://giet-campus-api.onrender.com";
const CAMPUS_VIEW = [19.0486, 83.8325];

let map = null;
let currentMode = "locations";

let pointMarkers = {};
let routeLines = {};
let temporaryMarker = null;

let isDrawingRoute = false;
let draftedRoutePoints = []; // [[lat, lng], ...]
let activeDrawPolyline = null;
let activeEditVertexMarkers = [];
let activeMidpointMarkers = [];
let editingRouteIndex = null;

const ADMIN_USER = "admin";
const ADMIN_PASS = "gietu@123";

// DOM references
const authModal = document.getElementById("auth-modal");
const adminWorkspace = document.getElementById("admin-workspace");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const authActionBtn = document.getElementById("auth-action-btn");
const authBtnText = document.getElementById("auth-btn-text");

const tabLocationsBtn = document.getElementById("tab-locations-btn");
const tabRoutesBtn = document.getElementById("tab-routes-btn");
const locationPanel = document.getElementById("location-panel");
const routePanel = document.getElementById("route-panel");

const locationForm = document.getElementById("location-form");
const locIdInput = document.getElementById("loc-id");
const locNameInput = document.getElementById("loc-name");
const locCatInput = document.getElementById("loc-category");
const locLatInput = document.getElementById("loc-lat");
const locLngInput = document.getElementById("loc-lng");
const formHeading = document.getElementById("form-heading");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

const routeForm = document.getElementById("route-form");
const routeIdInput = document.getElementById("route-id");
const routeNameInput = document.getElementById("route-name");
const routeTypeInput = document.getElementById("route-type");
const routeFormHeading = document.getElementById("route-form-heading");
const routeLiveDistance = document.getElementById("route-live-distance");
const startDrawingBtn = document.getElementById("start-drawing-btn");
const clearDrawingBtn = document.getElementById("clear-drawing-btn");
const saveRouteBtn = document.getElementById("save-route-btn");
const cancelRouteBtn = document.getElementById("cancel-route-btn");
const drawingInfo = document.getElementById("drawing-info");

const registryList = document.getElementById("registry-list");
const registryTitle = document.getElementById("registry-title");
const searchFilter = document.getElementById("search-filter");
const exportJsonBtn = document.getElementById("export-geojson-btn");
const importJsonInput = document.getElementById("import-geojson-input");
const mapModeText = document.getElementById("map-mode-text");

let serverGeoJSON = { type: "FeatureCollection", features: [] };

async function fetchServerDataset() {
    try {
        const res = await fetch(`${API_URL}/api/admin/features`);
        if (!res.ok) throw new Error("Backend offline");
        serverGeoJSON = await res.json();
        return serverGeoJSON;
    } catch {
        try {
            const fallbackRes = await fetch("assets/data/giet_campus.geojson");
            serverGeoJSON = await fallbackRes.json();
            return serverGeoJSON;
        } catch (err) {
            console.error("Critical error reading GeoJSON:", err);
            return serverGeoJSON;
        }
    }
}

function evaluateSession() {
    const isLoggedIn = sessionStorage.getItem("gietu_admin_logged_in") === "true";
    if (isLoggedIn) {
        authModal.classList.add("hidden");
        adminWorkspace.classList.remove("hidden");
        authBtnText.textContent = "Logout";
        setupMapEngine();
    } else {
        authModal.classList.remove("hidden");
        adminWorkspace.classList.add("hidden");
        authBtnText.textContent = "Admin Login";
    }
}

loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = document.getElementById("username").value.trim();
    const pass = document.getElementById("password").value.trim();

    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        sessionStorage.setItem("gietu_admin_logged_in", "true");
        loginError.textContent = "";
        evaluateSession();
    } else {
        loginError.textContent = "Invalid administrator credentials!";
    }
});

authActionBtn.addEventListener("click", () => {
    if (sessionStorage.getItem("gietu_admin_logged_in") === "true") {
        if (confirm("Log out of GIETU Map Studio?")) {
            sessionStorage.removeItem("gietu_admin_logged_in");
            evaluateSession();
        }
    } else {
        evaluateSession();
    }
});

tabLocationsBtn.addEventListener("click", () => {
    currentMode = "locations";
    tabLocationsBtn.classList.add("active");
    tabRoutesBtn.classList.remove("active");
    locationPanel.classList.remove("hidden");
    routePanel.classList.add("hidden");
    registryTitle.textContent = "Campus Points";
    mapModeText.innerHTML = `Mode: <strong>Point Placement & Doorway Positioning</strong>`;
    abortDrawing();
    renderAll(searchFilter.value);
});

tabRoutesBtn.addEventListener("click", () => {
    currentMode = "routes";
    tabRoutesBtn.classList.add("active");
    tabLocationsBtn.classList.remove("active");
    routePanel.classList.remove("hidden");
    locationPanel.classList.add("hidden");
    registryTitle.textContent = "Walkway Routes";
    mapModeText.innerHTML = `Mode: <strong>Walkway Corridors (Magnetic Snapping Active)</strong>`;
    if (temporaryMarker) {
        map.removeLayer(temporaryMarker);
        temporaryMarker = null;
    }
    renderAll(searchFilter.value);
});

// Magnetic Snap Helper: Snaps to existing walkways and pins within 12 meters
function snapToExistingNodeOrSegment(lat, lng, snapThresholdMeters = 12) {
    let closestCoord = [lat, lng];
    let minDistance = Infinity;

    (serverGeoJSON.features || []).forEach(feat => {
        if (feat.geometry) {
            if (feat.geometry.type === "LineString") {
                const coords = feat.geometry.coordinates;
                for (let i = 0; i < coords.length; i++) {
                    const nodeLat = coords[i][1];
                    const nodeLng = coords[i][0];
                    const d = map.distance([lat, lng], [nodeLat, nodeLng]);
                    if (d < snapThresholdMeters && d < minDistance) {
                        minDistance = d;
                        closestCoord = [nodeLat, nodeLng];
                    }
                }
            }
            if (feat.geometry.type === "Point") {
                const nodeLat = feat.geometry.coordinates[1];
                const nodeLng = feat.geometry.coordinates[0];
                const d = map.distance([lat, lng], [nodeLat, nodeLng]);
                if (d < snapThresholdMeters && d < minDistance) {
                    minDistance = d;
                    closestCoord = [nodeLat, nodeLng];
                }
            }
        }
    });

    return { coord: closestCoord, snapped: minDistance <= snapThresholdMeters };
}

function calculatePathDistance(points) {
    if (!points || points.length < 2) return 0;
    let dist = 0;
    for (let i = 0; i < points.length - 1; i++) {
        dist += map.distance(points[i], points[i + 1]);
    }
    return Math.round(dist);
}

function updateLiveDistanceBadge() {
    const dist = calculatePathDistance(draftedRoutePoints);
    if (routeLiveDistance) {
        routeLiveDistance.textContent = `Length: ${dist}m (${draftedRoutePoints.length} nodes)`;
    }
}

function setupMapEngine() {
    if (map) {
        setTimeout(() => map.invalidateSize(), 200);
        return;
    }

    map = L.map("admin-leaflet-map", {
        zoomControl: true,
        maxZoom: 22
    }).setView(CAMPUS_VIEW, 18);

    L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
        maxZoom: 22,
        maxNativeZoom: 20,
        attribution: "&copy; Google Satellite &mdash; GIET University"
    }).addTo(map);

    map.on("click", (e) => {
        let { lat, lng } = e.latlng;

        if (currentMode === "locations") {
            locLatInput.value = lat.toFixed(7);
            locLngInput.value = lng.toFixed(7);

            if (temporaryMarker) map.removeLayer(temporaryMarker);

            // Create a draggable placement pin
            const tempIcon = L.divIcon({
                className: 'temp-pin',
                html: `<div style="width: 16px; height: 16px; background: #ef4444; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 0 8px rgba(0,0,0,0.8); cursor: grab;"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });

            temporaryMarker = L.marker([lat, lng], { icon: tempIcon, draggable: true }).addTo(map);
            temporaryMarker.bindTooltip("Drag directly over the entrance door", { permanent: true, direction: "top" }).openTooltip();

            temporaryMarker.on("dragend", (ev) => {
                const pos = ev.target.getLatLng();
                locLatInput.value = pos.lat.toFixed(7);
                locLngInput.value = pos.lng.toFixed(7);
            });
        } else if (currentMode === "routes" && isDrawingRoute) {
            const snapResult = snapToExistingNodeOrSegment(lat, lng, 12);
            const [finalLat, finalLng] = snapResult.coord;

            draftedRoutePoints.push([finalLat, finalLng]);
            redrawDraftRoute();

            saveRouteBtn.disabled = draftedRoutePoints.length < 2;
            drawingInfo.innerHTML = `Nodes placed: <strong>${draftedRoutePoints.length}</strong> ${snapResult.snapped ? '<span style="color:#10b981;">(Magnetically welded!)</span>' : ''}`;
        }
    });

    renderAll();
}

function redrawDraftRoute() {
    if (activeDrawPolyline) map.removeLayer(activeDrawPolyline);
    activeEditVertexMarkers.forEach(m => map.removeLayer(m));
    activeMidpointMarkers.forEach(m => map.removeLayer(m));
    activeEditVertexMarkers = [];
    activeMidpointMarkers = [];

    if (draftedRoutePoints.length === 0) {
        updateLiveDistanceBadge();
        return;
    }

    activeDrawPolyline = L.polyline(draftedRoutePoints, {
        color: "#38bdf8",
        weight: 4.5,
        opacity: 0.95
    }).addTo(map);

    updateLiveDistanceBadge();

    // 1. Draggable Vertex Handles with Native Grab Events
    draftedRoutePoints.forEach((pt, pIdx) => {
        const handleIcon = L.divIcon({
            className: 'draggable-node-pin',
            html: `<div style="
                width: 14px; 
                height: 14px; 
                background: #ffffff; 
                border: 3px solid #0284c7; 
                border-radius: 50%; 
                cursor: grab;
                box-shadow: 0 0 6px rgba(0,0,0,0.6);
            "></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });

        const marker = L.marker(pt, {
            icon: handleIcon,
            draggable: true,
            interactive: true,
            zIndexOffset: 1000
        }).addTo(map);

        marker.bindTooltip(`Node #${pIdx + 1}<br><small style="color: #64748b;">Drag to move</small><br><small style="color: #ef4444;">Right-click to remove</small>`, {
            direction: 'top',
            offset: [0, -6]
        });

        marker.on("drag", (e) => {
            const newPos = e.target.getLatLng();
            draftedRoutePoints[pIdx] = [newPos.lat, newPos.lng];
            activeDrawPolyline.setLatLngs(draftedRoutePoints);
            updateLiveDistanceBadge();
        });

        marker.on("dragend", (e) => {
            const finalPos = e.target.getLatLng();
            const snap = snapToExistingNodeOrSegment(finalPos.lat, finalPos.lng, 12);

            draftedRoutePoints[pIdx] = snap.coord;
            marker.setLatLng(snap.coord);
            activeDrawPolyline.setLatLngs(draftedRoutePoints);
            redrawDraftRoute();
        });

        marker.on("contextmenu", (ev) => {
            L.DomEvent.stopPropagation(ev);
            if (draftedRoutePoints.length <= 2) {
                alert("A walkway requires at least 2 nodes.");
                return;
            }
            draftedRoutePoints.splice(pIdx, 1);
            redrawDraftRoute();
            saveRouteBtn.disabled = draftedRoutePoints.length < 2;
        });

        activeEditVertexMarkers.push(marker);
    });

    // 2. Clickable Midpoint (+) Handles to Split Segments
    for (let i = 0; i < draftedRoutePoints.length - 1; i++) {
        const p1 = draftedRoutePoints[i];
        const p2 = draftedRoutePoints[i + 1];
        const midLat = (p1[0] + p2[0]) / 2;
        const midLng = (p1[1] + p2[1]) / 2;

        const midMarker = L.circleMarker([midLat, midLng], {
            radius: 5,
            fillColor: "#38bdf8",
            color: "#ffffff",
            weight: 2,
            fillOpacity: 0.85
        }).addTo(map);

        midMarker.bindTooltip("Click to add node here", { direction: "top", offset: [0, -4] });

        midMarker.on("click", (ev) => {
            L.DomEvent.stopPropagation(ev);
            draftedRoutePoints.splice(i + 1, 0, [midLat, midLng]);
            redrawDraftRoute();
        });

        activeMidpointMarkers.push(midMarker);
    }
}

// Persistent Base Layer: Always renders both Points and Walkways
async function renderAll(searchTerm = "") {
    await fetchServerDataset();
    registryList.innerHTML = "";

    Object.values(pointMarkers).forEach(m => map.removeLayer(m));
    Object.values(routeLines).forEach(r => map.removeLayer(r));
    pointMarkers = {};
    routeLines = {};

    serverGeoJSON.features.forEach((feat, index) => {
        // Points Layer
        if (feat.geometry.type === "Point") {
            const [lng, lat] = feat.geometry.coordinates;
            const name = feat.properties.name || "Unnamed Point";
            const category = feat.properties.category || "Campus Site";

            const marker = L.circleMarker([lat, lng], {
                radius: 6,
                fillColor: "#3b82f6",
                color: "#ffffff",
                weight: 2,
                fillOpacity: 1
            }).addTo(map);

            marker.bindPopup(`
                <div style="font-family: Inter, sans-serif;">
                    <strong style="color: #1e3a8a;">${name}</strong><br>
                    <small style="color: #64748b;">${category}</small><br>
                    <button onclick="editPoint(${index})" style="margin-top: 6px; padding: 4px 8px; font-size: 0.75rem; border: none; background: #2563eb; color: white; border-radius: 4px; cursor: pointer;">
                        Edit / Drag Doorway
                    </button>
                </div>
            `);

            pointMarkers[index] = marker;

            if (currentMode === "locations") {
                if (name.toLowerCase().includes(searchTerm.toLowerCase()) || category.toLowerCase().includes(searchTerm.toLowerCase())) {
                    const el = document.createElement("div");
                    el.className = "reg-item";
                    el.innerHTML = `
                        <div class="reg-info">
                            <h5>${name}</h5>
                            <p>${category} • ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
                        </div>
                        <div class="reg-actions">
                            <button class="action-btn" onclick="editPoint(${index})" title="Edit"><i class="fa-solid fa-pen"></i></button>
                            <button class="action-btn del" onclick="removeFeature(${index})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    `;
                    registryList.appendChild(el);
                }
            }
        }

        // Walkways Layer
        if (feat.geometry.type === "LineString") {
            const name = feat.properties.name || "Walkway Corridor";
            const hwType = feat.properties.highway || "footway";
            const latlngs = feat.geometry.coordinates.map(c => [c[1], c[0]]);

            const isRoad = hwType === "road";
            const isStairs = hwType === "stairs";

            const polyline = L.polyline(latlngs, {
                color: isRoad ? "#f59e0b" : (isStairs ? "#ec4899" : "#38bdf8"),
                weight: isRoad ? 5 : 3.5,
                opacity: 0.85,
                dashArray: isRoad ? null : "4, 6"
            }).addTo(map);

            const dist = calculatePathDistance(latlngs);

            polyline.bindPopup(`
                <div style="font-family: Inter, sans-serif;">
                    <strong style="color: #0284c7;">${name}</strong><br>
                    <small style="color: #64748b;">${latlngs.length} Nodes • ${dist}m (${hwType})</small><br>
                    <div style="display: flex; gap: 6px; margin-top: 6px;">
                        <button onclick="editRoute(${index})" style="padding: 4px 8px; font-size: 0.75rem; border: none; background: #0284c7; color: white; border-radius: 4px; cursor: pointer;">
                            Edit
                        </button>
                        <button onclick="mergeWithNext(${index})" style="padding: 4px 8px; font-size: 0.75rem; border: 1px solid #0284c7; background: transparent; color: #0284c7; border-radius: 4px; cursor: pointer;" title="Merge with connecting path">
                            Merge
                        </button>
                    </div>
                </div>
            `);

            routeLines[index] = polyline;

            if (currentMode === "routes") {
                if (name.toLowerCase().includes(searchTerm.toLowerCase())) {
                    const el = document.createElement("div");
                    el.className = "reg-item";
                    el.innerHTML = `
                        <div class="reg-info">
                            <h5>${name}</h5>
                            <p>${latlngs.length} Nodes • ${dist}m (${hwType})</p>
                        </div>
                        <div class="reg-actions">
                            <button class="action-btn" onclick="editRoute(${index})" title="Edit"><i class="fa-solid fa-pen"></i></button>
                            <button class="action-btn del" onclick="removeFeature(${index})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    `;
                    registryList.appendChild(el);
                }
            }
        }
    });
}

// Point Form
locationForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const idVal = locIdInput.value;
    const name = locNameInput.value.trim();
    const category = locCatInput.value;
    const lat = parseFloat(locLatInput.value);
    const lng = parseFloat(locLngInput.value);

    if (!name || isNaN(lat) || isNaN(lng)) return;

    try {
        const payload = {
            id: idVal !== "" ? parseInt(idVal) : null,
            name: name,
            category: category,
            latitude: lat,
            longitude: lng
        };

        const res = await fetch(`${API_URL}/api/admin/save-point`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Could not sync with backend");
        resetPointForm();
        if (temporaryMarker) {
            map.removeLayer(temporaryMarker);
            temporaryMarker = null;
        }
        await renderAll(searchFilter.value);
    } catch (err) {
        alert("Notice: " + err.message);
    }
});

window.editPoint = function(index) {
    if (currentMode !== "locations") tabLocationsBtn.click();
    const feat = serverGeoJSON.features[index];
    if (!feat) return;

    locIdInput.value = index;
    locNameInput.value = feat.properties.name || "";
    locCatInput.value = feat.properties.category || "Academic";
    locLatInput.value = feat.geometry.coordinates[1];
    locLngInput.value = feat.geometry.coordinates[0];

    formHeading.textContent = "Reposition Location";
    cancelEditBtn.classList.remove("hidden");

    if (temporaryMarker) map.removeLayer(temporaryMarker);

    const tempIcon = L.divIcon({
        className: 'temp-pin',
        html: `<div style="width: 18px; height: 18px; background: #ef4444; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.9); cursor: grab;"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });

    temporaryMarker = L.marker([feat.geometry.coordinates[1], feat.geometry.coordinates[0]], {
        icon: tempIcon,
        draggable: true
    }).addTo(map);

    temporaryMarker.bindTooltip("Drag directly over the building doorway", { permanent: true, direction: "top" }).openTooltip();

    temporaryMarker.on("dragend", (ev) => {
        const pos = ev.target.getLatLng();
        locLatInput.value = pos.lat.toFixed(7);
        locLngInput.value = pos.lng.toFixed(7);
    });

    map.setView([feat.geometry.coordinates[1], feat.geometry.coordinates[0]], 19);
};

function resetPointForm() {
    locationForm.reset();
    locIdInput.value = "";
    formHeading.textContent = "Add Campus Location";
    cancelEditBtn.classList.add("hidden");
    if (temporaryMarker) {
        map.removeLayer(temporaryMarker);
        temporaryMarker = null;
    }
}

cancelEditBtn.addEventListener("click", resetPointForm);

// Route Form
startDrawingBtn.addEventListener("click", () => {
    isDrawingRoute = !isDrawingRoute;
    if (isDrawingRoute) {
        startDrawingBtn.classList.add("btn-danger");
        startDrawingBtn.innerHTML = `<i class="fa-solid fa-hand"></i> <span>Drawing Active</span>`;
        clearDrawingBtn.classList.remove("hidden");
        mapModeText.innerHTML = `Mode: <strong>Click map to place nodes. Click (+) on lines to insert.</strong>`;
    } else {
        startDrawingBtn.classList.remove("btn-danger");
        startDrawingBtn.innerHTML = `<i class="fa-solid fa-pen-nib"></i> <span>Draw Path</span>`;
        mapModeText.innerHTML = `Mode: <strong>Walkway Corridors</strong>`;
    }
});

clearDrawingBtn.addEventListener("click", abortDrawing);

function abortDrawing() {
    isDrawingRoute = false;
    draftedRoutePoints = [];
    if (activeDrawPolyline) {
        map.removeLayer(activeDrawPolyline);
        activeDrawPolyline = null;
    }
    activeEditVertexMarkers.forEach(m => map.removeLayer(m));
    activeMidpointMarkers.forEach(m => map.removeLayer(m));
    activeEditVertexMarkers = [];
    activeMidpointMarkers = [];

    startDrawingBtn.classList.remove("btn-danger");
    startDrawingBtn.innerHTML = `<i class="fa-solid fa-pen-nib"></i> <span>Draw Path</span>`;
    clearDrawingBtn.classList.add("hidden");
    saveRouteBtn.disabled = true;
    drawingInfo.innerHTML = `Click <strong>Draw Path</strong>, then click along walkways on the map to add nodes.`;
    updateLiveDistanceBadge();
}

window.editRoute = function(index) {
    if (currentMode !== "routes") tabRoutesBtn.click();
    abortDrawing();

    const feat = serverGeoJSON.features[index];
    if (!feat || feat.geometry.type !== "LineString") return;

    editingRouteIndex = index;
    routeIdInput.value = index;
    routeNameInput.value = feat.properties.name || "";
    if (routeTypeInput) routeTypeInput.value = feat.properties.highway || "footway";
    routeFormHeading.textContent = "Edit Walkway Corridor";
    cancelRouteBtn.classList.remove("hidden");
    clearDrawingBtn.classList.remove("hidden");

    draftedRoutePoints = feat.geometry.coordinates.map(c => [c[1], c[0]]);
    redrawDraftRoute();

    saveRouteBtn.disabled = false;
    drawingInfo.innerHTML = `Editing: <strong>${feat.properties.name}</strong>. Drag nodes, right-click to delete, or click (+) to add midpoint.`;
    if (activeDrawPolyline) {
        map.fitBounds(activeDrawPolyline.getBounds(), { padding: [40, 40] });
    }
};

// Stitch two connecting segments into a single LineString
window.mergeWithNext = async function(index) {
    const feat = serverGeoJSON.features[index];
    if (!feat || feat.geometry.type !== "LineString") return;

    const coords1 = feat.geometry.coordinates;
    const endCoord = coords1[coords1.length - 1];

    let foundIndex = null;
    let reverseMatch = false;

    serverGeoJSON.features.forEach((f, idx) => {
        if (idx !== index && f.geometry && f.geometry.type === "LineString") {
            const c = f.geometry.coordinates;
            if (map.distance([endCoord[1], endCoord[0]], [c[0][1], c[0][0]]) < 10) {
                foundIndex = idx;
                reverseMatch = false;
            } else if (map.distance([endCoord[1], endCoord[0]], [c[c.length - 1][1], c[c.length - 1][0]]) < 10) {
                foundIndex = idx;
                reverseMatch = true;
            }
        }
    });

    if (foundIndex === null) {
        alert("No adjoining walkway detected within 10 meters of this path's endpoint.");
        return;
    }

    const nextFeat = serverGeoJSON.features[foundIndex];
    if (confirm(`Merge "${feat.properties.name}" with adjoining "${nextFeat.properties.name}" into one continuous line?`)) {
        let coords2 = nextFeat.geometry.coordinates;
        if (reverseMatch) coords2 = coords2.slice().reverse();

        const merged = coords1.concat(coords2.slice(1));
        const payload = {
            id: index,
            name: `${feat.properties.name} (Merged)`,
            highway: feat.properties.highway || "footway",
            coordinates: merged
        };

        await fetch(`${API_URL}/api/admin/save-route`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        await fetch(`${API_URL}/api/admin/feature/${foundIndex}`, { method: "DELETE" });
        await renderAll();
        alert("Walkways successfully welded into a single line!");
    }
};

routeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = routeNameInput.value.trim();
    const hwType = routeTypeInput ? routeTypeInput.value : "footway";
    if (!name || draftedRoutePoints.length < 2) return;

    try {
        const geoCoordinates = draftedRoutePoints.map(p => [p[1], p[0]]);
        const payload = {
            id: routeIdInput.value !== "" ? parseInt(routeIdInput.value) : null,
            name: name,
            highway: hwType,
            coordinates: geoCoordinates
        };

        const res = await fetch(`${API_URL}/api/admin/save-route`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Could not sync with backend");
        resetRouteForm();
        await renderAll(searchFilter.value);
    } catch (err) {
        alert("Notice: " + err.message);
    }
});

function resetRouteForm() {
    routeForm.reset();
    routeIdInput.value = "";
    editingRouteIndex = null;
    routeFormHeading.textContent = "Walkway Route Builder";
    cancelRouteBtn.classList.add("hidden");
    abortDrawing();
}

cancelRouteBtn.addEventListener("click", resetRouteForm);

window.removeFeature = async function(index) {
    const feat = serverGeoJSON.features[index];
    if (!feat) return;

    if (confirm(`Delete "${feat.properties.name}" permanently?`)) {
        try {
            const res = await fetch(`${API_URL}/api/admin/feature/${index}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Could not delete");
            await renderAll(searchFilter.value);
        } catch (err) {
            alert("Notice: " + err.message);
        }
    }
};

searchFilter.addEventListener("input", (e) => {
    renderAll(e.target.value);
});

// Clipboard Export
exportJsonBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(JSON.stringify(serverGeoJSON, null, 2));
    alert("Full GeoJSON copied to clipboard!");
});

// File Import & Restore
if (importJsonInput) {
    importJsonInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
                    throw new Error("Invalid GeoJSON schema (must be FeatureCollection)");
                }

                if (confirm(`Import ${parsed.features.length} features? This will update your campus registry.`)) {
                    const res = await fetch(`${API_URL}/api/admin/import-geojson`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(parsed)
                    });

                    if (!res.ok) throw new Error("Backend could not save imported GeoJSON");
                    alert("GeoJSON successfully imported!");
                    await renderAll();
                }
            } catch (err) {
                alert("Import failed: " + err.message);
            }
        };
        reader.readAsText(file);
    });
}

evaluateSession();