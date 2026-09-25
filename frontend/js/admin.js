document.addEventListener("DOMContentLoaded", () => {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const API_URL = isLocal ? "http://127.0.0.1:8000" : "https://giet-campus-api.onrender.com";

    // ================= STATE & REFS =================
    let campusGeoJSON = { type: "FeatureCollection", features: [] };
    let activeTab = "locations";
    let editingFeatureIndex = null;
    let map = null;

    // Draggable point placement
    let tempPlacementMarker = null;

    // Route drawing
    let isDrawingRoute = false;
    let drawnRoutePoints = [];
    let drawingPolyline = null;
    let drawingMarkers = [];

    // UI Elements
    const authModal = document.getElementById("auth-modal");
    const loginForm = document.getElementById("login-form");
    const loginError = document.getElementById("login-error");
    const authActionBtn = document.getElementById("auth-action-btn");
    const authBtnText = document.getElementById("auth-btn-text");
    const adminWorkspace = document.getElementById("admin-workspace");

    const tabLocationsBtn = document.getElementById("tab-locations-btn");
    const tabRoutesBtn = document.getElementById("tab-routes-btn");
    const locationPanel = document.getElementById("location-panel");
    const routePanel = document.getElementById("route-panel");

    const locationForm = document.getElementById("location-form");
    const locId = document.getElementById("loc-id");
    const locName = document.getElementById("loc-name");
    const locCategory = document.getElementById("loc-category");
    const locLat = document.getElementById("loc-lat");
    const locLng = document.getElementById("loc-lng");
    const cancelEditBtn = document.getElementById("cancel-edit-btn");
    const formHeading = document.getElementById("form-heading");

    const routeForm = document.getElementById("route-form");
    const routeId = document.getElementById("route-id");
    const routeName = document.getElementById("route-name");
    const startDrawingBtn = document.getElementById("start-drawing-btn");
    const clearDrawingBtn = document.getElementById("clear-drawing-btn");
    const saveRouteBtn = document.getElementById("save-route-btn");
    const cancelRouteBtn = document.getElementById("cancel-route-btn");
    const drawingInfo = document.getElementById("drawing-info");

    const registryList = document.getElementById("registry-list");
    const searchFilter = document.getElementById("search-filter");
    const exportGeojsonBtn = document.getElementById("export-geojson-btn");
    const mapModeText = document.getElementById("map-mode-text");

    const GIET_CENTER = [19.0485, 83.8320];

    // ================= 1. AUTHENTICATION =================
    function checkAuth() {
        const authed = sessionStorage.getItem("giet_admin_auth");
        if (authed === "true") {
            authModal.classList.add("hidden");
            adminWorkspace.classList.remove("hidden");
            authBtnText.textContent = "Logout";
            if (!map) initAdminMap();
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

        if (user === "admin" && pass === "gietu@123") {
            sessionStorage.setItem("giet_admin_auth", "true");
            loginError.textContent = "";
            checkAuth();
        } else {
            loginError.textContent = "Invalid username or password.";
        }
    });

    authActionBtn.addEventListener("click", () => {
        if (sessionStorage.getItem("giet_admin_auth") === "true") {
            sessionStorage.removeItem("giet_admin_auth");
            location.reload();
        } else {
            authModal.classList.remove("hidden");
        }
    });

    // ================= 2. LEAFLET MAP INITIALIZATION =================
    function initAdminMap() {
        map = L.map("admin-leaflet-map", {
            zoomControl: false,
            maxZoom: 22,
            tap: false
        }).setView(GIET_CENTER, 18);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Pure Google Satellite Imagery (zero default business names/labels)
        L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
            maxZoom: 22,
            maxNativeZoom: 20,
            attribution: "&copy; Google Satellite &mdash; GIET University"
        }).addTo(map);

        map.on("click", handleMapClick);
        loadFeatures();
    }

    // ================= 3. LOAD & RENDER FEATURES =================
    function loadFeatures() {
        fetch(`${API_URL}/api/campus-data`)
            .then(res => res.json())
            .then(data => {
                campusGeoJSON = data.geojson;
                renderFeaturesOnMap();
                renderRegistryList();
            })
            .catch(() => {
                fetch("assets/data/giet_campus.geojson")
                    .then(res => res.json())
                    .then(data => {
                        campusGeoJSON = data;
                        renderFeaturesOnMap();
                        renderRegistryList();
                    });
            });
    }

    let mapFeatureLayers = L.layerGroup();

    function getAmenityStyle(name, category) {
        const cat = (category || "").toLowerCase();
        const n = (name || "").toLowerCase();

        if (cat.includes("water") || n.includes("water") || n.includes("cooler")) {
            return { color: "#0284c7", icon: "🚰", label: "Water Cooler" };
        }
        if (cat.includes("washroom") || cat.includes("restroom") || n.includes("washroom") || n.includes("toilet")) {
            return { color: "#8b5cf6", icon: "🚻", label: "Restroom" };
        }
        if (cat.includes("medical") || n.includes("first aid") || n.includes("dispensary")) {
            return { color: "#ef4444", icon: "🏥", label: "Medical" };
        }
        if (cat.includes("security") || n.includes("gate") || n.includes("guard")) {
            return { color: "#f59e0b", icon: "🛡️", label: "Security" };
        }
        return { color: "#3b82f6", icon: "🏛️", label: "Building" };
    }

    function renderFeaturesOnMap() {
        if (!map) return;
        mapFeatureLayers.clearLayers();

        (campusGeoJSON.features || []).forEach((feat, index) => {
            const geom = feat.geometry || {};
            const props = feat.properties || {};

            // Render Point Features (Buildings, Water, Washrooms)
            if (geom.type === "Point") {
                const [lng, lat] = geom.coordinates;
                const style = getAmenityStyle(props.name, props.category);

                const marker = L.circleMarker([lat, lng], {
                    radius: 7,
                    fillColor: style.color,
                    color: "#ffffff",
                    weight: 2,
                    fillOpacity: 1
                });

                // Permanent Satellite label tag
                marker.bindTooltip(`
                    <span class="admin-building-tag" style="border-left: 3px solid ${style.color};">
                        <span>${style.icon}</span> ${props.name}
                    </span>
                `, {
                    permanent: true,
                    direction: "top",
                    offset: [0, -8],
                    className: "admin-map-tooltip"
                });

                marker.on("click", (e) => {
                    L.DomEvent.stopPropagation(e);
                    editFeature(index);
                });

                mapFeatureLayers.addLayer(marker);
            }

            // Render Walkways
            if (geom.type === "LineString") {
                const latlngs = geom.coordinates.map(c => [c[1], c[0]]);
                const poly = L.polyline(latlngs, {
                    color: "#f8fafc",
                    weight: 3.5,
                    opacity: 0.85,
                    dashArray: "5, 5"
                });

                poly.bindTooltip(props.name || "Walkway Corridor", { sticky: true });
                poly.on("click", (e) => {
                    L.DomEvent.stopPropagation(e);
                    editFeature(index);
                });

                mapFeatureLayers.addLayer(poly);
            }
        });

        mapFeatureLayers.addTo(map);
    }

    // ================= 4. MAP CLICKS & PLACEMENT =================
    function handleMapClick(e) {
        const { lat, lng } = e.latlng;

        if (activeTab === "locations") {
            // Drop or move the placement pin
            locLat.value = lat.toFixed(6);
            locLng.value = lng.toFixed(6);

            if (tempPlacementMarker) {
                tempPlacementMarker.setLatLng([lat, lng]);
            } else {
                tempPlacementMarker = L.marker([lat, lng], {
                    draggable: true,
                    icon: L.divIcon({
                        className: "placement-marker",
                        html: `<div style="background:#ef4444; width:16px; height:16px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 10px #000;"></div>`,
                        iconSize: [16, 16],
                        iconAnchor: [8, 8]
                    })
                }).addTo(map);

                tempPlacementMarker.on("dragend", (ev) => {
                    const pos = ev.target.getLatLng();
                    locLat.value = pos.lat.toFixed(6);
                    locLng.value = pos.lng.toFixed(6);
                });
            }
            mapModeText.textContent = "Position Selected";
        }

        if (activeTab === "routes" && isDrawingRoute) {
            drawnRoutePoints.push([lat, lng]);
            updateDrawingPolyline();
        }
    }

    // ================= 5. SAVE POINT (BUILDING / WATER / WASHROOM) =================
    locationForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const payload = {
            id: editingFeatureIndex,
            name: locName.value.trim(),
            category: locCategory.value,
            latitude: parseFloat(locLat.value),
            longitude: parseFloat(locLng.value)
        };

        try {
            const res = await fetch(`${API_URL}/api/admin/save-point`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Failed to save location");
            alert(`Saved: ${payload.name}`);
            resetLocationForm();
            loadFeatures();
        } catch {
            // Local fallback updating campusGeoJSON directly
            const newFeat = {
                type: "Feature",
                properties: { name: payload.name, category: payload.category },
                geometry: { type: "Point", coordinates: [payload.longitude, payload.latitude] }
            };

            if (editingFeatureIndex !== null) {
                campusGeoJSON.features[editingFeatureIndex] = newFeat;
            } else {
                campusGeoJSON.features.push(newFeat);
            }

            alert(`Saved locally: ${payload.name}`);
            resetLocationForm();
            renderFeaturesOnMap();
            renderRegistryList();
        }
    });

    function resetLocationForm() {
        locationForm.reset();
        locId.value = "";
        editingFeatureIndex = null;
        formHeading.textContent = "Add Location or Amenity";
        cancelEditBtn.classList.add("hidden");
        if (tempPlacementMarker) {
            map.removeLayer(tempPlacementMarker);
            tempPlacementMarker = null;
        }
        mapModeText.textContent = "Inspection Mode";
    }

    cancelEditBtn.addEventListener("click", resetLocationForm);

    // ================= 6. ROUTE DRAWING =================
    startDrawingBtn.addEventListener("click", () => {
        isDrawingRoute = !isDrawingRoute;
        if (isDrawingRoute) {
            startDrawingBtn.innerHTML = `<i class="fa-solid fa-pause"></i> <span>Pause Drawing</span>`;
            clearDrawingBtn.classList.remove("hidden");
            drawingInfo.textContent = "Click anywhere on walkways to place consecutive nodes.";
            mapModeText.textContent = "Drawing Walkway";
        } else {
            startDrawingBtn.innerHTML = `<i class="fa-solid fa-pen-nib"></i> <span>Resume Drawing</span>`;
            mapModeText.textContent = "Drawing Paused";
        }
    });

    function updateDrawingPolyline() {
        if (!drawingPolyline) {
            drawingPolyline = L.polyline(drawnRoutePoints, {
                color: "#38bdf8",
                weight: 4,
                dashArray: "6, 6"
            }).addTo(map);
        } else {
            drawingPolyline.setLatLngs(drawnRoutePoints);
        }

        saveRouteBtn.disabled = drawnRoutePoints.length < 2;
    }

    clearDrawingBtn.addEventListener("click", () => {
        drawnRoutePoints = [];
        if (drawingPolyline) {
            map.removeLayer(drawingPolyline);
            drawingPolyline = null;
        }
        saveRouteBtn.disabled = true;
    });

    routeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (drawnRoutePoints.length < 2) return;

        const payload = {
            id: editingFeatureIndex,
            name: routeName.value.trim(),
            highway: "footway",
            coordinates: drawnRoutePoints.map(p => [p[1], p[0]])
        };

        try {
            const res = await fetch(`${API_URL}/api/admin/save-route`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Failed to save walkway");
            alert(`Saved walkway: ${payload.name}`);
        } catch {
            const newFeat = {
                type: "Feature",
                properties: { name: payload.name, highway: payload.highway },
                geometry: { type: "LineString", coordinates: payload.coordinates }
            };
            if (editingFeatureIndex !== null) campusGeoJSON.features[editingFeatureIndex] = newFeat;
            else campusGeoJSON.features.push(newFeat);
            alert(`Saved walkway locally: ${payload.name}`);
        }

        resetRouteForm();
        loadFeatures();
    });

    function resetRouteForm() {
        routeForm.reset();
        routeId.value = "";
        editingFeatureIndex = null;
        drawnRoutePoints = [];
        isDrawingRoute = false;
        if (drawingPolyline) {
            map.removeLayer(drawingPolyline);
            drawingPolyline = null;
        }
        startDrawingBtn.innerHTML = `<i class="fa-solid fa-pen-nib"></i> <span>Draw Path</span>`;
        clearDrawingBtn.classList.add("hidden");
        saveRouteBtn.disabled = true;
        mapModeText.textContent = "Inspection Mode";
    }

    // ================= 7. TABS & DIRECTORY =================
    tabLocationsBtn.addEventListener("click", () => {
        activeTab = "locations";
        tabLocationsBtn.classList.add("active");
        tabRoutesBtn.classList.remove("active");
        locationPanel.classList.remove("hidden");
        routePanel.classList.add("hidden");
        mapModeText.textContent = "Inspection Mode";
    });

    tabRoutesBtn.addEventListener("click", () => {
        activeTab = "routes";
        tabRoutesBtn.classList.add("active");
        tabLocationsBtn.classList.remove("active");
        routePanel.classList.remove("hidden");
        locationPanel.classList.add("hidden");
        mapModeText.textContent = "Corridor Mode";
    });

    function renderRegistryList() {
        const query = searchFilter.value.trim().toLowerCase();
        registryList.innerHTML = "";

        (campusGeoJSON.features || []).forEach((feat, index) => {
            const name = feat.properties?.name || "Unnamed Feature";
            const category = feat.properties?.category || (feat.geometry.type === "LineString" ? "Walkway Corridor" : "Campus Site");

            if (query && !name.toLowerCase().includes(query) && !category.toLowerCase().includes(query)) {
                return;
            }

            const style = getAmenityStyle(name, category);
            const item = document.createElement("div");
            item.className = "registry-item";
            item.innerHTML = `
                <div class="registry-item-info">
                    <div style="font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
                        <span>${style.icon}</span> <span>${name}</span>
                    </div>
                    <div style="font-size: 0.72rem; color: #94a3b8;">${category}</div>
                </div>
                <div class="registry-actions">
                    <button class="btn-icon btn-edit" title="Edit Position"><i class="fa-solid fa-pencil"></i></button>
                    <button class="btn-icon btn-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;

            item.querySelector(".btn-edit").addEventListener("click", () => editFeature(index));
            item.querySelector(".btn-delete").addEventListener("click", () => deleteFeature(index));

            registryList.appendChild(item);
        });
    }

    searchFilter.addEventListener("input", renderRegistryList);

    function editFeature(index) {
        const feat = campusGeoJSON.features[index];
        if (!feat) return;

        editingFeatureIndex = index;

        if (feat.geometry.type === "Point") {
            tabLocationsBtn.click();
            locId.value = index;
            locName.value = feat.properties.name || "";
            locCategory.value = feat.properties.category || "Academic Building";

            const [lng, lat] = feat.geometry.coordinates;
            locLat.value = lat.toFixed(6);
            locLng.value = lng.toFixed(6);

            formHeading.textContent = `Edit Position: ${feat.properties.name}`;
            cancelEditBtn.classList.remove("hidden");

            if (tempPlacementMarker) map.removeLayer(tempPlacementMarker);
            tempPlacementMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
            tempPlacementMarker.on("dragend", (ev) => {
                const pos = ev.target.getLatLng();
                locLat.value = pos.lat.toFixed(6);
                locLng.value = pos.lng.toFixed(6);
            });

            map.flyTo([lat, lng], 20, { duration: 0.8 });
        } else if (feat.geometry.type === "LineString") {
            tabRoutesBtn.click();
            routeId.value = index;
            routeName.value = feat.properties.name || "";
            drawnRoutePoints = feat.geometry.coordinates.map(c => [c[1], c[0]]);
            updateDrawingPolyline();
            map.fitBounds(drawingPolyline.getBounds(), { padding: [50, 50] });
        }
    }

    async function deleteFeature(index) {
        const feat = campusGeoJSON.features[index];
        const name = feat.properties?.name || "Feature";
        if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

        try {
            await fetch(`${API_URL}/api/admin/feature/${index}`, { method: "DELETE" });
        } catch (e) {
            console.warn("Deleted locally:", e);
        }

        campusGeoJSON.features.splice(index, 1);
        renderFeaturesOnMap();
        renderRegistryList();
    }

    exportGeojsonBtn.addEventListener("click", () => {
        const jsonStr = JSON.stringify(campusGeoJSON, null, 2);
        navigator.clipboard.writeText(jsonStr).then(() => {
            alert("Campus GeoJSON copied to clipboard!");
        });
    });

    checkAuth();
});