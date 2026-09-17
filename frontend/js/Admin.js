/**
 * GIET University Admin Spatial Management Engine
 * Direct GeoJSON Parser & Interactive Editor
 */

// Initial GeoJSON features provided for GIET University
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

// Map Settings
const CAMPUS_VIEW = [19.0486, 83.8325];
let map = null;
let markersById = {};
let temporaryMarker = null;
let walkwaysLayerGroup = null;

// Storage key
const STORAGE_KEY = "gietu_campus_geojson";

// Authentication Credentials
const ADMIN_USER = "admin";
const ADMIN_PASS = "gietu@123";

// Elements
const authModal = document.getElementById("auth-modal");
const adminWorkspace = document.getElementById("admin-workspace");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const authActionBtn = document.getElementById("auth-action-btn");
const authBtnText = document.getElementById("auth-btn-text");

// Form & Controls
const locationForm = document.getElementById("location-form");
const locIdInput = document.getElementById("loc-id");
const locNameInput = document.getElementById("loc-name");
const locCatInput = document.getElementById("loc-category");
const locLatInput = document.getElementById("loc-lat");
const locLngInput = document.getElementById("loc-lng");
const formHeading = document.getElementById("form-heading");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const registryList = document.getElementById("registry-list");
const searchFilter = document.getElementById("search-filter");
const locationStats = document.getElementById("location-stats");
const exportJsonBtn = document.getElementById("export-geojson-btn");

// ================= DATA MANAGERS =================
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

// ================= AUTH MANAGEMENT =================
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
        if (confirm("Do you want to log out of the GIETU Admin Portal?")) {
            sessionStorage.removeItem("gietu_admin_logged_in");
            evaluateSession();
        }
    } else {
        evaluateSession();
    }
});

// ================= MAP ENGINE & RENDERER =================
function setupMapEngine() {
    if (map) {
        setTimeout(() => map.invalidateSize(), 200);
        return;
    }

    map = L.map("admin-leaflet-map", {
        zoomControl: true,
        maxZoom: 20
    }).setView(CAMPUS_VIEW, 17);

    // Google Satellite Tiles (Matches navigation.html)
    L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '&copy; Google Maps &mdash; GIET University'
    }).addTo(map);

    walkwaysLayerGroup = L.layerGroup().addTo(map);

    // Click map to assign coordinates
    map.on("click", (e) => {
        const { lat, lng } = e.latlng;
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
    });

    renderWorkspace();
}

function renderWorkspace(filterTerm = "") {
    const data = getDataset();
    registryList.innerHTML = "";

    // Clear existing markers & walkways
    Object.values(markersById).forEach(m => map.removeLayer(m));
    markersById = {};
    walkwaysLayerGroup.clearLayers();

    let pointCount = 0;

    data.features.forEach((feat, index) => {
        // Render LineStrings (Walkways)
        if (feat.geometry.type === "LineString") {
            const flippedCoords = feat.geometry.coordinates.map(c => [c[1], c[0]]);
            L.polyline(flippedCoords, {
                color: "#38bdf8",
                weight: 3,
                opacity: 0.85,
                dashArray: "4, 6"
            }).addTo(walkwaysLayerGroup);
            return;
        }

        // Render Points (Locations)
        if (feat.geometry.type === "Point") {
            pointCount++;
            const [lng, lat] = feat.geometry.coordinates;
            const name = feat.properties.name || "Unnamed Point";
            const category = feat.properties.category || "Campus Site";

            // Marker on Map
            const marker = L.circleMarker([lat, lng], {
                radius: 7,
                fillColor: "#2563eb",
                color: "#ffffff",
                weight: 2,
                fillOpacity: 0.95
            }).addTo(map);

            marker.bindPopup(`
                <div style="font-family: Inter, sans-serif;">
                    <strong style="color: #1e3a8a; font-size: 0.95rem;">${name}</strong><br>
                    <span style="font-size: 0.75rem; color: #64748b;">${category}</span><br>
                    <code style="font-size: 0.7rem; color: #0284c7;">${lat.toFixed(6)}, ${lng.toFixed(6)}</code>
                </div>
            `);

            markersById[index] = marker;

            // Render to Sidebar if it matches search
            if (name.toLowerCase().includes(filterTerm.toLowerCase()) || category.toLowerCase().includes(filterTerm.toLowerCase())) {
                const item = document.createElement("div");
                item.className = "reg-item";
                item.innerHTML = `
                    <div class="reg-info">
                        <span class="badge" style="font-size:0.65rem; padding: 2px 6px;">${category}</span>
                        <h5>${name}</h5>
                        <p>${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
                    </div>
                    <div class="reg-actions">
                        <button class="action-btn edit" onclick="editPoint(${index})" title="Rename or Edit">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="action-btn del" onclick="removePoint(${index})" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
                registryList.appendChild(item);
            }
        }
    });

    locationStats.textContent = `${pointCount} verified campus spots`;
}

// ================= CRUD ACTIONS =================
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
        // Rename / Update Existing Point
        const idx = parseInt(id);
        if (data.features[idx]) {
            data.features[idx].properties.name = name;
            data.features[idx].properties.category = category;
            data.features[idx].geometry.coordinates = [lng, lat, 0];
        }
    } else {
        // Add New Point Feature
        const newFeature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lng, lat, 0]
            },
            "properties": {
                "name": name,
                "category": category,
                "icon-color": "#0288d1"
            }
        };
        data.features.push(newFeature);
    }

    saveDataset(data);
    resetForm();
    renderWorkspace(searchFilter.value);

    if (temporaryMarker) {
        map.removeLayer(temporaryMarker);
        temporaryMarker = null;
    }
});

window.editPoint = function(index) {
    const data = getDataset();
    const feat = data.features[index];
    if (!feat) return;

    locIdInput.value = index;
    locNameInput.value = feat.properties.name || "";
    locCatInput.value = feat.properties.category || "Academic";
    locLatInput.value = feat.geometry.coordinates[1];
    locLngInput.value = feat.geometry.coordinates[0];

    formHeading.textContent = "Rename / Edit Spot";
    cancelEditBtn.classList.remove("hidden");

    // Pan map to point
    const [lng, lat] = feat.geometry.coordinates;
    map.setView([lat, lng], 19);
    if (markersById[index]) {
        markersById[index].openPopup();
    }
};

window.removePoint = function(index) {
    const data = getDataset();
    const feat = data.features[index];
    if (!feat) return;

    if (confirm(`Remove "${feat.properties.name}" from GIET University map?`)) {
        data.features.splice(index, 1);
        saveDataset(data);
        renderWorkspace(searchFilter.value);
    }
};

function resetForm() {
    locationForm.reset();
    locIdInput.value = "";
    formHeading.textContent = "Add New Location";
    cancelEditBtn.classList.add("hidden");
}

cancelEditBtn.addEventListener("click", resetForm);

searchFilter.addEventListener("input", (e) => {
    renderWorkspace(e.target.value);
});

exportJsonBtn.addEventListener("click", () => {
    const data = JSON.stringify(getDataset(), null, 2);
    navigator.clipboard.writeText(data);
    alert("Updated GIET University GeoJSON has been copied to your clipboard!");
});

// Boot session verification
evaluateSession();