document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_URL = isLocal ? "http://127.0.0.1:8000" : "https://giet-campus-api.onrender.com";

    // DOM Elements
    const buildingHeaderName = document.getElementById('building-header-name');
    const selectedBuildingLabel = document.getElementById('selected-building-label');
    const buildingPickerTrigger = document.getElementById('building-picker-trigger');
    const buildingModalSheet = document.getElementById('building-modal-sheet');
    const sheetBackdrop = document.getElementById('sheet-backdrop');
    const btnCloseSheet = document.getElementById('btn-close-sheet');
    const sheetBuildingSearch = document.getElementById('sheet-building-search');
    const buildingOptionsList = document.getElementById('building-options-list');

    const floorTabsContainer = document.getElementById('floor-tabs-container');
    const blueprintBoard = document.getElementById('blueprint-board');
    const blueprintViewport = document.getElementById('blueprint-viewport');
    const currentFloorLabel = document.getElementById('current-floor-label');
    const roomSearchInput = document.getElementById('room-search-input');
    const themeToggle = document.getElementById('theme-toggle');

    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomReset = document.getElementById('btn-zoom-reset');

    const roomDetailCard = document.getElementById('room-detail-card');
    const roomTypeTag = document.getElementById('room-type-tag');
    const roomTitle = document.getElementById('room-title');
    const roomDescription = document.getElementById('room-description');
    const closeCardBtn = document.getElementById('close-card-btn');
    const legendGroup = document.getElementById('blueprint-legend-group');

    let buildingsList = [];
    let floorsData = [];
    let activeFloorIndex = 0;
    let activeCategoryFilter = 'all';

    // Read URL query parameters (?name=... or ?building=..., and ?room=...)
    const urlParams = new URLSearchParams(window.location.search);
    let activeBuilding = (urlParams.get('building') || urlParams.get('name') || "CSA Block").trim();
    const targetFloorParam = urlParams.get('floor');
    const targetRoomCode = urlParams.get('room') ? urlParams.get('room').trim().toLowerCase() : null;

    // Gestures and Matrix Pan/Zoom State
    let scale = 1.0;
    let panX = 0;
    let panY = 0;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    let isPinching = false;
    let initialPinchDist = 0;
    let initialPinchScale = 1.0;
    let pinchMidX = 0;
    let pinchMidY = 0;

    // ================= 1. THEME ENGINE =================
    function initTheme() {
        const savedTheme = localStorage.getItem('giet-theme') || 'dark';
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            if (themeToggle) themeToggle.innerHTML = `<i class="fa-solid fa-sun" style="color:#fbbf24;"></i>`;
        } else {
            document.body.classList.remove('dark-mode');
            if (themeToggle) themeToggle.innerHTML = `<i class="fa-solid fa-moon"></i>`;
        }
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('dark-mode');
            localStorage.setItem('giet-theme', isDark ? 'dark' : 'light');
            initTheme();
        });
    }
    initTheme();

    // ================= 2. CATEGORY CLASSIFICATION NORMALIZER =================
    // Normalizes admin dropdown labels (including emojis/spaces) to CSS classes
    function normalizeCategory(rawType = '') {
        const t = String(rawType).toLowerCase().trim();

        if (t.includes('corridor') || t.includes('hallway') || t.includes('walkway') || t.includes('passage') || t.includes('walk')) {
            return 'corridor';
        }
        if (t.includes('stair') || t.includes('step')) {
            return 'stairs';
        }
        if (t.includes('lift') || t.includes('elevator')) {
            return 'lift';
        }
        if (t.includes('lab')) {
            return 'laboratory';
        }
        if (t.includes('office') || t.includes('cabin') || t.includes('hod') || t.includes('faculty') || t.includes('sec')) {
            return 'office';
        }
        if (t.includes('washroom') || t.includes('toilet') || t.includes('wc') || t.includes('water') || t.includes('filter') || t.includes('utility')) {
            return 'utility';
        }
        if (t.includes('auditorium') || t.includes('hall')) {
            return 'auditorium';
        }
        return 'classroom';
    }

    // ================= 3. MODAL BOTTOM SHEET BUILDING PICKER =================
    async function initBuildingsData() {
        try {
            const res = await fetch(`${API_URL}/api/admin/buildings-list`, { signal: AbortSignal.timeout(3000) });
            buildingsList = await res.json();
        } catch (e) {
            buildingsList = ["CSA Block", "CSE Building", "Admin Block", "Library", "Mechanical building", "Bio tech Building", "Agriculture Block", "BSH Building"];
        }

        buildingsList = buildingsList.map(b => String(b).replace(/<[^>]*>?/gm, '').trim());

        const match = buildingsList.find(b => b.toLowerCase() === activeBuilding.toLowerCase());
        if (match) activeBuilding = match;
        else if (buildingsList.length > 0) activeBuilding = buildingsList[0];

        updateBuildingUI();
        loadBuildingFloors();
    }

    function updateBuildingUI() {
        if (buildingHeaderName) buildingHeaderName.textContent = activeBuilding;
        if (selectedBuildingLabel) selectedBuildingLabel.textContent = activeBuilding;
    }

    function openBuildingModalSheet() {
        if (!buildingModalSheet) return;
        renderSheetBuildingOptions("");
        if (sheetBuildingSearch) sheetBuildingSearch.value = "";
        buildingModalSheet.classList.remove('hidden');
        if (sheetBuildingSearch) setTimeout(() => sheetBuildingSearch.focus(), 150);
    }

    function closeBuildingModalSheet() {
        if (!buildingModalSheet) return;
        buildingModalSheet.classList.add('hidden');
    }

    function renderSheetBuildingOptions(filterText) {
        if (!buildingOptionsList) return;
        buildingOptionsList.innerHTML = "";
        const query = filterText.toLowerCase().trim();

        const filtered = buildingsList.filter(b => !query || b.toLowerCase().includes(query));

        if (filtered.length === 0) {
            buildingOptionsList.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-muted); font-size:12px;">No matching buildings found.</div>`;
            return;
        }

        filtered.forEach(b => {
            const item = document.createElement('div');
            item.className = `sheet-item ${b.toLowerCase() === activeBuilding.toLowerCase() ? 'active' : ''}`;
            item.innerHTML = `<span style="font-size:15px;">🏛️</span> <span>${b}</span>`;
            item.addEventListener('click', () => {
                activeBuilding = b;
                updateBuildingUI();
                activeFloorIndex = 0;
                closeBuildingModalSheet();
                loadBuildingFloors();
            });
            buildingOptionsList.appendChild(item);
        });
    }

    if (buildingPickerTrigger) buildingPickerTrigger.addEventListener('click', openBuildingModalSheet);
    if (sheetBackdrop) sheetBackdrop.addEventListener('click', closeBuildingModalSheet);
    if (btnCloseSheet) btnCloseSheet.addEventListener('click', closeBuildingModalSheet);
    if (sheetBuildingSearch) {
        sheetBuildingSearch.addEventListener('input', (e) => renderSheetBuildingOptions(e.target.value));
    }

    // ================= 4. FETCH LIVE FLOORS & ROOMS =================
    async function loadBuildingFloors() {
        if (blueprintBoard) {
            blueprintBoard.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading layout...</div>`;
        }

        try {
            const res = await fetch(`${API_URL}/api/buildings/${encodeURIComponent(activeBuilding)}/floors`);
            floorsData = await res.json();

            if (!floorsData || floorsData.length === 0) {
                if (blueprintBoard) {
                    blueprintBoard.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);">No floors configured for ${activeBuilding} yet.</div>`;
                }
                if (floorTabsContainer) floorTabsContainer.innerHTML = "";
                return;
            }

            if (targetFloorParam !== null && targetFloorParam !== undefined) {
                const fIdx = floorsData.findIndex(f => f.floor_number === parseInt(targetFloorParam));
                activeFloorIndex = fIdx !== -1 ? fIdx : 0;
            } else if (targetRoomCode) {
                const foundIdx = floorsData.findIndex(f => 
                    (f.rooms || []).some(r => r.number.toLowerCase().trim() === targetRoomCode)
                );
                activeFloorIndex = foundIdx !== -1 ? foundIdx : 0;
            } else {
                activeFloorIndex = 0;
            }

            renderFloorTabs();
            renderBlueprintCanvas();
        } catch (err) {
            console.warn("Database offline; using fallback dataset", err);
            loadFallbackCSA();
        }
    }

    function loadFallbackCSA() {
        if (activeBuilding.toLowerCase().includes("csa")) {
            floorsData = [{
                id: 1,
                building_name: "CSA Block",
                floor_number: 3,
                name: "Third Floor",
                rooms: [
                    { id: 1, number: "CSA-4", name: "CSA 4", type: "Classroom", description: "CSA 4 lecture hall", plan: { x: 105, y: 40, w: 65, h: 125 } },
                    { id: 2, number: "CSA-3", name: "CSA 3", type: "Classroom", description: "CSA 3 lecture hall", plan: { x: 178, y: 40, w: 65, h: 125 } },
                    { id: 3, number: "FC-2", name: "FC-2 EXAM SEC", type: "Office", description: "Examination Section", plan: { x: 250, y: 40, w: 120, h: 60 } },
                    { id: 4, number: "CSA-2", name: "CSA 2", type: "Classroom", description: "CSA 2 lecture hall", plan: { x: 512, y: 40, w: 60, h: 125 } },
                    { id: 5, number: "CSA-1", name: "CSA 1", type: "Classroom", description: "CSA 1 lecture hall", plan: { x: 578, y: 40, w: 60, h: 125 } },
                    { id: 6, number: "BEE-LAB", name: "BEE LAB", type: "Laboratory", description: "Basic Electrical Engineering Lab", plan: { x: 105, y: 285, w: 125, h: 125 } },
                    { id: 7, number: "BE-LAB", name: "BE LAB", type: "Laboratory", description: "Basic Electronics Lab", plan: { x: 242, y: 285, w: 125, h: 125 } },
                    { id: 8, number: "MPMC-LAB", name: "MPMC LAB", type: "Laboratory", description: "Microprocessor Lab", plan: { x: 379, y: 285, w: 125, h: 125 } },
                    { id: 9, number: "CSA-AUD", name: "CSA AUDITORIUM", type: "Auditorium", description: "CSA Department Auditorium", plan: { x: 516, y: 285, w: 140, h: 125 } },
                    { id: 10, number: "WATER-FILTER", name: "WATER FILTER", type: "Utility", description: "Drinking Water Station", plan: { x: 668, y: 40, w: 70, h: 150 } },
                    { id: 11, number: "WC-M", name: "STUDENT TOILET (M)", type: "Washroom", description: "Boys Washroom", plan: { x: 748, y: 40, w: 110, h: 50 } },
                    { id: 12, number: "WC-F", name: "STUDENT TOILET (F)", type: "Washroom", description: "Girls Washroom", plan: { x: 748, y: 270, w: 110, h: 55 } },
                    { id: 13, number: "HOD", name: "HoD CHAMBER", type: "Office", description: "Head of Department Room", plan: { x: 668, y: 355, w: 105, h: 55 } },
                    { id: 14, number: "HALLWAY-1", name: "Main Corridor", type: "🚶 Walk Corridor / Hallway", description: "Central connecting walkway", plan: { x: 105, y: 178, w: 533, h: 90 } }
                ]
            }];
            renderFloorTabs();
            renderBlueprintCanvas();
        }
    }

    // ================= 5. CENTERING, PAN, PINCH & BOUNDARY CLAMPING =================
    function clampPan() {
        if (!blueprintBoard || !blueprintViewport) return;

        const currentFloor = floorsData[activeFloorIndex] || {};
        const baseWidth = currentFloor.canvas_w || 900;
        const baseHeight = currentFloor.canvas_h || 480;

        const scaledW = baseWidth * scale;
        const scaledH = baseHeight * scale;

        const viewW = blueprintViewport.clientWidth;
        const viewH = blueprintViewport.clientHeight;

        // Keep at least part of the canvas visible
        const marginX = Math.min(viewW * 0.4, 120);
        const marginY = Math.min(viewH * 0.4, 100);

        const minPanX = marginX - scaledW;
        const maxPanX = viewW - marginX;

        const minPanY = marginY - scaledH;
        const maxPanY = viewH - marginY;

        panX = Math.min(Math.max(panX, minPanX), maxPanX);
        panY = Math.min(Math.max(panY, minPanY), maxPanY);
    }

    function updateTransform() {
        if (!blueprintBoard) return;
        clampPan();
        blueprintBoard.style.transform = `translate(${panX.toFixed(2)}px, ${panY.toFixed(2)}px) scale(${scale.toFixed(4)})`;
    }

    function setScaleAtPoint(newScale, clientX, clientY) {
        if (!blueprintViewport) return;
        const rect = blueprintViewport.getBoundingClientRect();
        const originX = clientX - rect.left;
        const originY = clientY - rect.top;

        const clampedScale = Math.min(Math.max(newScale, 0.35), 3.0);
        const scaleRatio = clampedScale / scale;

        panX = originX - (originX - panX) * scaleRatio;
        panY = originY - (originY - panY) * scaleRatio;
        scale = clampedScale;

        updateTransform();
    }

    function autoFitCanvasToScreen() {
        if (!blueprintBoard || !blueprintViewport) return;

        const currentFloor = floorsData[activeFloorIndex] || {};
        const rooms = currentFloor.rooms || [];

        const baseWidth = currentFloor.canvas_w || 900;
        const baseHeight = currentFloor.canvas_h || 480;

        blueprintBoard.style.width = `${baseWidth}px`;
        blueprintBoard.style.height = `${baseHeight}px`;

        const viewW = blueprintViewport.clientWidth || 360;
        const viewH = blueprintViewport.clientHeight || 450;

        // Calculate actual bounding box occupied by rooms
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (rooms.length > 0) {
            rooms.forEach(r => {
                const p = r.plan || { x: 0, y: 0, w: 60, h: 60 };
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x + p.w);
                maxY = Math.max(maxY, p.y + p.h);
            });
        } else {
            minX = 0; minY = 0; maxX = baseWidth; maxY = baseHeight;
        }

        const contentW = maxX - minX || baseWidth;
        const contentH = maxY - minY || baseHeight;
        const contentCenterX = minX + contentW / 2;
        const contentCenterY = minY + contentH / 2;

        const padX = 24;
        const padY = 24;
        const scaleX = (viewW - padX) / contentW;
        const scaleY = (viewH - padY) / contentH;

        scale = Math.min(scaleX, scaleY, 1.25);
        if (scale < 0.35) scale = 0.35;

        // Center room cluster inside the viewport
        panX = (viewW / 2) - (contentCenterX * scale);
        panY = (viewH / 2) - (contentCenterY * scale);

        updateTransform();
    }

    function getDistance(t1, t2) {
        return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    }

    if (blueprintViewport) {
        // --- Touch Gestures ---
        blueprintViewport.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                dragStartX = e.touches[0].clientX - panX;
                dragStartY = e.touches[0].clientY - panY;
            } else if (e.touches.length === 2) {
                isDragging = false;
                isPinching = true;
                initialPinchDist = getDistance(e.touches[0], e.touches[1]);
                initialPinchScale = scale;
                pinchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                pinchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            }
        }, { passive: false });

        blueprintViewport.addEventListener('touchmove', (e) => {
            e.preventDefault();

            if (isPinching && e.touches.length === 2) {
                const dist = getDistance(e.touches[0], e.touches[1]);
                const newScale = initialPinchScale * (dist / initialPinchDist);
                setScaleAtPoint(newScale, pinchMidX, pinchMidY);
            } else if (isDragging && e.touches.length === 1) {
                panX = e.touches[0].clientX - dragStartX;
                panY = e.touches[0].clientY - dragStartY;
                updateTransform();
            }
        }, { passive: false });

        blueprintViewport.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                isDragging = false;
                isPinching = false;
            } else if (e.touches.length === 1) {
                isPinching = false;
                isDragging = true;
                dragStartX = e.touches[0].clientX - panX;
                dragStartY = e.touches[0].clientY - panY;
            }
        });

        // --- Mouse Gestures ---
        blueprintViewport.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragStartX = e.clientX - panX;
            dragStartY = e.clientY - panY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            panX = e.clientX - dragStartX;
            panY = e.clientY - dragStartY;
            updateTransform();
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });

        blueprintViewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomDelta = e.deltaY > 0 ? 0.88 : 1.14;
            setScaleAtPoint(scale * zoomDelta, e.clientX, e.clientY);
        }, { passive: false });
    }

    // Zoom Toolbar Controls
    if (btnZoomIn) {
        btnZoomIn.addEventListener('click', () => {
            const rect = blueprintViewport.getBoundingClientRect();
            setScaleAtPoint(scale * 1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
        });
    }

    if (btnZoomOut) {
        btnZoomOut.addEventListener('click', () => {
            const rect = blueprintViewport.getBoundingClientRect();
            setScaleAtPoint(scale * 0.8, rect.left + rect.width / 2, rect.top + rect.height / 2);
        });
    }

    if (btnZoomReset) {
        btnZoomReset.addEventListener('click', () => {
            autoFitCanvasToScreen();
        });
    }

    window.addEventListener('resize', autoFitCanvasToScreen);

    // ================= 6. RENDER BLUEPRINT & CATEGORY FILTER =================
    function renderFloorTabs() {
        if (!floorTabsContainer) return;
        floorTabsContainer.innerHTML = "";
        floorsData.forEach((f, idx) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `floor-pill-btn ${idx === activeFloorIndex ? 'active' : ''}`;
            btn.textContent = `${f.name} (Floor ${f.floor_number})`;
            btn.addEventListener("click", () => {
                activeFloorIndex = idx;
                document.querySelectorAll(".floor-pill-btn").forEach((b, i) => b.classList.toggle("active", i === idx));
                renderBlueprintCanvas();
            });
            floorTabsContainer.appendChild(btn);
        });
    }

    // Category Filter Buttons Handler
    if (legendGroup) {
        legendGroup.querySelectorAll('.legend-badge').forEach(badge => {
            badge.addEventListener('click', () => {
                legendGroup.querySelectorAll('.legend-badge').forEach(b => b.classList.remove('active'));
                badge.classList.add('active');
                activeCategoryFilter = badge.getAttribute('data-category') || 'all';
                applyCategoryFilterToBoxes();
            });
        });
    }

    function applyCategoryFilterToBoxes() {
        if (!blueprintBoard) return;
        const boxes = blueprintBoard.querySelectorAll('.blueprint-room-box');
        boxes.forEach(box => {
            const boxCat = box.getAttribute('data-normalized-cat');
            if (activeCategoryFilter === 'all' || boxCat === activeCategoryFilter) {
                box.classList.remove('dimmed');
            } else {
                box.classList.add('dimmed');
            }
        });
    }

    function renderBlueprintCanvas() {
        const currentFloor = floorsData[activeFloorIndex];
        if (!currentFloor || !blueprintBoard) return;

        if (currentFloorLabel) {
            currentFloorLabel.textContent = `${activeBuilding} - ${currentFloor.name}`;
        }
        blueprintBoard.innerHTML = "";

        const query = roomSearchInput ? roomSearchInput.value.trim().toLowerCase() : "";
        const rooms = currentFloor.rooms || [];

        const filteredRooms = rooms.filter(r => 
            !query || 
            r.name.toLowerCase().includes(query) || 
            r.number.toLowerCase().includes(query) || 
            (r.type || "").toLowerCase().includes(query)
        );

        if (filteredRooms.length === 0) {
            blueprintBoard.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);">No matching rooms found on this floor.</div>`;
            return;
        }

        let highlightedElement = null;
        let highlightedRoomData = null;

        filteredRooms.forEach(room => {
            const block = document.createElement("div");
            const normCat = normalizeCategory(room.type);
            block.className = `blueprint-room-box ${normCat}`;
            block.setAttribute('data-normalized-cat', normCat);
            
            const p = room.plan || { x: 40, y: 40, w: 60, h: 60 };
            block.style.left = `${p.x}px`;
            block.style.top = `${p.y}px`;
            block.style.width = `${p.w}px`;
            block.style.height = `${p.h}px`;

            const isDuplicate = room.name.trim().toLowerCase() === room.number.trim().toLowerCase();
            const subNameHtml = isDuplicate ? "" : `<div style="font-size: 10px; font-weight: 600; line-height: 1.2; margin-top: 2px; pointer-events: none;">${room.name}</div>`;

            block.innerHTML = `
                <div class="room-code-tag" style="font-size: 11px; font-weight: 800; pointer-events: none;">${room.number}</div>
                ${subNameHtml}
            `;

            if (targetRoomCode && room.number.toLowerCase().trim() === targetRoomCode) {
                block.classList.add("active-pulse");
                highlightedElement = block;
                highlightedRoomData = room;
                setTimeout(() => openRoomDetail(room), 300);
            }

            block.addEventListener("click", () => openRoomDetail(room));
            blueprintBoard.appendChild(block);
        });

        applyCategoryFilterToBoxes();

        // Trigger viewport centering
        setTimeout(() => {
            autoFitCanvasToScreen();

            // Center targeted room if requested in query parameters
            if (highlightedElement && highlightedRoomData) {
                const p = highlightedRoomData.plan || { x: 0, y: 0, w: 60, h: 60 };
                const viewW = blueprintViewport.clientWidth;
                const viewH = blueprintViewport.clientHeight;

                panX = (viewW / 2) - ((p.x + p.w / 2) * scale);
                panY = (viewH / 2) - ((p.y + p.h / 2) * scale);
                updateTransform();
            }
        }, 50);
    }

    function openRoomDetail(room) {
        if (!roomDetailCard) return;
        if (roomTypeTag) roomTypeTag.textContent = (room.type || "ROOM").toUpperCase();
        if (roomTitle) roomTitle.textContent = `${room.number}: ${room.name}`;
        if (roomDescription) roomDescription.textContent = room.description || "Standard campus room facility.";
        roomDetailCard.classList.remove("hidden");
    }

    // ================= 7. EVENT LISTENERS =================
    if (roomSearchInput) {
        roomSearchInput.addEventListener("input", renderBlueprintCanvas);
    }

    if (closeCardBtn) {
        closeCardBtn.addEventListener("click", () => roomDetailCard.classList.add("hidden"));
    }

    initBuildingsData();
});