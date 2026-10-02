document.addEventListener("DOMContentLoaded", () => {
    // ================= 0. DEVICE DETECTION & MOBILE BLOCKER =================
    const mobileBlocker = document.getElementById("mobile-blocker-overlay");
    function enforceDevicePolicy() {
        const isMobileScreen = window.innerWidth <= 992;
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if ((isMobileScreen || isMobileUA) && mobileBlocker) {
            mobileBlocker.style.display = "flex";
        } else if (mobileBlocker) {
            mobileBlocker.style.display = "none";
        }
    }

    enforceDevicePolicy();
    window.addEventListener("resize", enforceDevicePolicy);

    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const API_URL = isLocal ? "http://127.0.0.1:8000" : "https://giet-campus-api.onrender.com";

    // ================= STATE & REFS =================
    let campusGeoJSON = { type: "FeatureCollection", features: [] };
    let activeTab = "locations";
    let editingFeatureIndex = null;
    let map = null;
    let tempPlacementMarker = null;

    // Route drawing
    let isDrawingRoute = false;
    let drawnRoutePoints = [];
    let drawingPolyline = null;

    // UI Elements
    const authModal = document.getElementById("auth-modal");
    const loginForm = document.getElementById("login-form");
    const loginError = document.getElementById("login-error");
    const authActionBtn = document.getElementById("auth-action-btn");
    const authBtnText = document.getElementById("auth-btn-text");
    const adminWorkspace = document.getElementById("admin-workspace");

    const tabLocationsBtn = document.getElementById("tab-locations-btn");
    const tabRoutesBtn = document.getElementById("tab-routes-btn");
    const tabStructureBtn = document.getElementById("tab-structure-btn");

    const locationPanel = document.getElementById("location-panel");
    const routePanel = document.getElementById("route-panel");
    const structurePanel = document.getElementById("structure-panel");

    // Landmarks Form
    const locationForm = document.getElementById("location-form");
    const locId = document.getElementById("loc-id");
    const locName = document.getElementById("loc-name");
    const locCategory = document.getElementById("loc-category");
    const locLat = document.getElementById("loc-lat");
    const locLng = document.getElementById("loc-lng");
    const cancelEditBtn = document.getElementById("cancel-edit-btn");
    const formHeading = document.getElementById("form-heading");

    // Walkways Form
    const routeForm = document.getElementById("route-form");
    const routeId = document.getElementById("route-id");
    const routeName = document.getElementById("route-name");
    const startDrawingBtn = document.getElementById("start-drawing-btn");
    const clearDrawingBtn = document.getElementById("clear-drawing-btn");
    const saveRouteBtn = document.getElementById("save-route-btn");
    const cancelRouteBtn = document.getElementById("cancel-route-btn");
    const drawingInfo = document.getElementById("drawing-info");

    // Floor & Room Structure Elements
    const adminBldgSelect = document.getElementById("admin-bldg-select");
    const adminFloorSelect = document.getElementById("admin-floor-select");
    const btnAddFloor = document.getElementById("btn-add-floor");
    const btnDeleteFloor = document.getElementById("btn-delete-floor");
    const adminRoomForm = document.getElementById("admin-room-form");
    const adminRoomId = document.getElementById("admin-room-id");
    const roomNumVal = document.getElementById("room-num-val");
    const roomNameVal = document.getElementById("room-name-val");
    const roomTypeVal = document.getElementById("room-type-val");
    const roomDescVal = document.getElementById("room-desc-val");
    const roomXVal = document.getElementById("room-x-val");
    const roomYVal = document.getElementById("room-y-val");
    const roomWVal = document.getElementById("room-w-val");
    const roomHVal = document.getElementById("room-h-val");
    const btnCancelEditRoom = document.getElementById("btn-cancel-edit-room");
    const btnDeleteActiveRoom = document.getElementById("btn-delete-active-room");
    const adminFloorRoomsList = document.getElementById("admin-floor-rooms-list");
    const roomFormTitle = document.getElementById("room-form-title");
    
    // Live Blueprint Preview & Sketch Upload Elements
    const adminBlueprintViewport = document.getElementById("admin-blueprint-viewport");
    const adminBlueprintCanvas = document.getElementById("admin-blueprint-canvas");
    const previewFloorTitle = document.getElementById("preview-floor-title");
    const sketchFileInput = document.getElementById("sketch-file-input");
    const btnUploadSketch = document.getElementById("btn-upload-sketch");
    const btnToggleUnderlay = document.getElementById("btn-toggle-underlay");
    const btnDrawRoom = document.getElementById("btn-draw-room");

    let currentFloorsCache = [];
    let isDrawMode = false;
    let underlayUrl = null;
    let isUnderlayVisible = true;

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

        L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
            maxZoom: 22,
            maxNativeZoom: 20,
            attribution: "&copy; Google Satellite &mdash; GIET University"
        }).addTo(map);

        map.on("click", handleMapClick);
        loadFeatures();
    }

    // ================= 3. MAP FEATURE RENDERING =================
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

        if (cat.includes("water") || n.includes("water")) return { color: "#0284c7", icon: "🚰" };
        if (cat.includes("washroom") || cat.includes("restroom") || n.includes("washroom") || n.includes("toilet") || n.includes("wc")) return { color: "#8b5cf6", icon: "🚻" };
        if (cat.includes("medical") || n.includes("dispensary")) return { color: "#ef4444", icon: "🏥" };
        if (cat.includes("security") || n.includes("gate")) return { color: "#f59e0b", icon: "🛡️" };
        return { color: "#3b82f6", icon: "🏛️" };
    }

    function renderFeaturesOnMap() {
        if (!map) return;
        mapFeatureLayers.clearLayers();

        (campusGeoJSON.features || []).forEach((feat, index) => {
            const geom = feat.geometry || {};
            const props = feat.properties || {};

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

                marker.bindTooltip(`
                    <span class="admin-building-tag" style="border-left: 3px solid ${style.color};">
                        <span>${style.icon}</span> ${props.name}
                    </span>
                `, { permanent: true, direction: "top", offset: [0, -8], className: "admin-map-tooltip" });

                marker.on("click", (e) => {
                    L.DomEvent.stopPropagation(e);
                    editFeature(index);
                });

                mapFeatureLayers.addLayer(marker);
            }

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

    // ================= 4. MAP CLICKS & DRAWING =================
    function handleMapClick(e) {
        const { lat, lng } = e.latlng;

        if (activeTab === "locations") {
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

    // ================= 5. SAVE POINT =================
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
            const newFeat = {
                type: "Feature",
                properties: { name: payload.name, category: payload.category },
                geometry: { type: "Point", coordinates: [payload.longitude, payload.latitude] }
            };

            if (editingFeatureIndex !== null) campusGeoJSON.features[editingFeatureIndex] = newFeat;
            else campusGeoJSON.features.push(newFeat);

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
            drawingInfo.textContent = "Click consecutive points along walkways.";
            mapModeText.textContent = "Drawing Walkway";
        } else {
            startDrawingBtn.innerHTML = `<i class="fa-solid fa-pen-nib"></i> <span>Resume Drawing</span>`;
            mapModeText.textContent = "Drawing Paused";
        }
    });

    function updateDrawingPolyline() {
        if (!drawingPolyline) {
            drawingPolyline = L.polyline(drawnRoutePoints, { color: "#38bdf8", weight: 4, dashArray: "6, 6" }).addTo(map);
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

    // ================= 7. TAB SWITCHING (KEEPS STATE) =================
    tabLocationsBtn.addEventListener("click", () => {
        activeTab = "locations";
        tabLocationsBtn.classList.add("active");
        tabRoutesBtn.classList.remove("active");
        if (tabStructureBtn) tabStructureBtn.classList.remove("active");

        locationPanel.classList.remove("hidden");
        routePanel.classList.add("hidden");
        if (structurePanel) structurePanel.classList.add("hidden");
        if (adminBlueprintViewport) adminBlueprintViewport.classList.add("hidden");
        mapModeText.textContent = "Inspection Mode";
    });

    tabRoutesBtn.addEventListener("click", () => {
        activeTab = "routes";
        tabRoutesBtn.classList.add("active");
        tabLocationsBtn.classList.remove("active");
        if (tabStructureBtn) tabStructureBtn.classList.remove("active");

        routePanel.classList.remove("hidden");
        locationPanel.classList.add("hidden");
        if (structurePanel) structurePanel.classList.add("hidden");
        if (adminBlueprintViewport) adminBlueprintViewport.classList.add("hidden");
        mapModeText.textContent = "Corridor Mode";
    });

    if (tabStructureBtn) {
        tabStructureBtn.addEventListener("click", () => {
            activeTab = "structure";
            tabStructureBtn.classList.add("active");
            tabLocationsBtn.classList.remove("active");
            tabRoutesBtn.classList.remove("active");

            structurePanel.classList.remove("hidden");
            locationPanel.classList.add("hidden");
            routePanel.classList.add("hidden");

            if (adminBlueprintViewport) adminBlueprintViewport.classList.remove("hidden");
            mapModeText.textContent = "Floor Plan Mode";

            loadBuildingsIntoDropdown();
        });
    }

    // ================= 8. LIVE BLUEPRINT PREVIEW & IN-CANVAS ACTIONS =================
    function renderLiveBlueprintPreview() {
        if (!adminBlueprintCanvas) return;
        adminBlueprintCanvas.innerHTML = "";

        const selectedFloorId = parseInt(adminFloorSelect.value);
        const floorObj = currentFloorsCache.find(f => f.id === selectedFloorId);

        if (previewFloorTitle && floorObj) {
            previewFloorTitle.textContent = `${adminBldgSelect.value} - ${floorObj.name} (Live Preview)`;
        }

        if (!floorObj || !floorObj.rooms || floorObj.rooms.length === 0) {
            adminBlueprintCanvas.innerHTML = `<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 13px; pointer-events: none;">No rooms on this floor. Click "Draw Box" or upload a sketch.</div>`;
            return;
        }

        const currentlyEditingId = adminRoomId.value ? parseInt(adminRoomId.value) : null;

        floorObj.rooms.forEach(r => {
            const block = document.createElement("div");
            const cat = (r.type || "classroom").toLowerCase();
            block.className = `admin-preview-room ${cat}`;
            if (currentlyEditingId === r.id) block.classList.add("active-editing");

            block.style.left = `${r.plan.x}px`;
            block.style.top = `${r.plan.y}px`;
            block.style.width = `${r.plan.w}px`;
            block.style.height = `${r.plan.h}px`;

            if (isDrawMode) {
                block.style.pointerEvents = "none";
            }

            block.innerHTML = `
                <div style="font-size: 11px; font-weight: 800; pointer-events: none;">${r.number}</div>
                <div style="font-size: 9.5px; opacity: 0.85; pointer-events: none;">${r.name}</div>
                <button type="button" class="btn-canvas-del-room" title="Delete room" style="position: absolute; top: 2px; right: 2px; width: 16px; height: 16px; font-size: 9px; line-height: 1; border-radius: 50%; background: #ef4444; color: #fff; border: none; cursor: pointer; display: none; align-items: center; justify-content: center;">✕</button>
                <div class="room-resize-handle"></div>
            `;

            const quickDelBtn = block.querySelector(".btn-canvas-del-room");
            if (currentlyEditingId === r.id && quickDelBtn) {
                quickDelBtn.style.display = "flex";
            }

            if (quickDelBtn) {
                quickDelBtn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    await deleteRoomById(r.id, `${r.number} (${r.name})`);
                });
            }

            // Click room to select & edit
            block.addEventListener("click", (e) => {
                if (isDrawMode || e.target.classList.contains("room-resize-handle") || e.target.classList.contains("btn-canvas-del-room")) return;
                adminRoomId.value = r.id;
                roomNumVal.value = r.number;
                roomNameVal.value = r.name;
                roomTypeVal.value = r.type;
                roomDescVal.value = r.description || "";
                roomXVal.value = r.plan.x;
                roomYVal.value = r.plan.y;
                roomWVal.value = r.plan.w;
                roomHVal.value = r.plan.h;
                roomFormTitle.textContent = `Edit Room: ${r.number}`;
                btnCancelEditRoom.classList.remove("hidden");
                if (btnDeleteActiveRoom) btnDeleteActiveRoom.classList.remove("hidden");
                renderLiveBlueprintPreview();
            });

            // Drag to reposition
            block.addEventListener("mousedown", (e) => {
                if (isDrawMode || e.target.classList.contains("room-resize-handle") || e.target.classList.contains("btn-canvas-del-room")) return;
                let startX = e.clientX;
                let startY = e.clientY;
                let origLeft = r.plan.x;
                let origTop = r.plan.y;

                function moveDrag(ev) {
                    const dx = ev.clientX - startX;
                    const dy = ev.clientY - startY;
                    r.plan.x = Math.max(0, Math.min(900 - r.plan.w, origLeft + dx));
                    r.plan.y = Math.max(0, Math.min(480 - r.plan.h, origTop + dy));
                    block.style.left = `${r.plan.x}px`;
                    block.style.top = `${r.plan.y}px`;

                    if (adminRoomId.value == r.id) {
                        roomXVal.value = Math.round(r.plan.x);
                        roomYVal.value = Math.round(r.plan.y);
                    }
                }

                function stopDrag() {
                    window.removeEventListener("mousemove", moveDrag);
                    window.removeEventListener("mouseup", stopDrag);
                }

                window.addEventListener("mousemove", moveDrag);
                window.addEventListener("mouseup", stopDrag);
            });

            // Corner Resize
            const handle = block.querySelector(".room-resize-handle");
            if (handle) {
                handle.addEventListener("mousedown", (e) => {
                    e.stopPropagation();
                    let startX = e.clientX;
                    let startY = e.clientY;
                    let origW = r.plan.w;
                    let origH = r.plan.h;

                    function doResize(ev) {
                        const dw = ev.clientX - startX;
                        const dh = ev.clientY - startY;
                        r.plan.w = Math.max(25, Math.min(900 - r.plan.x, origW + dw));
                        r.plan.h = Math.max(25, Math.min(480 - r.plan.y, origH + dh));
                        block.style.width = `${r.plan.w}px`;
                        block.style.height = `${r.plan.h}px`;

                        if (adminRoomId.value == r.id) {
                            roomWVal.value = Math.round(r.plan.w);
                            roomHVal.value = Math.round(r.plan.h);
                        }
                    }

                    function stopResize() {
                        window.removeEventListener("mousemove", doResize);
                        window.removeEventListener("mouseup", stopResize);
                    }

                    window.addEventListener("mousemove", doResize);
                    window.addEventListener("mouseup", stopResize);
                });
            }

            adminBlueprintCanvas.appendChild(block);
        });
    }

    // Unified Delete Handler
    async function deleteRoomById(roomId, label) {
        if (!confirm(`Delete ${label || "this room"}?`)) return;

        try {
            const res = await fetch(`${API_URL}/api/admin/room/${roomId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Server error deleting room");

            const selectedFloorId = parseInt(adminFloorSelect.value);
            const floorObj = currentFloorsCache.find(f => f.id === selectedFloorId);
            if (floorObj) {
                floorObj.rooms = floorObj.rooms.filter(rm => rm.id !== roomId);
            }

            resetRoomEditor();
            renderAdminRoomsList();
        } catch (err) {
            console.error("Error deleting room:", err);
            alert("Could not delete room. Check if the backend is running.");
        }
    }

    // Delete Active Room Button in Form
    if (btnDeleteActiveRoom) {
        btnDeleteActiveRoom.addEventListener("click", async (e) => {
            e.preventDefault();
            const currentId = adminRoomId.value ? parseInt(adminRoomId.value) : null;
            if (!currentId) return;
            await deleteRoomById(currentId, roomNumVal.value || "selected room");
        });
    }

    // Keyboard Shortcuts: Delete or Backspace
    window.addEventListener("keydown", async (e) => {
        if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;

        if (e.key === "Delete" || e.key === "Backspace") {
            const currentId = adminRoomId.value ? parseInt(adminRoomId.value) : null;
            if (!currentId) return;
            e.preventDefault();
            await deleteRoomById(currentId, roomNumVal.value || "selected room");
        }
    });

    // Real-time Coordinate Input Listener
    [roomXVal, roomYVal, roomWVal, roomHVal].forEach(input => {
        if (!input) return;
        input.addEventListener("input", () => {
            const editId = adminRoomId.value ? parseInt(adminRoomId.value) : null;
            if (!editId) return;

            const selectedFloorId = parseInt(adminFloorSelect.value);
            const floorObj = currentFloorsCache.find(f => f.id === selectedFloorId);
            if (!floorObj) return;

            const room = floorObj.rooms.find(r => r.id === editId);
            if (room) {
                room.plan.x = parseInt(roomXVal.value) || 0;
                room.plan.y = parseInt(roomYVal.value) || 0;
                room.plan.w = parseInt(roomWVal.value) || 20;
                room.plan.h = parseInt(roomHVal.value) || 20;
                renderLiveBlueprintPreview();
            }
        });
    });

    // ================= 9. SKETCH UPLOAD, AUTO-EXTRACTION & MANUAL BOX DRAWING =================
    if (btnUploadSketch) {
        btnUploadSketch.addEventListener("click", (e) => {
            e.preventDefault();
            sketchFileInput.click();
        });
    }

    if (sketchFileInput) {
        sketchFileInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const selectedFloorId = parseInt(adminFloorSelect.value);
            if (!selectedFloorId) {
                alert("Please select or add a floor first before uploading.");
                return;
            }

            underlayUrl = URL.createObjectURL(file);
            adminBlueprintCanvas.style.backgroundImage = `url('${underlayUrl}')`;
            btnToggleUnderlay.classList.remove("hidden");
            isUnderlayVisible = true;

            const formData = new FormData();
            formData.append("file", file);

            btnUploadSketch.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...`;
            btnUploadSketch.disabled = true;

            try {
                const res = await fetch(`${API_URL}/api/admin/detect-sketch`, {
                    method: "POST",
                    body: formData
                });
                const data = await res.json();

                if (data.status === "success" && data.rooms && data.rooms.length > 0) {
                    const floorObj = currentFloorsCache.find(f => f.id === selectedFloorId);
                    if (floorObj) {
                        for (const r of data.rooms) {
                            await fetch(`${API_URL}/api/admin/save-room`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    floor_id: selectedFloorId,
                                    number: r.number,
                                    name: r.name,
                                    type: r.type,
                                    description: r.description,
                                    x: r.x,
                                    y: r.y,
                                    w: r.w,
                                    h: r.h
                                })
                            });
                        }
                        alert(`Detected & created ${data.rooms.length} room boundaries! You can now adjust them.`);
                        loadFloorsForSelectedBuilding();
                    }
                } else {
                    alert("No distinct closed rooms detected. You can trace rooms using 'Draw Box'.");
                }
            } catch (err) {
                alert("Auto-detect endpoint offline. Image loaded as background underlay!");
            } finally {
                btnUploadSketch.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Upload Sketch / PNG`;
                btnUploadSketch.disabled = false;
                sketchFileInput.value = "";
            }
        });
    }

    if (btnToggleUnderlay) {
        btnToggleUnderlay.addEventListener("click", (e) => {
            e.preventDefault();
            isUnderlayVisible = !isUnderlayVisible;
            adminBlueprintCanvas.style.backgroundImage = (isUnderlayVisible && underlayUrl) ? `url('${underlayUrl}')` : "none";
        });
    }

    if (btnDrawRoom) {
        btnDrawRoom.addEventListener("click", (e) => {
            e.preventDefault();
            isDrawMode = !isDrawMode;
            btnDrawRoom.style.background = isDrawMode ? "#2563eb" : "";
            btnDrawRoom.style.color = isDrawMode ? "#fff" : "";
            btnDrawRoom.innerHTML = isDrawMode 
                ? `<i class="fa-solid fa-check"></i> Exit Draw` 
                : `<i class="fa-solid fa-vector-square"></i> Draw Box`;
            adminBlueprintCanvas.style.cursor = isDrawMode ? "crosshair" : "default";

            renderLiveBlueprintPreview();
        });
    }

    let drawStartX = 0, drawStartY = 0;
    let tempDrawBox = null;

    adminBlueprintCanvas.addEventListener("mousedown", (e) => {
        if (!isDrawMode) return;
        e.preventDefault();
        const rect = adminBlueprintCanvas.getBoundingClientRect();
        drawStartX = e.clientX - rect.left;
        drawStartY = e.clientY - rect.top;

        tempDrawBox = document.createElement("div");
        tempDrawBox.className = "drawing-selection-box";
        tempDrawBox.style.left = `${drawStartX}px`;
        tempDrawBox.style.top = `${drawStartY}px`;
        adminBlueprintCanvas.appendChild(tempDrawBox);

        function onMouseMove(ev) {
            const curX = Math.max(0, Math.min(900, ev.clientX - rect.left));
            const curY = Math.max(0, Math.min(480, ev.clientY - rect.top));
            const x = Math.min(drawStartX, curX);
            const y = Math.min(drawStartY, curY);
            const w = Math.abs(curX - drawStartX);
            const h = Math.abs(curY - drawStartY);

            tempDrawBox.style.left = `${x}px`;
            tempDrawBox.style.top = `${y}px`;
            tempDrawBox.style.width = `${w}px`;
            tempDrawBox.style.height = `${h}px`;
        }

        async function onMouseUp(ev) {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);

            const curX = Math.max(0, Math.min(900, ev.clientX - rect.left));
            const curY = Math.max(0, Math.min(480, ev.clientY - rect.top));
            const x = Math.round(Math.min(drawStartX, curX));
            const y = Math.round(Math.min(drawStartY, curY));
            const w = Math.round(Math.abs(curX - drawStartX));
            const h = Math.round(Math.abs(curY - drawStartY));

            if (tempDrawBox) {
                tempDrawBox.remove();
                tempDrawBox = null;
            }

            if (w > 25 && h > 25) {
                const selectedFloorId = parseInt(adminFloorSelect.value);
                if (!selectedFloorId) {
                    alert("Please select or add a floor first.");
                    return;
                }

                const floorObj = currentFloorsCache.find(f => f.id === selectedFloorId);
                const nextNum = (floorObj && floorObj.rooms ? floorObj.rooms.length + 1 : 1);
                const defaultCode = `ROOM-${nextNum}`;

                const payload = {
                    floor_id: selectedFloorId,
                    number: defaultCode,
                    name: `Room ${nextNum}`,
                    type: roomTypeVal.value || "Classroom",
                    description: "",
                    x: x,
                    y: y,
                    w: w,
                    h: h
                };

                try {
                    const res = await fetch(`${API_URL}/api/admin/save-room`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    });

                    if (res.ok) {
                        activeTab = "structure";
                        if (adminBlueprintViewport) adminBlueprintViewport.classList.remove("hidden");
                        
                        const fRes = await fetch(`${API_URL}/api/buildings/${encodeURIComponent(adminBldgSelect.value)}/floors`);
                        currentFloorsCache = await fRes.json();

                        roomXVal.value = x;
                        roomYVal.value = y;
                        roomWVal.value = w;
                        roomHVal.value = h;
                        roomNumVal.value = defaultCode;
                        roomNameVal.value = `Room ${nextNum}`;

                        renderAdminRoomsList();
                    }
                } catch (err) {
                    console.error("Failed to save drawn room:", err);
                }
            }
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    });

    // ================= 10. CASE-INSENSITIVE DEDUPLICATION =================
    async function loadBuildingsIntoDropdown() {
        let buildingsList = [];
        try {
            const res = await fetch(`${API_URL}/api/admin/buildings-list`);
            if (res.ok) {
                buildingsList = await res.json();
            }
        } catch (e) {
            console.warn("Backend API offline, reading from map data...");
        }

        if (!buildingsList || buildingsList.length === 0) {
            const fromMap = (campusGeoJSON.features || [])
                .filter(f => f.geometry && f.geometry.type === "Point" && f.properties?.name)
                .map(f => f.properties.name.trim());
            
            const defaults = ["CSA Block", "CSE Building", "Admin Block", "Library", "Mechanical building", "Bio tech Building", "Agriculture Block", "BSH Building"];
            buildingsList = [...fromMap, ...defaults];
        }

        const normalizedMap = new Map();
        buildingsList.forEach(item => {
            const cleanItem = item.trim();
            const key = cleanItem.toLowerCase();
            if (!normalizedMap.has(key)) {
                normalizedMap.set(key, cleanItem);
            } else {
                if (cleanItem.includes("Block")) {
                    normalizedMap.set(key, cleanItem);
                }
            }
        });

        const sortedUniqueBuildings = Array.from(normalizedMap.values()).sort((a, b) => a.localeCompare(b));

        adminBldgSelect.innerHTML = "";
        sortedUniqueBuildings.forEach(b => {
            const opt = document.createElement("option");
            opt.value = b;
            opt.textContent = b;
            adminBldgSelect.appendChild(opt);
        });

        if (sortedUniqueBuildings.length > 0) {
            const defaultMatch = sortedUniqueBuildings.find(b => b.toLowerCase() === "csa block") || sortedUniqueBuildings[0];
            adminBldgSelect.value = defaultMatch;
            loadFloorsForSelectedBuilding();
        }
    }

    adminBldgSelect.addEventListener("change", loadFloorsForSelectedBuilding);

    async function loadFloorsForSelectedBuilding() {
        const bldg = adminBldgSelect.value;
        try {
            const res = await fetch(`${API_URL}/api/buildings/${encodeURIComponent(bldg)}/floors`);
            currentFloorsCache = await res.json();
            adminFloorSelect.innerHTML = "";

            if (currentFloorsCache.length === 0) {
                adminFloorSelect.innerHTML = `<option value="">No floors found</option>`;
                adminFloorRoomsList.innerHTML = `<div style="color:#94a3b8; font-size:12px;">Click "+ Floor" to add the first level.</div>`;
                renderLiveBlueprintPreview();
                return;
            }

            currentFloorsCache.forEach(f => {
                const opt = document.createElement("option");
                opt.value = f.id;
                opt.textContent = `${f.name} (Floor ${f.floor_number})`;
                adminFloorSelect.appendChild(opt);
            });

            renderAdminRoomsList();
        } catch (e) {
            console.error("Failed to load floors for building", e);
        }
    }

    adminFloorSelect.addEventListener("change", renderAdminRoomsList);

    function renderAdminRoomsList() {
        const selectedFloorId = parseInt(adminFloorSelect.value);
        const floorObj = currentFloorsCache.find(f => f.id === selectedFloorId);
        adminFloorRoomsList.innerHTML = "";

        if (!floorObj || !floorObj.rooms || floorObj.rooms.length === 0) {
            adminFloorRoomsList.innerHTML = `<div style="color:#94a3b8; font-size:12px;">No rooms registered on this floor.</div>`;
            renderLiveBlueprintPreview();
            return;
        }

        floorObj.rooms.forEach(r => {
            const item = document.createElement("div");
            item.className = "registry-item";
            item.innerHTML = `
                <div class="registry-item-info">
                    <div style="font-weight:700; color:#f8fafc;">${r.number}: ${r.name}</div>
                    <div style="font-size:0.7rem; color:#94a3b8;">${r.type} • box: [${r.plan.x}, ${r.plan.y}, ${r.plan.w}, ${r.plan.h}]</div>
                </div>
                <div class="registry-actions">
                    <button type="button" class="btn-icon btn-edit" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                    <button type="button" class="btn-icon btn-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;

            item.querySelector(".btn-edit").addEventListener("click", () => {
                adminRoomId.value = r.id;
                roomNumVal.value = r.number;
                roomNameVal.value = r.name;
                roomTypeVal.value = r.type;
                roomDescVal.value = r.description || "";
                roomXVal.value = r.plan.x;
                roomYVal.value = r.plan.y;
                roomWVal.value = r.plan.w;
                roomHVal.value = r.plan.h;
                roomFormTitle.textContent = `Edit Room: ${r.number}`;
                btnCancelEditRoom.classList.remove("hidden");
                if (btnDeleteActiveRoom) btnDeleteActiveRoom.classList.remove("hidden");
                renderLiveBlueprintPreview();
            });

            item.querySelector(".btn-delete").addEventListener("click", async () => {
                await deleteRoomById(r.id, `${r.number} (${r.name})`);
            });

            adminFloorRoomsList.appendChild(item);
        });

        renderLiveBlueprintPreview();
    }

    if (btnAddFloor) {
        btnAddFloor.addEventListener("click", async (e) => {
            e.preventDefault();
            const floorNum = prompt("Enter Floor Number (e.g. 0 for Ground, 1 for 1st, 3 for 3rd):", "1");
            if (floorNum === null) return;
            const floorName = prompt("Enter Floor Display Name:", `Floor ${floorNum}`);
            if (!floorName) return;

            const payload = {
                building_name: adminBldgSelect.value,
                floor_number: parseInt(floorNum),
                name: floorName,
                department: ""
            };

            await fetch(`${API_URL}/api/admin/save-floor`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            loadFloorsForSelectedBuilding();
        });
    }

    if (btnDeleteFloor) {
        btnDeleteFloor.addEventListener("click", async (e) => {
            e.preventDefault();
            const selectedFloorId = parseInt(adminFloorSelect.value);
            if (!selectedFloorId) {
                alert("Please select a valid floor to delete.");
                return;
            }

            const floorObj = currentFloorsCache.find(f => f.id === selectedFloorId);
            const floorName = floorObj ? floorObj.name : `Floor ID ${selectedFloorId}`;

            const confirmation = confirm(`Are you sure you want to delete "${floorName}"?\n\nThis will permanently delete this floor and all rooms located on it.`);
            if (!confirmation) return;

            try {
                const res = await fetch(`${API_URL}/api/admin/floor/${selectedFloorId}`, {
                    method: "DELETE"
                });

                if (!res.ok) throw new Error("Failed to delete floor from DB");

                alert(`Floor "${floorName}" deleted successfully.`);
                resetRoomEditor();
                loadFloorsForSelectedBuilding();
            } catch (err) {
                alert(`Error deleting floor: ${err.message}`);
            }
        });
    }

    adminRoomForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const floorId = parseInt(adminFloorSelect.value);
        if (!floorId) {
            alert("Please select or add a floor first.");
            return;
        }

        const payload = {
            id: adminRoomId.value ? parseInt(adminRoomId.value) : null,
            floor_id: floorId,
            number: roomNumVal.value.trim(),
            name: roomNameVal.value.trim(),
            type: roomTypeVal.value,
            description: roomDescVal.value.trim(),
            x: parseInt(roomXVal.value),
            y: parseInt(roomYVal.value),
            w: parseInt(roomWVal.value),
            h: parseInt(roomHVal.value)
        };

        const res = await fetch(`${API_URL}/api/admin/save-room`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert(payload.id ? "Room updated in DB!" : "Room saved to DB!");
            resetRoomEditor();
            loadFloorsForSelectedBuilding();
        } else {
            alert("Failed to save room.");
        }
    });

    function resetRoomEditor() {
        adminRoomForm.reset();
        adminRoomId.value = "";
        roomFormTitle.textContent = "Floor & Room Studio";
        btnCancelEditRoom.classList.add("hidden");
        if (btnDeleteActiveRoom) btnDeleteActiveRoom.classList.add("hidden");
    }

    btnCancelEditRoom.addEventListener("click", (e) => {
        e.preventDefault();
        resetRoomEditor();
    });

    // ================= 11. REGISTERED OUTDOOR DIRECTORY =================
    function renderRegistryList() {
        const query = searchFilter.value.trim().toLowerCase();
        registryList.innerHTML = "";

        (campusGeoJSON.features || []).forEach((feat, index) => {
            const name = feat.properties?.name || "Unnamed Feature";
            const category = feat.properties?.category || (feat.geometry.type === "LineString" ? "Walkway Corridor" : "Campus Site");

            if (query && !name.toLowerCase().includes(query) && !category.toLowerCase().includes(query)) return;

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
                    <button type="button" class="btn-icon btn-edit" title="Edit Position"><i class="fa-solid fa-pencil"></i></button>
                    <button type="button" class="btn-icon btn-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
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