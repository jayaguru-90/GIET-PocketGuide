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

    const CAMPUS_BOUNDS = L.latLngBounds(
        [19.0430, 83.8260],
        [19.0545, 83.8395]
    );

    // ================= STATE & REFS =================
    let campusGeoJSON = { type: "FeatureCollection", features: [] };
    let activeTab = "locations";
    let editingFeatureIndex = null;
    let map = null;
    let tempPlacementMarker = null;

    let isDrawingRoute = false;
    let drawnRoutePoints = [];
    let drawingPolyline = null;
    let routeVertexMarkers = [];
    let routeMidpointMarkers = [];

    let snapGuideLayers = L.layerGroup();
    let snapIndicatorMarker = null;
    const SNAP_THRESHOLD_METERS = 8.0;

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
    const btnBatchSaveFloor = document.getElementById("btn-batch-save-floor");
    const unsavedCountBadge = document.getElementById("unsaved-count");
    const adminFloorRoomsList = document.getElementById("admin-floor-rooms-list");
    const roomFormTitle = document.getElementById("room-form-title");

    // Live Blueprint Preview Elements
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
    let pendingChangesCount = 0;

    const registryList = document.getElementById("registry-list");
    const searchFilter = document.getElementById("search-filter");
    const exportGeojsonBtn = document.getElementById("export-geojson-btn");
    const mapModeText = document.getElementById("map-mode-text");

    const GIET_CENTER = [19.0485, 83.8320];

    function markPendingChanges() {
        pendingChangesCount++;
        if (unsavedCountBadge) unsavedCountBadge.textContent = pendingChangesCount;
    }

    function clearPendingChanges() {
        pendingChangesCount = 0;
        if (unsavedCountBadge) unsavedCountBadge.textContent = "0";
    }

    // Category Synchronizer: Robust matching for select option values
    function setCategoryDropdownValue(selectEl, rawValue) {
        if (!selectEl) return;
        const target = String(rawValue || "").toLowerCase().trim();
        let matchedIndex = 0;

        for (let i = 0; i < selectEl.options.length; i++) {
            const optVal = selectEl.options[i].value.toLowerCase().trim();
            const optText = selectEl.options[i].textContent.toLowerCase().trim();

            if (optVal === target || optText === target) {
                matchedIndex = i;
                break;
            }
            if ((target.includes("corridor") || target.includes("walk") || target.includes("hallway")) &&
                (optVal.includes("corridor") || optText.includes("walk") || optText.includes("corridor"))) {
                matchedIndex = i;
                break;
            }
            if (target.includes("stair") && (optVal.includes("stair") || optText.includes("stair"))) {
                matchedIndex = i;
                break;
            }
            if ((target.includes("lift") || target.includes("elevator")) && (optVal.includes("lift") || optText.includes("lift"))) {
                matchedIndex = i;
                break;
            }
            if ((target.includes("office") || target.includes("cabin")) && (optVal.includes("office") || optText.includes("office"))) {
                matchedIndex = i;
                break;
            }
            if (target.includes("lab") && (optVal.includes("lab") || optText.includes("lab"))) {
                matchedIndex = i;
                break;
            }
            if ((target.includes("washroom") || target.includes("toilet") || target.includes("wc")) &&
                (optVal.includes("washroom") || optText.includes("washroom"))) {
                matchedIndex = i;
                break;
            }
            if ((target.includes("water") || target.includes("utility")) &&
                (optVal.includes("utility") || optText.includes("water") || optVal.includes("water"))) {
                matchedIndex = i;
                break;
            }
        }

        selectEl.selectedIndex = matchedIndex;
    }

    function getNormalizedCategoryClass(rawType = "") {
        const t = String(rawType).toLowerCase().trim();
        if (t.includes("corridor") || t.includes("hallway") || t.includes("walkway") || t.includes("walk")) return "corridor";
        if (t.includes("stair")) return "stairs";
        if (t.includes("lift") || t.includes("elevator")) return "lift";
        if (t.includes("lab")) return "laboratory";
        if (t.includes("office") || t.includes("cabin") || t.includes("sec") || t.includes("hod")) return "office";
        if (t.includes("washroom") || t.includes("toilet") || t.includes("wc") || t.includes("water")) return "utility";
        if (t.includes("auditorium")) return "auditorium";
        return "classroom";
    }

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
            minZoom: 16,
            maxZoom: 22,
            tap: false,
            maxBounds: CAMPUS_BOUNDS,
            maxBoundsViscosity: 1.0
        }).setView(GIET_CENTER, 18);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
            maxZoom: 22,
            maxNativeZoom: 20,
            bounds: CAMPUS_BOUNDS,
            attribution: "&copy; Google Satellite &mdash; GIET University"
        }).addTo(map);

        snapGuideLayers.addTo(map);

        map.on("click", handleMapClick);
        map.on("mousemove", handleMapMouseMove);
        loadFeatures();
    }

    // ================= 3. GEOMETRY & MAGNETIC SNAPPING =================
    function haversineDistMeters(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(a));
    }

    function getAllExistingNodes() {
        const nodes = [];
        (campusGeoJSON.features || []).forEach((feat, fIdx) => {
            if (fIdx === editingFeatureIndex) return;

            const geom = feat.geometry || {};
            if (geom.type === "Point") {
                nodes.push({
                    lat: geom.coordinates[1],
                    lng: geom.coordinates[0],
                    name: feat.properties?.name || "Landmark"
                });
            } else if (geom.type === "LineString") {
                (geom.coordinates || []).forEach(coord => {
                    nodes.push({
                        lat: coord[1],
                        lng: coord[0],
                        name: feat.properties?.name || "Walkway Node"
                    });
                });
            }
        });
        return nodes;
    }

    function getMagneticSnapTarget(lat, lng) {
        const allNodes = getAllExistingNodes();
        let closest = null;
        let minD = SNAP_THRESHOLD_METERS;

        for (const n of allNodes) {
            const d = haversineDistMeters(lat, lng, n.lat, n.lng);
            if (d < minD) {
                minD = d;
                closest = { lat: n.lat, lng: n.lng, name: n.name, dist: d };
            }
        }
        return closest;
    }

    function renderSnapGuides() {
        snapGuideLayers.clearLayers();
        if (activeTab !== "routes") return;

        const allNodes = getAllExistingNodes();
        allNodes.forEach(node => {
            const circle = L.circleMarker([node.lat, node.lng], {
                radius: 4,
                fillColor: "#38bdf8",
                color: "#ffffff",
                weight: 1.5,
                opacity: 0.8,
                fillOpacity: 0.6,
                interactive: false
            });
            snapGuideLayers.addLayer(circle);
        });
    }

    function handleMapMouseMove(e) {
        if (activeTab !== "routes" || !isDrawingRoute) {
            if (snapIndicatorMarker) {
                map.removeLayer(snapIndicatorMarker);
                snapIndicatorMarker = null;
            }
            return;
        }

        const snapped = getMagneticSnapTarget(e.latlng.lat, e.latlng.lng);
        if (snapped) {
            if (!snapIndicatorMarker) {
                snapIndicatorMarker = L.marker([snapped.lat, snapped.lng], {
                    interactive: false,
                    icon: L.divIcon({
                        className: "magnetic-snap-pulse",
                        html: `<div style="width:20px; height:20px; border:2px solid #38bdf8; border-radius:50%; background:rgba(56,189,248,0.35); box-shadow:0 0 10px #38bdf8;"></div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                }).addTo(map);
            } else {
                snapIndicatorMarker.setLatLng([snapped.lat, snapped.lng]);
            }
        } else if (snapIndicatorMarker) {
            map.removeLayer(snapIndicatorMarker);
            snapIndicatorMarker = null;
        }
    }

    function findClosestSegmentIndex(clickLatLng, points) {
        if (points.length < 2) return -1;
        let bestIndex = -1;
        let minDistance = Infinity;

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = L.latLng(points[i][0], points[i][1]);
            const p2 = L.latLng(points[i + 1][0], points[i + 1][1]);
            
            const dist = L.LineUtil.pointToSegmentDistance(
                map.latLngToLayerPoint(clickLatLng),
                map.latLngToLayerPoint(p1),
                map.latLngToLayerPoint(p2)
            );

            if (dist < minDistance) {
                minDistance = dist;
                bestIndex = i;
            }
        }
        return minDistance < 15 ? bestIndex : -1;
    }

    // ================= 4. MAP FEATURE RENDERING =================
    function loadFeatures() {
        fetch(`${API_URL}/api/campus-data`)
            .then(res => res.json())
            .then(data => {
                campusGeoJSON = data.geojson;
                renderFeaturesOnMap();
                renderRegistryList();
                renderSnapGuides();
            })
            .catch(() => {
                fetch("assets/data/giet_campus.geojson")
                    .then(res => res.json())
                    .then(data => {
                        campusGeoJSON = data;
                        renderFeaturesOnMap();
                        renderRegistryList();
                        renderSnapGuides();
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

            if (editingFeatureIndex === index && geom.type === "LineString") {
                return;
            }

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
                    weight: 4,
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

    // ================= 5. MAP CLICKS & DYNAMIC NODE INSERTION =================
    function handleMapClick(e) {
        if (activeTab === "structure") return;

        let finalLat = e.latlng.lat;
        let finalLng = e.latlng.lng;

        if (activeTab === "locations") {
            locLat.value = finalLat.toFixed(6);
            locLng.value = finalLng.toFixed(6);

            if (tempPlacementMarker) {
                tempPlacementMarker.setLatLng([finalLat, finalLng]);
            } else {
                tempPlacementMarker = L.marker([finalLat, finalLng], {
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
            const snap = getMagneticSnapTarget(finalLat, finalLng);
            if (snap) {
                finalLat = snap.lat;
                finalLng = snap.lng;
            }

            const segIdx = findClosestSegmentIndex(e.latlng, drawnRoutePoints);
            if (segIdx !== -1) {
                drawnRoutePoints.splice(segIdx + 1, 0, [finalLat, finalLng]);
            } else {
                drawnRoutePoints.push([finalLat, finalLng]);
            }

            refreshRouteVerticesAndPolyline();
        }
    }

    function refreshRouteVerticesAndPolyline() {
        routeVertexMarkers.forEach(m => map.removeLayer(m));
        routeVertexMarkers = [];

        routeMidpointMarkers.forEach(m => map.removeLayer(m));
        routeMidpointMarkers = [];

        if (!drawingPolyline) {
            drawingPolyline = L.polyline(drawnRoutePoints, {
                color: "#38bdf8",
                weight: 5,
                opacity: 0.95,
                dashArray: "4, 6"
            }).addTo(map);

            drawingPolyline.on("click", (e) => {
                if (!isDrawingRoute) return;
                L.DomEvent.stopPropagation(e);
                const segIdx = findClosestSegmentIndex(e.latlng, drawnRoutePoints);
                if (segIdx !== -1) {
                    drawnRoutePoints.splice(segIdx + 1, 0, [e.latlng.lat, e.latlng.lng]);
                    refreshRouteVerticesAndPolyline();
                }
            });
        } else {
            drawingPolyline.setLatLngs(drawnRoutePoints);
        }

        drawnRoutePoints.forEach((pt, idx) => {
            const vMarker = L.marker(pt, {
                draggable: true,
                icon: L.divIcon({
                    className: 'route-vertex-pin',
                    html: `<div style="width:14px; height:14px; background:#38bdf8; border:2.5px solid #ffffff; border-radius:50%; box-shadow:0 0 8px rgba(0,0,0,0.8); cursor:move;"></div>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                })
            }).addTo(map);

            vMarker.bindTooltip(`Node ${idx + 1} (Right-click to remove)`, { direction: "top", offset: [0, -6] });

            vMarker.on("drag", (ev) => {
                let dragLat = ev.latlng.lat;
                let dragLng = ev.latlng.lng;

                const snap = getMagneticSnapTarget(dragLat, dragLng);
                if (snap) {
                    dragLat = snap.lat;
                    dragLng = snap.lng;
                    vMarker.setLatLng([dragLat, dragLng]);
                }

                drawnRoutePoints[idx] = [dragLat, dragLng];
                if (drawingPolyline) drawingPolyline.setLatLngs(drawnRoutePoints);
            });

            vMarker.on("dragend", () => {
                refreshRouteVerticesAndPolyline();
            });

            vMarker.on("contextmenu", (ev) => {
                L.DomEvent.stopPropagation(ev);
                drawnRoutePoints.splice(idx, 1);
                refreshRouteVerticesAndPolyline();
            });

            routeVertexMarkers.push(vMarker);
        });

        for (let i = 0; i < drawnRoutePoints.length - 1; i++) {
            const midLat = (drawnRoutePoints[i][0] + drawnRoutePoints[i + 1][0]) / 2;
            const midLng = (drawnRoutePoints[i][1] + drawnRoutePoints[i + 1][1]) / 2;

            const midMarker = L.marker([midLat, midLng], {
                draggable: true,
                icon: L.divIcon({
                    className: 'route-midpoint-pin',
                    html: `<div style="width:10px; height:10px; background:rgba(255,255,255,0.7); border:2px dashed #0284c7; border-radius:50%; box-shadow:0 0 5px rgba(0,0,0,0.5); cursor:pointer;"></div>`,
                    iconSize: [10, 10],
                    iconAnchor: [5, 5]
                })
            }).addTo(map);

            midMarker.bindTooltip(`+ Add Node Here`, { direction: "top", offset: [0, -5] });

            midMarker.on("click", (ev) => {
                L.DomEvent.stopPropagation(ev);
                drawnRoutePoints.splice(i + 1, 0, [midLat, midLng]);
                refreshRouteVerticesAndPolyline();
            });

            midMarker.on("dragstart", () => {
                drawnRoutePoints.splice(i + 1, 0, [midLat, midLng]);
            });

            midMarker.on("drag", (ev) => {
                drawnRoutePoints[i + 1] = [ev.latlng.lat, ev.latlng.lng];
                if (drawingPolyline) drawingPolyline.setLatLngs(drawnRoutePoints);
            });

            midMarker.on("dragend", () => {
                refreshRouteVerticesAndPolyline();
            });

            routeMidpointMarkers.push(midMarker);
        }

        saveRouteBtn.disabled = drawnRoutePoints.length < 2;
        if (drawnRoutePoints.length > 0) {
            clearDrawingBtn.classList.remove("hidden");
        }
    }

    // ================= 6. SAVE POINT =================
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
            renderSnapGuides();
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

    // ================= 7. ROUTE DRAWING & EDITING =================
    startDrawingBtn.addEventListener("click", (e) => {
        e.preventDefault();
        isDrawingRoute = !isDrawingRoute;
        if (isDrawingRoute) {
            startDrawingBtn.innerHTML = `<i class="fa-solid fa-pause"></i> <span>Pause Adding</span>`;
            clearDrawingBtn.classList.remove("hidden");
            drawingInfo.innerHTML = `Click map to place nodes. Click <strong>+ midpoints</strong> or anywhere along the line to add middle nodes.<br><small style="color:#38bdf8;">Right-click any node to delete it.</small>`;
            mapModeText.textContent = "Drawing Walkway";
            renderSnapGuides();
        } else {
            startDrawingBtn.innerHTML = `<i class="fa-solid fa-pen-nib"></i> <span>Resume Adding</span>`;
            mapModeText.textContent = "Drawing Paused";
        }
    });

    clearDrawingBtn.addEventListener("click", (e) => {
        e.preventDefault();
        drawnRoutePoints = [];
        routeVertexMarkers.forEach(m => map.removeLayer(m));
        routeVertexMarkers = [];
        routeMidpointMarkers.forEach(m => map.removeLayer(m));
        routeMidpointMarkers = [];
        if (drawingPolyline) {
            map.removeLayer(drawingPolyline);
            drawingPolyline = null;
        }
        saveRouteBtn.disabled = true;
        clearDrawingBtn.classList.add("hidden");
    });

    routeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (drawnRoutePoints.length < 2) {
            alert("A walkway requires at least 2 points.");
            return;
        }

        const payload = {
            id: editingFeatureIndex,
            name: routeName.value.trim() || "Walkway Corridor",
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

        routeVertexMarkers.forEach(m => map.removeLayer(m));
        routeVertexMarkers = [];
        routeMidpointMarkers.forEach(m => map.removeLayer(m));
        routeMidpointMarkers = [];

        if (drawingPolyline) {
            map.removeLayer(drawingPolyline);
            drawingPolyline = null;
        }
        if (snapIndicatorMarker) {
            map.removeLayer(snapIndicatorMarker);
            snapIndicatorMarker = null;
        }

        startDrawingBtn.innerHTML = `<i class="fa-solid fa-pen-nib"></i> <span>Draw Path</span>`;
        clearDrawingBtn.classList.add("hidden");
        if (cancelRouteBtn) cancelRouteBtn.classList.add("hidden");
        saveRouteBtn.disabled = true;
        drawingInfo.innerHTML = `Click <strong>Draw Path</strong> to begin. Click along line segments or midpoint handles to add nodes.`;
        mapModeText.textContent = "Inspection Mode";
        renderFeaturesOnMap();
        renderSnapGuides();
    }

    if (cancelRouteBtn) {
        cancelRouteBtn.addEventListener("click", resetRouteForm);
    }

    // ================= 8. TAB SWITCHING (ISOLATED EXECUTION) =================
    function activateTab(tabName) {
        activeTab = tabName;

        tabLocationsBtn.classList.toggle("active", tabName === "locations");
        tabRoutesBtn.classList.toggle("active", tabName === "routes");
        if (tabStructureBtn) tabStructureBtn.classList.toggle("active", tabName === "structure");

        locationPanel.classList.toggle("hidden", tabName !== "locations");
        routePanel.classList.toggle("hidden", tabName !== "routes");
        if (structurePanel) structurePanel.classList.toggle("hidden", tabName !== "structure");

        if (adminBlueprintViewport) {
            adminBlueprintViewport.classList.toggle("hidden", tabName !== "structure");
        }

        if (tabName === "locations") {
            mapModeText.textContent = "Inspection Mode";
            snapGuideLayers.clearLayers();
            resetRouteForm();
        } else if (tabName === "routes") {
            mapModeText.textContent = "Corridor Mode";
            renderSnapGuides();
        } else if (tabName === "structure") {
            mapModeText.textContent = "Floor Plan Mode";
            snapGuideLayers.clearLayers();
            loadBuildingsIntoDropdown();
            resetRouteForm();
        }
    }

    tabLocationsBtn.addEventListener("click", (e) => {
        e.preventDefault();
        activateTab("locations");
    });

    tabRoutesBtn.addEventListener("click", (e) => {
        e.preventDefault();
        activateTab("routes");
    });

    if (tabStructureBtn) {
        tabStructureBtn.addEventListener("click", (e) => {
            e.preventDefault();
            activateTab("structure");
        });
    }

    // ================= 9. LIVE BLUEPRINT PREVIEW & IN-CANVAS ACTIONS =================
    function renderLiveBlueprintPreview() {
        if (!adminBlueprintCanvas) return;
        adminBlueprintCanvas.innerHTML = "";

        const selectedFloorId = parseInt(adminFloorSelect.value);
        const floorObj = currentFloorsCache.find(f => f.id === selectedFloorId);

        if (previewFloorTitle && floorObj) {
            previewFloorTitle.textContent = `${adminBldgSelect.value} - ${floorObj.name} (Live Canvas)`;
        }

        if (!floorObj || !floorObj.rooms || floorObj.rooms.length === 0) {
            adminBlueprintCanvas.innerHTML = `<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 13px; pointer-events: none;">No rooms on this floor. Click "Draw Box" to start.</div>`;
            return;
        }

        const currentlyEditingId = adminRoomId.value ? parseInt(adminRoomId.value) : null;

        floorObj.rooms.forEach(r => {
            const block = document.createElement("div");
            const catClass = getNormalizedCategoryClass(r.type);

            block.className = `admin-preview-room ${catClass}`;
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
                <button type="button" class="btn-canvas-del-room" title="Delete box" style="position: absolute; top: 2px; right: 2px; width: 16px; height: 16px; font-size: 9px; line-height: 1; border-radius: 50%; background: #ef4444; color: #fff; border: none; cursor: pointer; display: none; align-items: center; justify-content: center;">✕</button>
                <div class="room-resize-handle"></div>
            `;

            const quickDelBtn = block.querySelector(".btn-canvas-del-room");
            if (currentlyEditingId === r.id && quickDelBtn) {
                quickDelBtn.style.display = "flex";
            }

            if (quickDelBtn) {
                quickDelBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    deleteRoomFromMemory(r.id);
                });
            }

            block.addEventListener("click", (e) => {
                e.stopPropagation();
                if (isDrawMode || e.target.classList.contains("room-resize-handle") || e.target.classList.contains("btn-canvas-del-room")) return;

                adminRoomId.value = r.id;
                roomNumVal.value = r.number;
                roomNameVal.value = r.name;
                setCategoryDropdownValue(roomTypeVal, r.type);
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

            block.addEventListener("mousedown", (e) => {
                if (isDrawMode || e.target.classList.contains("room-resize-handle") || e.target.classList.contains("btn-canvas-del-room")) return;
                e.stopPropagation();

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
                    markPendingChanges();
                }

                window.addEventListener("mousemove", moveDrag);
                window.addEventListener("mouseup", stopDrag);
            });

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
                        markPendingChanges();
                    }

                    window.addEventListener("mousemove", doResize);
                    window.addEventListener("mouseup", stopResize);
                });
            }

            adminBlueprintCanvas.appendChild(block);
        });
    }

    function deleteRoomFromMemory(roomId) {
        const selectedFloorId = parseInt(adminFloorSelect.value);
        const floorObj = currentFloorsCache.find(f => f.id === selectedFloorId);
        if (floorObj) {
            floorObj.rooms = floorObj.rooms.filter(rm => rm.id !== roomId);
        }
        markPendingChanges();
        resetRoomEditor();
        renderAdminRoomsList();
        renderLiveBlueprintPreview();
    }

    if (btnDeleteActiveRoom) {
        btnDeleteActiveRoom.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const currentId = adminRoomId.value ? parseInt(adminRoomId.value) : null;
            if (!currentId) return;
            deleteRoomFromMemory(currentId);
        });
    }

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
                markPendingChanges();
                renderLiveBlueprintPreview();
            }
        });
    });

    // ================= 10. MANUAL BOX DRAWING (ROBUST POINTER ENGINE) =================
    let drawStartX = 0, drawStartY = 0;
    let tempDrawBox = null;

    adminBlueprintCanvas.addEventListener("mousedown", (e) => {
        if (!isDrawMode) return;
        e.preventDefault();
        e.stopPropagation();

        const rect = adminBlueprintCanvas.getBoundingClientRect();
        drawStartX = e.clientX - rect.left;
        drawStartY = e.clientY - rect.top;

        tempDrawBox = document.createElement("div");
        tempDrawBox.className = "drawing-selection-box";
        tempDrawBox.style.left = `${drawStartX}px`;
        tempDrawBox.style.top = `${drawStartY}px`;
        adminBlueprintCanvas.appendChild(tempDrawBox);

        function onMouseMove(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const curX = Math.max(0, Math.min(900, ev.clientX - rect.left));
            const curY = Math.max(0, Math.min(480, ev.clientY - rect.top));
            const x = Math.min(drawStartX, curX);
            const y = Math.min(drawStartY, curY);
            const w = Math.abs(curX - drawStartX);
            const h = Math.abs(curY - drawStartY);

            if (tempDrawBox) {
                tempDrawBox.style.left = `${x}px`;
                tempDrawBox.style.top = `${y}px`;
                tempDrawBox.style.width = `${w}px`;
                tempDrawBox.style.height = `${h}px`;
            }
        }

        function onMouseUp(ev) {
            ev.preventDefault();
            ev.stopPropagation();

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

            if (w > 20 && h > 20) {
                const selectedFloorId = parseInt(adminFloorSelect.value);
                if (!selectedFloorId) {
                    alert("Please select or add a floor first.");
                    return;
                }

                const floorObj = currentFloorsCache.find(f => f.id === selectedFloorId);
                const nextNum = (floorObj && floorObj.rooms ? floorObj.rooms.length + 1 : 1);
                const newTempId = Date.now();
                const defaultCode = `ROOM-${nextNum}`;

                // Add to active floor in-memory
                if (floorObj) {
                    if (!floorObj.rooms) floorObj.rooms = [];
                    floorObj.rooms.push({
                        id: newTempId,
                        number: defaultCode,
                        name: `Room ${nextNum}`,
                        type: roomTypeVal.value || "Classroom",
                        description: "",
                        plan: { x, y, w, h }
                    });
                }

                markPendingChanges();

                // Select the new room in sidebar form
                adminRoomId.value = newTempId;
                if (roomXVal) roomXVal.value = x;
                if (roomYVal) roomYVal.value = y;
                if (roomWVal) roomWVal.value = w;
                if (roomHVal) roomHVal.value = h;
                if (roomNumVal) roomNumVal.value = defaultCode;
                if (roomNameVal) roomNameVal.value = `Room ${nextNum}`;
                roomFormTitle.textContent = `New Box: ${defaultCode}`;
                btnCancelEditRoom.classList.remove("hidden");
                if (btnDeleteActiveRoom) btnDeleteActiveRoom.classList.remove("hidden");

                // Exit drawing mode automatically so clicks work normally
                isDrawMode = false;
                btnDrawRoom.style.background = "";
                btnDrawRoom.style.color = "";
                btnDrawRoom.innerHTML = `<i class="fa-solid fa-vector-square"></i> Draw Box`;
                adminBlueprintCanvas.style.cursor = "default";

                renderAdminRoomsList();
                renderLiveBlueprintPreview();
            }
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    });

    // ================= 11. BUILDINGS DEDUPLICATION =================
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

            clearPendingChanges();
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
                setCategoryDropdownValue(roomTypeVal, r.type);
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

            item.querySelector(".btn-delete").addEventListener("click", () => {
                deleteRoomFromMemory(r.id);
            });

            adminFloorRoomsList.appendChild(item);
        });

        renderLiveBlueprintPreview();
    }

    if (btnAddFloor) {
        btnAddFloor.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
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
            e.stopPropagation();
            const selectedFloorId = parseInt(adminFloorSelect.value);
            if (!selectedFloorId) {
                alert("Please select a valid floor to delete.");
                return;
            }

            const floorObj = currentFloorsCache.find(f => f.id === selectedFloorId);
            const floorName = floorObj ? floorObj.name : `Floor ID ${selectedFloorId}`;

            if (!confirm(`Are you sure you want to delete "${floorName}" and all its rooms?`)) return;

            try {
                const res = await fetch(`${API_URL}/api/admin/floor/${selectedFloorId}`, {
                    method: "DELETE"
                });
                if (!res.ok) throw new Error("Failed to delete floor from DB");
                resetRoomEditor();
                loadFloorsForSelectedBuilding();
            } catch (err) {
                alert(`Error deleting floor: ${err.message}`);
            }
        });
    }

    // Apply Room Edit in-memory (No slow network turnaround)
    if (adminRoomForm) {
        adminRoomForm.addEventListener("submit", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const selectedFloorId = parseInt(adminFloorSelect.value);
            const floorObj = currentFloorsCache.find(f => f.id === selectedFloorId);
            if (!floorObj) return;

            const currentId = adminRoomId.value ? parseInt(adminRoomId.value) : null;
            const updatedRoomData = {
                id: currentId || Date.now(),
                number: roomNumVal.value.trim(),
                name: roomNameVal.value.trim(),
                type: roomTypeVal.value,
                description: roomDescVal.value.trim(),
                plan: {
                    x: parseInt(roomXVal.value) || 40,
                    y: parseInt(roomYVal.value) || 40,
                    w: parseInt(roomWVal.value) || 60,
                    h: parseInt(roomHVal.value) || 60
                }
            };

            if (!floorObj.rooms) floorObj.rooms = [];

            if (currentId) {
                const targetIdx = floorObj.rooms.findIndex(r => r.id === currentId);
                if (targetIdx !== -1) {
                    floorObj.rooms[targetIdx] = updatedRoomData;
                } else {
                    floorObj.rooms.push(updatedRoomData);
                }
            } else {
                floorObj.rooms.push(updatedRoomData);
            }

            markPendingChanges();
            renderAdminRoomsList();
            renderLiveBlueprintPreview();
        });
    }

    // MASTER BATCH SAVE: Save all rooms in one request
    if (btnBatchSaveFloor) {
        btnBatchSaveFloor.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const selectedFloorId = parseInt(adminFloorSelect.value);
            if (!selectedFloorId) {
                alert("Please select a floor first.");
                return;
            }

            const floorObj = currentFloorsCache.find(f => f.id === selectedFloorId);
            if (!floorObj) return;

            btnBatchSaveFloor.disabled = true;
            btnBatchSaveFloor.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving All Rooms...`;

            try {
                // Save each room in the staged list to the database
                for (const r of floorObj.rooms) {
                    await fetch(`${API_URL}/api/admin/save-room`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            id: r.id && r.id < 1000000000000 ? r.id : null, // Fresh IDs from Date.now() will insert as new rows
                            floor_id: selectedFloorId,
                            number: r.number,
                            name: r.name,
                            type: r.type,
                            description: r.description,
                            x: r.plan.x,
                            y: r.plan.y,
                            w: r.plan.w,
                            h: r.plan.h
                        })
                    });
                }

                alert("All floor changes saved to database successfully!");
                clearPendingChanges();
                await loadFloorsForSelectedBuilding();
            } catch (err) {
                console.error("Batch save error:", err);
                alert("Could not complete batch save. Verify backend connectivity.");
            } finally {
                btnBatchSaveFloor.disabled = false;
                btnBatchSaveFloor.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Save All Floor Changes to DB (${pendingChangesCount})`;
            }
        });
    }

    function resetRoomEditor() {
        adminRoomId.value = "";
        roomNumVal.value = "";
        roomNameVal.value = "";
        roomDescVal.value = "";
        roomFormTitle.textContent = "Floor & Room Studio";
        btnCancelEditRoom.classList.add("hidden");
        if (btnDeleteActiveRoom) btnDeleteActiveRoom.classList.add("hidden");
        renderLiveBlueprintPreview();
    }

    btnCancelEditRoom.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetRoomEditor();
    });

    // ================= 12. REGISTERED OUTDOOR DIRECTORY =================
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
            activateTab("locations");
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
            activateTab("routes");
            routeId.value = index;
            routeName.value = feat.properties.name || "Walkway Corridor";
            
            drawnRoutePoints = feat.geometry.coordinates.map(c => [c[1], c[0]]);
            
            if (cancelRouteBtn) cancelRouteBtn.classList.remove("hidden");
            startDrawingBtn.innerHTML = `<i class="fa-solid fa-pause"></i> <span>Editing Nodes</span>`;
            isDrawingRoute = true;
            drawingInfo.innerHTML = `Editing <strong>${routeName.value}</strong>.<br><small style="color:#38bdf8;">Click midpoints to insert new nodes &bull; Drag dots or right-click to delete.</small>`;
            
            renderFeaturesOnMap();
            renderSnapGuides();
            refreshRouteVerticesAndPolyline();
            
            if (drawingPolyline) {
                map.fitBounds(drawingPolyline.getBounds(), { padding: [50, 50] });
            }
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
        resetRouteForm();
        loadFeatures();
    }

    exportGeojsonBtn.addEventListener("click", () => {
        const jsonStr = JSON.stringify(campusGeoJSON, null, 2);
        navigator.clipboard.writeText(jsonStr).then(() => {
            alert("Campus GeoJSON copied to clipboard!");
        });
    });

    // ================= 13. SKETCH UPLOAD =================
    if (btnUploadSketch) {
        btnUploadSketch.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            sketchFileInput.click();
        });
    }

    if (sketchFileInput) {
        sketchFileInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const selectedFloorId = parseInt(adminFloorSelect.value);
            if (!selectedFloorId) {
                alert("Please select or add a floor first.");
                return;
            }

            underlayUrl = URL.createObjectURL(file);
            adminBlueprintCanvas.style.backgroundImage = `url('${underlayUrl}')`;
            btnToggleUnderlay.classList.remove("hidden");
            isUnderlayVisible = true;
        });
    }

    if (btnToggleUnderlay) {
        btnToggleUnderlay.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            isUnderlayVisible = !isUnderlayVisible;
            adminBlueprintCanvas.style.backgroundImage = (isUnderlayVisible && underlayUrl) ? `url('${underlayUrl}')` : "none";
        });
    }

    // Toggle Draw Mode (Deselects current room so pointer events focus on drawing)
    if (btnDrawRoom) {
        btnDrawRoom.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            isDrawMode = !isDrawMode;
            btnDrawRoom.style.background = isDrawMode ? "#2563eb" : "";
            btnDrawRoom.style.color = isDrawMode ? "#fff" : "";
            btnDrawRoom.innerHTML = isDrawMode 
                ? `<i class="fa-solid fa-check"></i> Exit Draw` 
                : `<i class="fa-solid fa-vector-square"></i> Draw Box`;
            adminBlueprintCanvas.style.cursor = isDrawMode ? "crosshair" : "default";

            // Deselect any active room so its handles don't block canvas clicks
            if (isDrawMode) {
                resetRoomEditor();
            } else {
                renderLiveBlueprintPreview();
            }
        });
    }

    checkAuth();
});