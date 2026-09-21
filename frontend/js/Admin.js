/**
 * GIET University Admin Spatial Management Engine
 * Dual-Mode Location and Route/Walkway Interactive Editor (FastAPI Integrated)
 */

const API_URL = "http://127.0.0.1:8000";
const CAMPUS_VIEW = [19.0486, 83.8325];

let map = null;
let currentMode = "locations"; // "locations" or "routes"

// Layer trackers
let pointMarkers = {};
let routeLines = {};
let temporaryMarker = null;

// Route Drawing & Editing States
let isDrawingRoute = false;
let draftedRoutePoints = []; // [[lat, lng], ...]
let activeDrawPolyline = null;
let activeEditVertexMarkers = [];
let editingRouteIndex = null;

const ADMIN_USER = "admin";
const ADMIN_PASS = "gietu@123";

// DOM References
const authModal = document.getElementById("auth-modal");
const adminWorkspace = document.getElementById("admin-workspace");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const authActionBtn = document.getElementById("auth-action-btn");
const authBtnText = document.getElementById("auth-btn-text");

// Tabs
const tabLocationsBtn = document.getElementById("tab-locations-btn");
const tabRoutesBtn = document.getElementById("tab-routes-btn");
const locationPanel = document.getElementById("location-panel");
const routePanel = document.getElementById("route-panel");

// Location Form
const locationForm = document.getElementById("location-form");
const locIdInput = document.getElementById("loc-id");
const locNameInput = document.getElementById("loc-name");
const locCatInput = document.getElementById("loc-category");
const locLatInput = document.getElementById("loc-lat");
const locLngInput = document.getElementById("loc-lng");
const formHeading = document.getElementById("form-heading");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

// Route Form
const routeForm = document.getElementById("route-form");
const routeIdInput = document.getElementById("route-id");
const routeNameInput = document.getElementById("route-name");
const routeFormHeading = document.getElementById("route-form-heading");
const startDrawingBtn = document.getElementById("start-drawing-btn");
const clearDrawingBtn = document.getElementById("clear-drawing-btn");
const saveRouteBtn = document.getElementById("save-route-btn");
const cancelRouteBtn = document.getElementById("cancel-route-btn");
const drawingInfo = document.getElementById("drawing-info");

// Directory
const registryList = document.getElementById("registry-list");
const registryTitle = document.getElementById("registry-title");
const registryStats = document.getElementById("registry-stats");
const searchFilter = document.getElementById("search-filter");
const exportJsonBtn = document.getElementById("export-geojson-btn");
const mapModeText = document.getElementById("map-mode-text");

// Live GeoJSON cache loaded from backend
let serverGeoJSON = { type: "FeatureCollection", features: [] };

async function fetchServerDataset() {
    try {
        const res = await fetch(`${API_URL}/api/admin/features`);
        if (!res.ok) throw new Error("Failed to fetch campus data from server");
        serverGeoJSON = await res.json();
        return serverGeoJSON;
    } catch (err) {
        console.error("Backend Error:", err);
        alert("Error connecting to FastAPI backend. Ensure uvicorn is running.");
        return serverGeoJSON;
    }
}

// Session
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
        authBtnText.textContent = "Admin Portal";
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
        if (confirm("Log out of GIETU Admin Portal?")) {
            sessionStorage.removeItem("gietu_admin_logged_in");
            evaluateSession();
        }
    } else {
        evaluateSession();
    }
});

// Mode Switching
tabLocationsBtn.addEventListener("click", () => {
    currentMode = "locations";
    tabLocationsBtn.classList.add("active");
    tabRoutesBtn.classList.remove("active");
    locationPanel.classList.remove("hidden");
    routePanel.classList.add("hidden");
    registryTitle.textContent = "Campus Points";
    mapModeText.innerHTML = `Mode: <strong>Point Placement / Inspection</strong>`;
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
    mapModeText.innerHTML = `Mode: <strong>Walkway Corridors</strong>`;
    if (temporaryMarker) {
        map.removeLayer(temporaryMarker);
        temporaryMarker = null;
    }
    renderAll(searchFilter.value);
});

// Map Engine
function setupMapEngine() {
    if (map) {
        setTimeout(() => map.invalidateSize(), 200);
        return;
    }

    map = L.map("admin-leaflet-map", {
        zoomControl: true,
        maxZoom: 22
    }).setView(CAMPUS_VIEW, 18);

    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 22,
        maxNativeZoom: 20,
        attribution: '&copy; Google Satellite &mdash; GIET University'
    }).addTo(map);

    // Map Click Handler
    map.on("click", (e) => {
        const { lat, lng } = e.latlng;

        if (currentMode === "locations") {
            locLatInput.value = lat.toFixed(7);
            locLngInput.value = lng.toFixed(7);

            if (temporaryMarker) map.removeLayer(temporaryMarker);

            temporaryMarker = L.circleMarker([lat, lng], {
                radius: 8,
                fillColor: "#ef4444",
                color: "#ffffff",
                weight: 2.5,
                fillOpacity: 1
            }).addTo(map);
        } 
        else if (currentMode === "routes" && isDrawingRoute) {
            draftedRoutePoints.push([lat, lng]);

            if (activeDrawPolyline) map.removeLayer(activeDrawPolyline);

            activeDrawPolyline = L.polyline(draftedRoutePoints, {
                color: "#38bdf8",
                weight: 4,
                opacity: 0.95
            }).addTo(map);

            const vMarker = L.circleMarker([lat, lng], {
                radius: 5,
                fillColor: "#ffffff",
                color: "#0284c7",
                weight: 2,
                fillOpacity: 1
            }).addTo(map);
            activeEditVertexMarkers.push(vMarker);

            saveRouteBtn.disabled = draftedRoutePoints.length < 2;
            drawingInfo.innerHTML = `Points drawn: <strong>${draftedRoutePoints.length}</strong>. Click the next point on the road or click <strong>Save Route</strong> when finished.`;
        }
    });

    renderAll();
}

async function renderAll(searchTerm = "") {
    await fetchServerDataset();
    registryList.innerHTML = "";

    // Clear previous points & lines
    Object.values(pointMarkers).forEach(m => map.removeLayer(m));
    Object.values(routeLines).forEach(r => map.removeLayer(r));
    pointMarkers = {};
    routeLines = {};

    let ptCount = 0;
    let rtCount = 0;

    serverGeoJSON.features.forEach((feat, index) => {
        // 1. RENDER POINT
        if (feat.geometry.type === "Point") {
            ptCount++;
            const [lng, lat] = feat.geometry.coordinates;
            const name = feat.properties.name || "Unnamed Point";
            const category = feat.properties.category || "Campus Site";

            const marker = L.circleMarker([lat, lng], {
                radius: 6,
                fillColor: "#2563eb",
                color: "#ffffff",
                weight: 2,
                fillOpacity: 1
            }).addTo(map);

            marker.bindTooltip(`
                <span class="campus-map-badge">
                    <span class="badge-dot"></span>
                    ${name}
                </span>
            `, {
                permanent: true,
                direction: "top",
                offset: [0, -8],
                className: "custom-leaflet-tooltip"
            });

            marker.bindPopup(`
                <div style="font-family: Inter, sans-serif;">
                    <strong style="color: #1e3a8a;">${name}</strong><br>
                    <small style="color: #64748b;">${category}</small><br>
                    <button onclick="editPoint(${index})" style="margin-top: 6px; padding: 4px 8px; font-size: 0.75rem; border: none; background: #2563eb; color: white; border-radius: 4px; cursor: pointer;">
                        Edit Point
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
                            <span class="badge" style="font-size:0.65rem; padding: 2px 6px;">${category}</span>
                            <h5>${name}</h5>
                            <p>${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
                        </div>
                        <div class="reg-actions">
                            <button class="action-btn edit" onclick="editPoint(${index})" title="Edit">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="action-btn del" onclick="removeFeature(${index})" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    `;
                    registryList.appendChild(el);
                }
            }
        }

        // 2. RENDER LINESTRING (ROUTE)
        if (feat.geometry.type === "LineString") {
            rtCount++;
            const name = feat.properties.name || "Walkway Corridor";
            const latlngs = feat.geometry.coordinates.map(c => [c[1], c[0]]);

            const polyline = L.polyline(latlngs, {
                color: "#38bdf8",
                weight: 4,
                opacity: 0.85,
                dashArray: "3, 6"
            }).addTo(map);

            polyline.bindPopup(`
                <div style="font-family: Inter, sans-serif;">
                    <strong style="color: #0284c7;">${name}</strong><br>
                    <small style="color: #64748b;">${latlngs.length} Points Along Corridor</small><br>
                    <button onclick="editRoute(${index})" style="margin-top: 6px; padding: 4px 8px; font-size: 0.75rem; border: none; background: #0284c7; color: white; border-radius: 4px; cursor: pointer;">
                        Edit Route
                    </button>
                </div>
            `);

            routeLines[index] = polyline;

            if (currentMode === "routes") {
                if (name.toLowerCase().includes(searchTerm.toLowerCase())) {
                    const el = document.createElement("div");
                    el.className = "reg-item";
                    el.innerHTML = `
                        <div class="reg-info">
                            <span class="badge" style="font-size:0.65rem; padding: 2px 6px; background:#e0f2fe; color:#0284c7;">Route</span>
                            <h5>${name}</h5>
                            <p>${latlngs.length} Coordinate Nodes</p>
                        </div>
                        <div class="reg-actions">
                            <button class="action-btn edit" onclick="editRoute(${index})" title="Edit Route">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="action-btn del" onclick="removeFeature(${index})" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    `;
                    registryList.appendChild(el);
                }
            }
        }
    });

    registryStats.textContent = currentMode === "locations" ? `${ptCount} campus points` : `${rtCount} pedestrian corridors`;
}

// ================= POINT CRUD (FASTAPI) =================
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
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Could not save point");

        resetPointForm();
        if (temporaryMarker) {
            map.removeLayer(temporaryMarker);
            temporaryMarker = null;
        }
        await renderAll(searchFilter.value);
    } catch (err) {
        alert("Error saving location: " + err.message);
    }
});

window.editPoint = function(index) {
    if (currentMode !== "locations") {
        tabLocationsBtn.click();
    }
    const feat = serverGeoJSON.features[index];
    if (!feat) return;

    locIdInput.value = index;
    locNameInput.value = feat.properties.name || "";
    locCatInput.value = feat.properties.category || "Academic";
    locLatInput.value = feat.geometry.coordinates[1];
    locLngInput.value = feat.geometry.coordinates[0];

    formHeading.textContent = "Rename / Edit Point";
    cancelEditBtn.classList.remove("hidden");

    map.setView([feat.geometry.coordinates[1], feat.geometry.coordinates[0]], 19);
    if (pointMarkers[index]) pointMarkers[index].openPopup();
};

function resetPointForm() {
    locationForm.reset();
    locIdInput.value = "";
    formHeading.textContent = "Add Location";
    cancelEditBtn.classList.add("hidden");
}

cancelEditBtn.addEventListener("click", resetPointForm);

// ================= ROUTE CRUD (FASTAPI) =================
startDrawingBtn.addEventListener("click", () => {
    isDrawingRoute = !isDrawingRoute;
    if (isDrawingRoute) {
        startDrawingBtn.classList.add("active");
        startDrawingBtn.innerHTML = `<i class="fa-solid fa-hand"></i> <span>Drawing Active</span>`;
        clearDrawingBtn.classList.remove("hidden");
        mapModeText.innerHTML = `Mode: <strong>Click anywhere on paths to draft route points</strong>`;
    } else {
        startDrawingBtn.classList.remove("active");
        startDrawingBtn.innerHTML = `<i class="fa-solid fa-pen-nib"></i> <span>Draw Path</span>`;
        mapModeText.innerHTML = `Mode: <strong>Walkway Corridors</strong>`;
    }
});

clearDrawingBtn.addEventListener("click", () => {
    abortDrawing();
});

function abortDrawing() {
    isDrawingRoute = false;
    draftedRoutePoints = [];
    if (activeDrawPolyline) {
        map.removeLayer(activeDrawPolyline);
        activeDrawPolyline = null;
    }
    activeEditVertexMarkers.forEach(m => map.removeLayer(m));
    activeEditVertexMarkers = [];

    startDrawingBtn.classList.remove("active");
    startDrawingBtn.innerHTML = `<i class="fa-solid fa-pen-nib"></i> <span>Draw Path</span>`;
    clearDrawingBtn.classList.add("hidden");
    saveRouteBtn.disabled = true;
    drawingInfo.innerHTML = `<i class="fa-solid fa-circle-info"></i> Click <strong>Draw Path</strong>, then click along walkways on the map to construct vertex points.`;
}

window.editRoute = function(index) {
    if (currentMode !== "routes") {
        tabRoutesBtn.click();
    }
    abortDrawing();

    const feat = serverGeoJSON.features[index];
    if (!feat || feat.geometry.type !== "LineString") return;

    editingRouteIndex = index;
    routeIdInput.value = index;
    routeNameInput.value = feat.properties.name || "";
    routeFormHeading.textContent = "Edit Walkway Corridor";
    cancelRouteBtn.classList.remove("hidden");
    clearDrawingBtn.classList.remove("hidden");

    draftedRoutePoints = feat.geometry.coordinates.map(c => [c[1], c[0]]);

    if (activeDrawPolyline) map.removeLayer(activeDrawPolyline);
    activeDrawPolyline = L.polyline(draftedRoutePoints, {
        color: "#f59e0b",
        weight: 5,
        opacity: 1
    }).addTo(map);

    draftedRoutePoints.forEach((pt, pIdx) => {
        const marker = L.circleMarker(pt, {
            radius: 6,
            fillColor: "#ffffff",
            color: "#d97706",
            weight: 2,
            fillOpacity: 1,
            interactive: true
        }).addTo(map);

        let isDragging = false;
        marker.on("mousedown", () => {
            isDragging = true;
            map.dragging.disable();
            const onMove = (e) => {
                if (!isDragging) return;
                marker.setLatLng(e.latlng);
                draftedRoutePoints[pIdx] = [e.latlng.lat, e.latlng.lng];
                activeDrawPolyline.setLatLngs(draftedRoutePoints);
            };
            const onUp = () => {
                isDragging = false;
                map.dragging.enable();
                map.off("mousemove", onMove);
                map.off("mouseup", onUp);
            };
            map.on("mousemove", onMove);
            map.on("mouseup", onUp);
        });

        activeEditVertexMarkers.push(marker);
    });

    saveRouteBtn.disabled = false;
    drawingInfo.innerHTML = `Editing: <strong>${feat.properties.name}</strong>. Drag any yellow handle along the route to adjust path turning points.`;
    map.fitBounds(activeDrawPolyline.getBounds(), { padding: [40, 40] });
};

routeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = routeNameInput.value.trim();
    if (!name || draftedRoutePoints.length < 2) return;

    try {
        const geoCoordinates = draftedRoutePoints.map(p => [p[1], p[0]]);
        const payload = {
            id: routeIdInput.value !== "" ? parseInt(routeIdInput.value) : null,
            name: name,
            coordinates: geoCoordinates
        };

        const res = await fetch(`${API_URL}/api/admin/save-route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Could not save route");

        resetRouteForm();
        await renderAll(searchFilter.value);
    } catch (err) {
        alert("Error saving walkway route: " + err.message);
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

// Universal Remove (Points or Routes via FastAPI)
window.removeFeature = async function(index) {
    const feat = serverGeoJSON.features[index];
    if (!feat) return;

    if (confirm(`Are you sure you want to remove "${feat.properties.name}" permanently?`)) {
        try {
            const res = await fetch(`${API_URL}/api/admin/feature/${index}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Could not delete");

            await renderAll(searchFilter.value);
        } catch (err) {
            alert("Delete Error: " + err.message);
        }
    }
};

searchFilter.addEventListener("input", (e) => {
    renderAll(e.target.value);
});

exportJsonBtn.addEventListener("click", () => {
    const data = JSON.stringify(serverGeoJSON, null, 2);
    navigator.clipboard.writeText(data);
    alert("Live server GeoJSON copied to your clipboard!");
});

evaluateSession();