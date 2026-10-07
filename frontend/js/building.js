document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_URL = isLocal ? "http://127.0.0.1:8000" : "https://giet-campus-api.onrender.com";

    const buildingSelector = document.getElementById('building-selector');
    const buildingHeaderName = document.getElementById('building-header-name');
    const floorTabsContainer = document.getElementById('floor-tabs-container');
    const blueprintBoard = document.getElementById('blueprint-board');
    const currentFloorLabel = document.getElementById('current-floor-label');
    const roomSearchInput = document.getElementById('room-search-input');
    const themeToggle = document.getElementById('theme-toggle');

    const roomDetailCard = document.getElementById('room-detail-card');
    const roomTypeTag = document.getElementById('room-type-tag');
    const roomTitle = document.getElementById('room-title');
    const roomDescription = document.getElementById('room-description');
    const closeCardBtn = document.getElementById('close-card-btn');

    let floorsData = [];
    let activeFloorIndex = 0;

    // Read URL query parameters (?name=... or ?building=..., and ?room=...)
    const urlParams = new URLSearchParams(window.location.search);
    let activeBuilding = (urlParams.get('building') || urlParams.get('name') || "CSA Block").trim();
    const targetFloorParam = urlParams.get('floor');
    const targetRoomCode = urlParams.get('room') ? urlParams.get('room').trim().toLowerCase() : null;

    // ================= 1. THEME ENGINE =================
    function initTheme() {
        if (localStorage.getItem('giet-theme') === 'dark') {
            document.body.classList.add('dark-mode');
            if (themeToggle) themeToggle.innerHTML = `<i class="fa-solid fa-sun" style="color:#fbbf24;"></i>`;
        } else {
            document.body.classList.remove('dark-mode');
            if (themeToggle) themeToggle.innerHTML = `<i class="fa-solid fa-moon"></i>`;
        }
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('giet-theme', isDark ? 'dark' : 'light');
            initTheme();
        });
    }
    initTheme();

    // ================= 2. POPULATE BUILDING DROPDOWN =================
    async function initBuildingSelector() {
        try {
            const res = await fetch(`${API_URL}/api/admin/buildings-list`, { signal: AbortSignal.timeout(3000) });
            const buildings = await res.json();
            populateSelector(buildings);
        } catch (e) {
            const defaults = ["CSA Block", "CSE Building", "Admin Block", "Library", "Mechanical building", "Bio tech Building", "Agriculture Block", "BSH Building"];
            populateSelector(defaults);
        }
        loadBuildingFloors();
    }

    function populateSelector(list) {
        if (!buildingSelector) return;
        buildingSelector.innerHTML = "";
        let matched = false;

        list.forEach(b => {
            const opt = document.createElement("option");
            opt.value = b;
            opt.textContent = b;
            if (b.toLowerCase().trim() === activeBuilding.toLowerCase().trim()) {
                opt.selected = true;
                activeBuilding = b;
                matched = true;
            }
            buildingSelector.appendChild(opt);
        });

        if (!matched && list.length > 0) {
            activeBuilding = list[0];
            buildingSelector.value = list[0];
        }
    }

    // ================= 3. FETCH LIVE FLOORS & ROOMS =================
    async function loadBuildingFloors() {
        if (buildingHeaderName) buildingHeaderName.textContent = activeBuilding;
        if (blueprintBoard) {
            blueprintBoard.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading layout from database...</div>`;
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

            // Target floor priority: 1) URL floor parameter, 2) floor containing target room, 3) 0th index
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
                    { id: 13, number: "HOD", name: "HoD CHAMBER", type: "Office", description: "Head of Department Room", plan: { x: 668, y: 355, w: 105, h: 55 } }
                ]
            }];
            renderFloorTabs();
            renderBlueprintCanvas();
        }
    }

    // ================= 4. RENDER BLUEPRINT & AUTO-FIT =================
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

    function autoFitCanvasToScreen() {
        if (!blueprintBoard) return;
        const viewport = document.querySelector('.blueprint-viewport-wrap');
        if (!viewport) return;

        const availableWidth = viewport.clientWidth - 24;
        const availableHeight = viewport.clientHeight - 24;
        const baseWidth = 900;
        const baseHeight = 480;

        // Auto-scale on mobile/narrow screens so all boundary rooms remain visible
        if (availableWidth < baseWidth || availableHeight < baseHeight) {
            const scaleX = availableWidth / baseWidth;
            const scaleY = availableHeight / baseHeight;
            const finalScale = Math.min(scaleX, scaleY, 1.0);

            blueprintBoard.style.transform = `scale(${finalScale.toFixed(3)})`;
        } else {
            blueprintBoard.style.transform = 'scale(1)';
        }
    }

    window.addEventListener('resize', autoFitCanvasToScreen);

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

        filteredRooms.forEach(room => {
            const block = document.createElement("div");
            const typeClass = (room.type || "classroom").toLowerCase();
            block.className = `blueprint-room-box ${typeClass}`;
            
            const p = room.plan || { x: 40, y: 40, w: 60, h: 60 };
            block.style.left = `${p.x}px`;
            block.style.top = `${p.y}px`;
            block.style.width = `${p.w}px`;
            block.style.height = `${p.h}px`;

            // Clean title: Avoid duplicate text if number equals name
            const isDuplicate = room.name.trim().toLowerCase() === room.number.trim().toLowerCase();
            const subNameHtml = isDuplicate ? "" : `<div style="font-size: 10px; font-weight: 600; line-height: 1.2; margin-top: 2px; pointer-events: none;">${room.name}</div>`;

            block.innerHTML = `
                <div style="font-size: 11px; font-weight: 800; pointer-events: none;">${room.number}</div>
                ${subNameHtml}
            `;

            // Check if this room is the targeted destination
            if (targetRoomCode && room.number.toLowerCase().trim() === targetRoomCode) {
                block.classList.add("active-pulse");
                highlightedElement = block;
                setTimeout(() => openRoomDetail(room), 350);
            }

            block.addEventListener("click", () => openRoomDetail(room));
            blueprintBoard.appendChild(block);
        });

        // Trigger dynamic scale calculation for mobile viewport fitting
        autoFitCanvasToScreen();

        // Center target room inside the viewport
        if (highlightedElement) {
            const viewport = document.querySelector('.blueprint-viewport-wrap');
            if (viewport) {
                const roomX = parseInt(highlightedElement.style.left) || 0;
                const roomY = parseInt(highlightedElement.style.top) || 0;
                viewport.scrollTo({
                    left: Math.max(0, roomX - (viewport.clientWidth / 2) + 50),
                    top: Math.max(0, roomY - (viewport.clientHeight / 2) + 50),
                    behavior: 'smooth'
                });
            }
        }
    }

    function openRoomDetail(room) {
        if (!roomDetailCard) return;
        if (roomTypeTag) roomTypeTag.textContent = (room.type || "ROOM").toUpperCase();
        if (roomTitle) roomTitle.textContent = `${room.number}: ${room.name}`;
        if (roomDescription) roomDescription.textContent = room.description || "Standard campus room facility.";
        
        roomDetailCard.classList.remove("hidden");
        roomDetailCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    // ================= 5. EVENT LISTENERS =================
    if (roomSearchInput) {
        roomSearchInput.addEventListener("input", renderBlueprintCanvas);
    }

    if (closeCardBtn) {
        closeCardBtn.addEventListener("click", () => roomDetailCard.classList.add("hidden"));
    }

    if (buildingSelector) {
        buildingSelector.addEventListener("change", (e) => {
            activeBuilding = e.target.value;
            activeFloorIndex = 0;
            loadBuildingFloors();
        });
    }

    initBuildingSelector();
});