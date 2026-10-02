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

    // Read URL query parameters (e.g. building.html?name=CSA+Block&room=CSA-4)
    const urlParams = new URLSearchParams(window.location.search);
    let activeBuilding = urlParams.get('name') || "CSA Block";
    const targetRoomCode = urlParams.get('room');

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
            buildingSelector.innerHTML = "";
            buildings.forEach(b => {
                const opt = document.createElement("option");
                opt.value = b;
                opt.textContent = b;
                if (b.toLowerCase() === activeBuilding.toLowerCase()) {
                    opt.selected = true;
                    activeBuilding = b;
                }
                buildingSelector.appendChild(opt);
            });
        } catch (e) {
            const defaults = ["CSA Block", "CSE Building", "Admin Block", "Library", "Mechanical building"];
            buildingSelector.innerHTML = "";
            defaults.forEach(b => {
                const opt = document.createElement("option");
                opt.value = b;
                opt.textContent = b;
                if (b.toLowerCase() === activeBuilding.toLowerCase()) {
                    opt.selected = true;
                    activeBuilding = b;
                }
                buildingSelector.appendChild(opt);
            });
        }
        loadBuildingFloors();
    }

    // ================= 3. FETCH LIVE FLOORS & ROOMS FROM SQLITE =================
    async function loadBuildingFloors() {
        buildingHeaderName.textContent = activeBuilding;
        blueprintBoard.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);">Loading blueprint from database...</div>`;

        try {
            const res = await fetch(`${API_URL}/api/buildings/${encodeURIComponent(activeBuilding)}/floors`);
            floorsData = await res.json();

            if (!floorsData || floorsData.length === 0) {
                blueprintBoard.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);">No floors configured for ${activeBuilding} in database yet.</div>`;
                floorTabsContainer.innerHTML = "";
                return;
            }

            renderFloorTabs();

            // Auto-switch to floor if target room parameter is present
            if (targetRoomCode) {
                const foundIdx = floorsData.findIndex(f => 
                    (f.rooms || []).some(r => r.number.toLowerCase() === targetRoomCode.toLowerCase())
                );
                if (foundIdx !== -1) {
                    activeFloorIndex = foundIdx;
                }
            }

            renderBlueprintCanvas();
        } catch (err) {
            console.warn("DB offline; using fallback data:", err);
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

    // ================= 4. RENDER BLUEPRINT =================
    function renderFloorTabs() {
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

    function renderBlueprintCanvas() {
        const currentFloor = floorsData[activeFloorIndex];
        if (!currentFloor) return;

        currentFloorLabel.textContent = `${activeBuilding} - ${currentFloor.name}`;
        blueprintBoard.innerHTML = "";

        const query = roomSearchInput.value.trim().toLowerCase();
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

        filteredRooms.forEach(room => {
            const block = document.createElement("div");
            const typeClass = (room.type || "classroom").toLowerCase();
            block.className = `blueprint-room-box ${typeClass}`;
            
            // Map spatial coordinates from DB
            const p = room.plan || { x: 40, y: 40, w: 60, h: 60 };
            block.style.left = `${p.x}px`;
            block.style.top = `${p.y}px`;
            block.style.width = `${p.w}px`;
            block.style.height = `${p.h}px`;

            // Highlight if arriving from navigation search
            if (targetRoomCode && room.number.toLowerCase() === targetRoomCode.toLowerCase()) {
                block.classList.add("active-pulse");
            }

            block.innerHTML = `
                <div style="font-size: 11px; font-weight: 800;">${room.number}</div>
                <div style="font-size: 10px; font-weight: 600; line-height: 1.2; margin-top: 2px;">${room.name}</div>
            `;

            block.addEventListener("click", () => {
                roomTypeTag.textContent = (room.type || "ROOM").toUpperCase();
                roomTitle.textContent = `${room.number}: ${room.name}`;
                roomDescription.textContent = room.description || "No additional equipment specifications registered.";
                roomDetailCard.classList.remove("hidden");
                roomDetailCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });

            blueprintBoard.appendChild(block);
        });
    }

    // ================= 5. EVENT LISTENERS =================
    roomSearchInput.addEventListener("input", renderBlueprintCanvas);

    if (closeCardBtn) {
        closeCardBtn.addEventListener("click", () => roomDetailCard.classList.add("hidden"));
    }

    buildingSelector.addEventListener("change", (e) => {
        activeBuilding = e.target.value;
        activeFloorIndex = 0;
        loadBuildingFloors();
    });

    initBuildingSelector();
});