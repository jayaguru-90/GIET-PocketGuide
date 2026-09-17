/**
 * GIET University Admin Spatial Management Engine
 * Dual-Mode Location and Route/Walkway Interactive Editor
 */

const INITIAL_GEOJSON = {
  "type": "FeatureCollection",
  "features": [
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8315621, 19.0484843, 0] }, "properties": { "name": "CSE Building", "category": "Academic" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8317289, 19.0491051, 0] }, "properties": { "name": "BSH Building", "category": "Academic" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8307759, 19.0486052, 0] }, "properties": { "name": "GIET Temple", "category": "Amenities" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.831949, 19.0494422, 0] }, "properties": { "name": "AME", "category": "Academic" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8323966, 19.0499166, 0] }, "properties": { "name": "Bio tech Building", "category": "Academic" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8327545, 19.0496662, 0] }, "properties": { "name": "RDB Building", "category": "Academic" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8323803, 19.0492385, 0] }, "properties": { "name": "Library", "category": "Academic" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8324027, 19.0495653, 0] }, "properties": { "name": "ECE Block", "category": "Academic" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8323102, 19.0481287, 0] }, "properties": { "name": "Admin Block", "category": "Academic" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8333488, 19.0487696, 0] }, "properties": { "name": "Agriculture Block", "category": "Academic" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8333083, 19.0494166, 0] }, "properties": { "name": "Mechanical building", "category": "Academic" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8338592, 19.0485406, 0] }, "properties": { "name": "Hardware section", "category": "Academic" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8330964, 19.0481867, 0] }, "properties": { "name": "Canteen", "category": "Amenities" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8311909, 19.0474079, 0] }, "properties": { "name": "Main Gate", "category": "Gate / Road" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8313916, 19.0474252, 0] }, "properties": { "name": "Parking", "category": "Amenities" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8327627, 19.0490728, 0] }, "properties": { "name": "Cool Parloor", "category": "Amenities" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8319928, 19.0493369, 0] }, "properties": { "name": "CSA block", "category": "Academic" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8322256, 19.0494327, 0] }, "properties": { "name": "Dept. Manegment", "category": "Academic" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8338431, 19.048839, 0] }, "properties": { "name": "Bus-stop ", "category": "Gate / Road" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8311413, 19.0482229, 0] }, "properties": { "name": "Temple Garden/Open Gym", "category": "Amenities" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8375139, 19.0464626, 0] }, "properties": { "name": "GPS School ", "category": "Academic" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8357854, 19.0481121, 0] }, "properties": { "name": "Guest House ", "category": "Amenities" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8333334, 19.0497383, 0] }, "properties": { "name": "Swimming pool", "category": "Sports" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8335484, 19.0494991, 0] }, "properties": { "name": "Badminton court", "category": "Sports" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8337963, 19.0491213, 0] }, "properties": { "name": "Basket ball court", "category": "Sports" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8348255, 19.0494455, 0] }, "properties": { "name": "Giet main ground ", "category": "Sports" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8333162, 19.048406, 0] }, "properties": { "name": "Car parking", "category": "Amenities" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8341547, 19.0481938, 0] }, "properties": { "name": "NC-8", "category": "Hostel / Mess" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8342341, 19.0478023, 0] }, "properties": { "name": "NC-9", "category": "Hostel / Mess" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8344851, 19.0476786, 0] }, "properties": { "name": "NC-10", "category": "Hostel / Mess" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8346289, 19.047421, 0] }, "properties": { "name": "NC-13", "category": "Hostel / Mess" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8354956, 19.0477114, 0] }, "properties": { "name": "NC-14", "category": "Hostel / Mess" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8346674, 19.0476917, 0] }, "properties": { "name": "Central Mess", "category": "Hostel / Mess" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [83.8324824, 19.0478957, 0] }, "properties": { "name": "Gandhi Park ", "category": "Amenities" } },

    // Walkways & Primary Roads
    { "type": "Feature", "geometry": { "type": "LineString", "coordinates": [ [83.8311909, 19.0474079], [83.831233, 19.047431], [83.8319401, 19.0478154], [83.8323675, 19.0480433], [83.8326122, 19.048178], [83.8330831, 19.0484282], [83.8338431, 19.048839] ] }, "properties": { "name": "GIET Main Road" } },
    { "type": "Feature", "geometry": { "type": "LineString", "coordinates": [ [83.8338431, 19.048839], [83.8336751, 19.0490553], [83.8334089, 19.0494724], [83.8330777, 19.0499791] ] }, "properties": { "name": "Swimming pool road" } },
    { "type": "Feature", "geometry": { "type": "LineString", "coordinates": [ [83.8315166, 19.0484685], [83.8319661, 19.0486661], [83.8324291, 19.0489214], [83.8328102, 19.0491188] ] }, "properties": { "name": "CSE to Library Walkway" } },
    { "type": "Feature", "geometry": { "type": "LineString", "coordinates": [ [83.8338431, 19.048839], [83.8343097, 19.0490597], [83.8355225, 19.048267], [83.8364817, 19.0466832], [83.8375174, 19.046465] ] }, "properties": { "name": "Hostel Corridor Walkway" } }
  ]
};

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

const STORAGE_KEY = "gietu_campus_geojson";
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

function getDataset() {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_GEOJSON));
        return INITIAL_GEOJSON;
    }
    return JSON.parse(cached);
}

function saveDataset(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
    renderAll();
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
    renderAll();
});

// Map Engine
function setupMapEngine() {
    if (map) {
        setTimeout(() => map.invalidateSize(), 200);
        return;
    }

    map = L.map("admin-leaflet-map", {
        zoomControl: true,
        maxZoom: 20
    }).setView(CAMPUS_VIEW, 17);

    // Google Pure Satellite (no text labels)
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
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

            // Add vertex pin
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

function renderAll(searchTerm = "") {
    const data = getDataset();
    registryList.innerHTML = "";

    // Clear previous points & lines
    Object.values(pointMarkers).forEach(m => map.removeLayer(m));
    Object.values(routeLines).forEach(r => map.removeLayer(r));
    pointMarkers = {};
    routeLines = {};

    let ptCount = 0;
    let rtCount = 0;

    data.features.forEach((feat, index) => {
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
                            <p>${latlngs.length} Coordinates Nodes</p>
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

// ================= POINT CRUD =================
locationForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = locIdInput.value;
    const name = locNameInput.value.trim();
    const category = locCatInput.value;
    const lat = parseFloat(locLatInput.value);
    const lng = parseFloat(locLngInput.value);

    if (!name || isNaN(lat) || isNaN(lng)) return;

    const data = getDataset();

    if (id !== "") {
        const idx = parseInt(id);
        if (data.features[idx]) {
            data.features[idx].properties.name = name;
            data.features[idx].properties.category = category;
            data.features[idx].geometry.coordinates = [lng, lat, 0];
        }
    } else {
        data.features.push({
            "type": "Feature",
            "geometry": { "type": "Point", "coordinates": [lng, lat, 0] },
            "properties": { "name": name, "category": category, "icon-color": "#0288d1" }
        });
    }

    saveDataset(data);
    resetPointForm();
    renderAll(searchFilter.value);

    if (temporaryMarker) {
        map.removeLayer(temporaryMarker);
        temporaryMarker = null;
    }
});

window.editPoint = function(index) {
    if (currentMode !== "locations") {
        tabLocationsBtn.click();
    }
    const data = getDataset();
    const feat = data.features[index];
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

// ================= ROUTE CRUD =================
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

// Edit Existing Route / Walkway
window.editRoute = function(index) {
    if (currentMode !== "routes") {
        tabRoutesBtn.click();
    }
    abortDrawing();

    const data = getDataset();
    const feat = data.features[index];
    if (!feat || feat.geometry.type !== "LineString") return;

    editingRouteIndex = index;
    routeIdInput.value = index;
    routeNameInput.value = feat.properties.name || "";
    routeFormHeading.textContent = "Edit Walkway Corridor";
    cancelRouteBtn.classList.remove("hidden");
    clearDrawingBtn.classList.remove("hidden");

    // Load points into editor
    draftedRoutePoints = feat.geometry.coordinates.map(c => [c[1], c[0]]);

    if (activeDrawPolyline) map.removeLayer(activeDrawPolyline);
    activeDrawPolyline = L.polyline(draftedRoutePoints, {
        color: "#f59e0b",
        weight: 5,
        opacity: 1
    }).addTo(map);

    // Make all vertex handles draggable
    draftedRoutePoints.forEach((pt, pIdx) => {
        const marker = L.circleMarker(pt, {
            radius: 6,
            fillColor: "#ffffff",
            color: "#d97706",
            weight: 2,
            fillOpacity: 1,
            interactive: true
        }).addTo(map);

        // Turn vertices into draggable control handles
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

routeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = routeNameInput.value.trim();
    if (!name || draftedRoutePoints.length < 2) return;

    const data = getDataset();
    // Convert back to GeoJSON standard [lng, lat]
    const geoCoordinates = draftedRoutePoints.map(p => [p[1], p[0]]);

    if (routeIdInput.value !== "") {
        // Update route
        const idx = parseInt(routeIdInput.value);
        if (data.features[idx]) {
            data.features[idx].properties.name = name;
            data.features[idx].geometry.coordinates = geoCoordinates;
        }
    } else {
        // Add new route
        data.features.push({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": geoCoordinates
            },
            "properties": {
                "name": name,
                "stroke": "#0284c7",
                "stroke-width": 3
            }
        });
    }

    saveDataset(data);
    resetRouteForm();
    renderAll(searchFilter.value);
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

// Universal Remove (Points or Routes)
window.removeFeature = function(index) {
    const data = getDataset();
    const feat = data.features[index];
    if (!feat) return;

    if (confirm(`Are you sure you want to remove "${feat.properties.name}"?`)) {
        data.features.splice(index, 1);
        saveDataset(data);
        renderAll(searchFilter.value);
    }
};

searchFilter.addEventListener("input", (e) => {
    renderAll(e.target.value);
});

exportJsonBtn.addEventListener("click", () => {
    const data = JSON.stringify(getDataset(), null, 2);
    navigator.clipboard.writeText(data);
    alert("Updated GIET University GeoJSON has been copied to your clipboard!");
});

evaluateSession();