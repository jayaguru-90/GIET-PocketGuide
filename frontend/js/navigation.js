document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_URL = isLocal ? "http://127.0.0.1:8000" : "https://giet-campus-api.onrender.com";

    // ================= 1. DOM REFERENCES & STATE =================
    const waypointsContainer = document.getElementById('waypoints-container');
    const startDisplay = document.getElementById('start-display');
    const destinationDisplay = document.getElementById('destination-display');
    const addStopBtn = document.getElementById('add-stop-btn');
    const findRouteBtn = document.getElementById('find-route-btn');
    const clearRouteBtn = document.getElementById('clear-route-btn');
    const startNavBtn = document.getElementById('start-nav-btn');
    const simulateBtn = document.getElementById('simulate-btn');
    const speedToggleBtn = document.getElementById('speed-toggle-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const routeOutput = document.getElementById('route-output');
    const routeOptionsContainer = document.getElementById('route-options-container');
    const routeCardsList = document.getElementById('route-cards-list');
    const turnStepsContainer = document.getElementById('turn-steps-container');
    const turnStepsList = document.getElementById('turn-steps-list');
    const stepsTotalCount = document.getElementById('steps-total-count');
    const turnHud = document.getElementById('turn-by-turn-hud');
    const turnIcon = document.getElementById('turn-icon');
    const turnInstruction = document.getElementById('turn-instruction');
    const turnDistance = document.getElementById('turn-distance');
    const exitHudBtn = document.getElementById('exit-hud-btn');
    const voiceToggleBtn = document.getElementById('voice-toggle-btn');
    const recenterFabBtn = document.getElementById('recenter-fab-btn');

    // Picker Modal Elements
    const locationPickerModal = document.getElementById('location-picker-modal');
    const pickerBackdrop = document.getElementById('picker-backdrop');
    const closePickerBtn = document.getElementById('close-picker-btn');
    const pickerTitle = document.getElementById('picker-title');
    const pickerFilterInput = document.getElementById('picker-filter-input');
    const pickerItemsList = document.getElementById('picker-items-list');

    // Tour Elements
    const startTourBtn = document.getElementById('start-tour-btn');
    const tourCardModal = document.getElementById('tour-card-modal');
    const tourStopNum = document.getElementById('tour-stop-num');
    const tourStopTitle = document.getElementById('tour-stop-title');
    const tourStopDesc = document.getElementById('tour-stop-desc');
    const tourOfficialLink = document.getElementById('tour-official-link');
    const tourPrevBtn = document.getElementById('tour-prev-btn');
    const tourNextBtn = document.getElementById('tour-next-btn');
    const tourSpeakBtn = document.getElementById('tour-speak-btn');
    const closeTourModalBtn = document.getElementById('close-tour-modal-btn');

    const catChips = document.querySelectorAll('.cat-chip');
    const utilChips = document.querySelectorAll('.util-chip');
    const buildingSearch = document.getElementById('building-search');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const searchResults = document.getElementById('search-results');
    const loadingScreen = document.getElementById('loading-screen');
    const navPanel = document.getElementById('nav-panel');
    const togglePanelBtn = document.getElementById('toggle-panel-btn');

    const GIET_CENTER = [19.0485, 83.8320];
    const ROUTE_PALETTE = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];

    let campusGeoJSON = null;
    let buildings = {};
    let markerLayers = {};
    let placeMetadata = {};
    let placeNamesSorted = [];
    let calculatedRoutes = [];
    let activeRouteIndex = 0;

    let selectedWaypoints = {
        start: { id: "LIVE_LOCATION", name: "My Live Location (GPS)" },
        destination: null,
        extraStops: []
    };
    let activePickerTarget = null;

    let fullRouteCoords = [];
    let remainingRoutePolyline = null;
    let breadcrumbPolyline = null;
    let alternativePolylines = [];

    let clientGraph = {};
    let clientNodes = [];

    let currentUserLat = null;
    let currentUserLng = null;
    let userMarker = null;
    let userAccuracyCircle = null;
    let watchId = null;

    let simulationInterval = null;
    let simSpeedMultiplier = 1;
    const SPEED_OPTIONS = [1, 2, 4];
    let speedOptionIdx = 0;

    let turnInstructions = [];
    let utilityMarkers = [];
    let activeCategory = 'all';
    let isTrackingOrSimulating = false;

    // ================= 2. THEME ENGINE =================
    function initTheme() {
        const savedTheme = localStorage.getItem('giet_theme') || 'light';
        applyTheme(savedTheme);
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            if (themeToggleBtn) {
                themeToggleBtn.innerHTML = `<i class="fa-solid fa-sun" style="color:#f59e0b;"></i>`;
                themeToggleBtn.title = "Switch to Light Theme";
            }
        } else {
            document.body.classList.remove('dark-theme');
            if (themeToggleBtn) {
                themeToggleBtn.innerHTML = `<i class="fa-solid fa-moon"></i>`;
                themeToggleBtn.title = "Switch to Dark Theme";
            }
        }
        localStorage.setItem('giet_theme', theme);
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.body.classList.contains('dark-theme');
            applyTheme(isDark ? 'light' : 'dark');
        });
    }

    initTheme();

    // ================= 3. VOICE GUIDANCE =================
    let isVoiceEnabled = true;
    let spokenMilestones = new Set();

    function speakVoicePrompt(text) {
        if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.05;
        utterance.lang = 'en-US';

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
        if (preferredVoice) utterance.voice = preferredVoice;

        window.speechSynthesis.speak(utterance);
    }

    if (voiceToggleBtn) {
        voiceToggleBtn.addEventListener('click', () => {
            isVoiceEnabled = !isVoiceEnabled;
            voiceToggleBtn.classList.toggle('active', isVoiceEnabled);
            voiceToggleBtn.innerHTML = isVoiceEnabled 
                ? `<i class="fa-solid fa-volume-high"></i>` 
                : `<i class="fa-solid fa-volume-xmark"></i>`;
            
            if (isVoiceEnabled) {
                speakVoicePrompt("Voice assistance enabled.");
            } else {
                window.speechSynthesis.cancel();
            }
        });
    }

    // ================= 4. FULL OFFICIAL GIETU TOUR DATA =================
    const campusTourStops = [
        {
            name: "security",
            title: "GIETU Main Gate & Security",
            desc: "The primary entry to GIET University Gunupur campus, monitored 24/7 with digital gate security and transport terminal links.",
            url: "https://www.giet.edu/campus-tour/"
        },
        {
            name: "Admin Block",
            title: "Administrative Headquarters",
            desc: "The central administrative building housing the Vice Chancellor's Secretariat, Registrar, Admissions, and Academic Affairs.",
            url: "https://www.giet.edu"
        },
        {
            name: "Library",
            title: "Biju Patnaik Central Digital Library",
            desc: "A central 24x7 air-conditioned library spanning 1,649 sq.m with over 81,000 volumes, international print/e-journals, and seating for 500 scholars.",
            url: "https://www.giet.edu/infrastructure/central-library/"
        },
        {
            name: "CSE Building",
            title: "School of Computer Science & Engineering",
            desc: "State-of-the-art software development labs, high-performance GPU AI workstations, and modern cloud infrastructure.",
            url: "https://www.giet.edu/schools/school-of-engineering-technology/departments/computer-science-and-engineering/"
        },
        {
            name: "CSA block",
            title: "Computer Science & Applications Block",
            desc: "Dedicated computing hubs for advanced coding, algorithms, cybersecurity research, and application development.",
            url: "https://www.giet.edu/academics/departments/computer-science-applications/"
        },
        {
            name: "BSH Building",
            title: "Basic Sciences & Humanities Block",
            desc: "Foundation classrooms, advanced Physics, Chemistry, and language laboratories fostering early engineering rigor.",
            url: "https://www.giet.edu/schools/school-of-basic-sciences/"
        },
        {
            name: "Agriculture Block",
            title: "School of Agriculture & Research Fields",
            desc: "Agronomy, soil science, crop research, and horticulture testing units on campus farmland.",
            url: "https://www.giet.edu/schools/school-of-agriculture/"
        },
        {
            name: "Bio tech Building",
            title: "School of Biotechnology & E-YUVA Centre",
            desc: "Advanced biotechnology research laboratories supported by BIRAC and Department of Biotechnology (DBT), Govt. of India.",
            url: "https://www.giet.edu/academics/e-yuva-center/"
        },
        {
            name: "Mechanical building",
            title: "School of Mechanical Engineering & Central Workshops",
            desc: "Heavy machinery workshops, CNC manufacturing centers, thermal, fluid mechanics, and CAD/CAM computing facilities.",
            url: "https://www.giet.edu/schools/school-of-engineering-technology/departments/mechanical-engineering/"
        },
        {
            name: "Hardware section",
            title: "Hardware, ECE & Robotics Laboratories",
            desc: "Embedded systems, VLSI design, IoT micro-controller hardware sections, and industrial automation labs.",
            url: "https://www.giet.edu/schools/school-of-engineering-technology/departments/electronics-communication-engineering/"
        },
        {
            name: "Mega Auditorium",
            title: "GIETU Mega University Auditorium",
            desc: "A massive acoustically engineered auditorium hosting national symposiums, annual convocation, and student cultural fests.",
            url: "https://www.giet.edu/infrastructure/"
        },
        {
            name: "Canteen",
            title: "Student Food Court & Canteen",
            desc: "A multi-cuisine campus cafeteria serving fresh snacks, regional specialties, fruit beverages, and meals.",
            url: "https://www.giet.edu/infrastructure/"
        },
        {
            name: "Cool Parlour",
            title: "Cool Parlour Refreshment Zone",
            desc: "A popular campus relaxation hub known for iced beverages, snacks, and student discussions between classes.",
            url: "https://www.giet.edu/campus-tour/"
        },
        {
            name: "Swimming pool",
            title: "National Standard 6-Lane Swimming Pool",
            desc: "A national standard aquatic facility with dedicated swimming coaching and scheduled hours for boys and girls.",
            url: "https://www.giet.edu/sports-facilities/"
        },
        {
            name: "Giet main ground",
            title: "University Sports Arena & Athletic Track",
            desc: "A multipurpose stadium ground hosting state-level cricket, football tournaments, basketball courts, and track sports.",
            url: "https://www.giet.edu/sports-facilities/"
        },
        {
            name: "Central Mess",
            title: "Central Dining Complex & Residential Hostels",
            desc: "Hygienic multi-story student dining complex with 1,200+ seating capacity, serving nutritious meals across the NC hostel clusters.",
            url: "https://www.giet.edu/schools/school-of-nursing/infrastructure/hostels/"
        }
    ];

    function hideLoader() {
        if (!loadingScreen) return;
        loadingScreen.classList.add('hidden');
        setTimeout(() => { if (map) map.invalidateSize(); }, 200);
    }
    const safetyTimer = setTimeout(hideLoader, 2000);

    // ================= 5. SATELLITE CANVAS =================
    const map = L.map('map', {
        zoomControl: false,
        maxZoom: 22,
        tap: false
    }).setView(GIET_CENTER, 18);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 22,
        maxNativeZoom: 20,
        attribution: '&copy; Google Satellite &mdash; GIET University'
    }).addTo(map);

    // ================= 6. CAMPUS EMOJI TAXONOMY =================
    function getPlaceIcon(name, rawCategory = '') {
        const n = (name || '').toLowerCase().trim();
        const c = (rawCategory || '').toLowerCase().trim();

        if (n.includes('wc') || n.includes('washroom') || n.includes('restroom') || n.includes('toilet') || c.includes('washroom')) {
            if (n.includes('gens') || n.includes('men') || n.includes('boys')) return '🚹';
            if (n.includes('ladies') || n.includes('women') || n.includes('girls')) return '🚺';
            return '🚻';
        }
        if (n.includes('dispensary') || n.includes('medical') || n.includes('first aid') || c.includes('medical')) return '🏥';
        if (n.includes('security') || n.includes('guard') || c.includes('security')) return '🛡️';
        if (n.includes('temple')) return '🛕';
        if (n.includes('park') || n.includes('garden')) return '🌳';
        if (n.includes('open gym')) return '🧘';
        if (n.includes('cool parlour') || n.includes('parloor')) return '🍧';
        if (n.includes('tea') || n.includes('coffee') || n.includes('cafe')) return '☕';
        if (n.includes('canteen')) return '🍱';
        if (n.includes('mess')) return '🍲';
        if (n.includes('swimming') || n.includes('pool')) return '🏊‍♂️';
        if (n.includes('badminton')) return '🏸';
        if (n.includes('basket ball') || n.includes('basketball')) return '🏀';
        if (n.includes('ground') || n.includes('stadium') || n.includes('cricket')) return '⚽';
        if (n.includes('bus')) return '🚌';
        if (n.includes('parking')) return '🅿️';
        if (n.includes('gate') || n.includes('entrance')) return '🚪';
        if (n.includes('library')) return '📚';
        if (n.includes('auditorium')) return '🎭';
        if (n.includes('cse') || n.includes('computer') || n.includes('csa')) return '💻';
        if (n.includes('bio tech') || n.includes('biotech')) return '🧪';
        if (n.includes('agriculture') || n.includes('agri')) return '🌾';
        if (n.includes('hardware') || n.includes('ece') || n.includes('electrical')) return '⚡';
        if (n.includes('mechanical') || n.includes('mech')) return '⚙️';
        if (n.includes('civil')) return '📐';
        if (n.includes('manegment') || n.includes('management') || n.includes('mba')) return '📊';
        if (n.includes('bsh') || n.includes('basic science')) return '🔬';
        if (n.includes('admin') || n.includes('office')) return '🏛️';
        if (n.includes('guest house')) return '🏨';
        if (n.startsWith('nc-') || n.includes('hostel')) return '🏢';
        if (n.includes('building') || n.includes('block')) return '🏫';

        return '📍';
    }

    // ================= 7. UTILITIES OVERLAY =================
    function renderUtilities(filterType) {
        utilityMarkers.forEach(m => map.removeLayer(m));
        utilityMarkers = [];

        if (filterType === 'none' || !campusGeoJSON) return;

        (campusGeoJSON.features || []).forEach(feat => {
            if (feat.geometry && feat.geometry.type === 'Point') {
                const cat = (feat.properties.category || '').toLowerCase();
                const name = feat.properties.name || '';
                const [lng, lat] = feat.geometry.coordinates;

                let matchType = null;
                if (cat.includes('water') || name.toLowerCase().includes('water') || name.toLowerCase().includes('cooler')) matchType = 'water';
                else if (cat.includes('washroom') || cat.includes('restroom') || name.toLowerCase().includes('washroom') || name.toLowerCase().includes('toilet') || name.toLowerCase().includes('wc')) matchType = 'washroom';
                else if (cat.includes('medical') || name.toLowerCase().includes('first aid') || name.toLowerCase().includes('dispensary')) matchType = 'medical';
                else if (cat.includes('security') || cat.includes('gate') || name.toLowerCase().includes('security')) matchType = 'security';

                if (matchType && (filterType === 'all' || filterType === matchType)) {
                    const iconMap = { water: '🚰', washroom: '🚻', medical: '🏥', security: '🛡️' };
                    const customIcon = L.divIcon({
                        className: 'custom-util-icon',
                        html: `<div class="util-marker-pin util-pin-${matchType}">${iconMap[matchType]}</div>`,
                        iconSize: [28, 28],
                        iconAnchor: [14, 14]
                    });

                    const m = L.marker([lat, lng], { icon: customIcon }).addTo(map);
                    m.bindPopup(`<strong>${name}</strong><br><small style="text-transform: capitalize;">${matchType}</small>`);
                    utilityMarkers.push(m);
                }
            }
        });
    }

    utilChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const type = chip.getAttribute('data-type');
            if (chip.classList.contains('active')) {
                chip.classList.remove('active');
                renderUtilities('none');
            } else {
                utilChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                renderUtilities(type);
            }
        });
    });

    // ================= 8. CATEGORY FILTERING =================
    function getCategoryClassification(name, rawCategory = '') {
        const n = name.toLowerCase();
        const c = rawCategory.toLowerCase();

        if (c.includes('academic') || n.includes('building') || n.includes('block') || n.includes('library') || n.includes('dept') || n.includes('csa') || n.includes('ame') || n.includes('bsh') || n.includes('hardware')) {
            return 'academic';
        }
        if (c.includes('hostel') || c.includes('mess') || n.startsWith('nc-') || n.includes('mess') || n.includes('hostel') || n.includes('guest house')) {
            return 'hostel';
        }
        if (c.includes('food') || n.includes('canteen') || n.includes('parlour') || n.includes('parloor')) {
            return 'food';
        }
        if (c.includes('sports') || n.includes('court') || n.includes('pool') || n.includes('ground') || n.includes('gym')) {
            return 'sports';
        }
        if (c.includes('parking') || c.includes('gate') || n.includes('parking') || n.includes('gate') || n.includes('bus')) {
            return 'parking';
        }
        return 'academic';
    }

    function applyCategoryAndZoomFilter() {
        const currentZoom = map.getZoom();
        const isZoomedOut = currentZoom < 18;
        const majorLandmarks = ['admin block', 'library', 'canteen', 'giet temple', 'bus-stop', 'central mess', 'giet main ground'];

        Object.keys(markerLayers).forEach(name => {
            const layer = markerLayers[name];
            const meta = placeMetadata[name] || {};
            const itemCat = meta.category || 'academic';

            const categoryMatches = (activeCategory === 'all' || itemCat === activeCategory);
            const zoomMatches = !isZoomedOut || majorLandmarks.some(landmark => name.toLowerCase().includes(landmark));

            if (categoryMatches && zoomMatches) {
                if (!map.hasLayer(layer)) map.addLayer(layer);
            } else {
                if (map.hasLayer(layer)) map.removeLayer(layer);
            }
        });
    }

    map.on('zoomend', applyCategoryAndZoomFilter);

    catChips.forEach(chip => {
        chip.addEventListener('click', () => {
            catChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeCategory = chip.getAttribute('data-cat');
            applyCategoryAndZoomFilter();
        });
    });

    // ================= 9. GEOMETRY & GRAPH HELPERS =================
    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function toKey(lat, lng) {
        return `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
    }

    function parseKey(key) {
        return key.split(',').map(Number);
    }

    function getBearing(lat1, lon1, lat2, lon2) {
        const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
        const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
                  Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    function buildClientGraph(geojson) {
        clientGraph = {};
        clientNodes = [];
        const nodeSet = new Set();

        function regNode(k) {
            if (!nodeSet.has(k)) {
                nodeSet.add(k);
                clientNodes.push(k);
            }
        }

        function addEdge(uKey, vKey, uCoord, vCoord) {
            if (uKey === vKey) return;
            const d = getDistance(uCoord[0], uCoord[1], vCoord[0], vCoord[1]);
            regNode(uKey);
            regNode(vKey);
            if (!clientGraph[uKey]) clientGraph[uKey] = [];
            if (!clientGraph[vKey]) clientGraph[vKey] = [];
            if (!clientGraph[uKey].some(e => e.node === vKey)) {
                clientGraph[uKey].push({ node: vKey, weight: d, coord: vCoord });
            }
            if (!clientGraph[vKey].some(e => e.node === uKey)) {
                clientGraph[vKey].push({ node: uKey, weight: d, coord: uCoord });
            }
        }

        (geojson.features || []).forEach(feat => {
            const geom = feat.geometry || {};
            if (geom.type === 'LineString') {
                const coords = geom.coordinates || [];
                for (let i = 0; i < coords.length - 1; i++) {
                    const u = [coords[i][1], coords[i][0]];
                    const v = [coords[i + 1][1], coords[i + 1][0]];
                    addEdge(toKey(u[0], u[1]), toKey(v[0], v[1]), u, v);
                }
            }
        });

        for (let i = 0; i < clientNodes.length; i++) {
            const p1 = parseKey(clientNodes[i]);
            for (let j = i + 1; j < clientNodes.length; j++) {
                const p2 = parseKey(clientNodes[j]);
                if (getDistance(p1[0], p1[1], p2[0], p2[1]) <= 12.0) {
                    addEdge(clientNodes[i], clientNodes[j], p1, p2);
                }
            }
        }
    }

    function findNearestGraphNode(lat, lng) {
        let bestKey = null;
        let minD = Infinity;
        for (let i = 0; i < clientNodes.length; i++) {
            const [nLat, nLng] = parseKey(clientNodes[i]);
            const d = getDistance(lat, lng, nLat, nLng);
            if (d < minD) {
                minD = d;
                bestKey = clientNodes[i];
            }
        }
        return bestKey;
    }

    function dijkstraSearch(startKey, endKey, penalized = {}) {
        const queue = [{ cost: 0, node: startKey, path: [] }];
        const bestCost = { [startKey]: 0 };
        const visited = new Set();

        while (queue.length > 0) {
            queue.sort((a, b) => a.cost - b.cost);
            const { cost, node, path } = queue.shift();

            if (visited.has(node)) continue;
            visited.add(node);
            const currentPath = [...path, node];

            if (node === endKey) return { path: currentPath, cost };

            const edges = clientGraph[node] || [];
            for (let i = 0; i < edges.length; i++) {
                const edge = edges[i];
                if (visited.has(edge.node)) continue;

                const edgeKey1 = `${node}|${edge.node}`;
                const edgeKey2 = `${edge.node}|${node}`;
                const multiplier = penalized[edgeKey1] || penalized[edgeKey2] || 1.0;
                const nextCost = cost + (edge.weight * multiplier);

                if (nextCost < (bestCost[edge.node] || Infinity)) {
                    bestCost[edge.node] = nextCost;
                    queue.push({ cost: nextCost, node: edge.node, path: currentPath });
                }
            }
        }
        return null;
    }

    function computeClientSideRoutes(coordsArray) {
        const routes = [];
        const penalized = {};
        const isMulti = coordsArray.length > 2;

        for (let iter = 0; iter < 3; iter++) {
            let fullCoords = [];
            allNodePath = [];
            let failed = false;

            for (let leg = 0; leg < coordsArray.length - 1; leg++) {
                const p1 = coordsArray[leg];
                const p2 = coordsArray[leg + 1];
                const startNode = findNearestGraphNode(p1[0], p1[1]);
                const endNode = findNearestGraphNode(p2[0], p2[1]);

                if (!startNode || !endNode) {
                    failed = true;
                    break;
                }

                const result = dijkstraSearch(startNode, endNode, penalized);
                if (!result || !result.path) {
                    failed = true;
                    break;
                }

                const legCoords = [p1, ...result.path.map(parseKey), p2];
                if (fullCoords.length > 0) {
                    fullCoords.push(...legCoords.slice(1));
                    allNodePath.push(...result.path.slice(1));
                } else {
                    fullCoords.push(...legCoords);
                    allNodePath.push(...result.path);
                }
            }

            if (failed || fullCoords.length < 2) break;

            let dist = 0;
            for (let i = 0; i < fullCoords.length - 1; i++) {
                dist += getDistance(fullCoords[i][0], fullCoords[i][1], fullCoords[i + 1][0], fullCoords[i + 1][1]);
            }

            const isDistinct = !routes.some(r => Math.abs(r.totalDistance - dist) < 10);
            if (isDistinct) {
                routes.push({ path: fullCoords, totalDistance: Math.round(dist) });
                if (routes.length >= 3) break;
            }

            if (allNodePath.length > 3) {
                for (let i = 1; i < allNodePath.length - 2; i++) {
                    const k = `${allNodePath[i]}|${allNodePath[i + 1]}`;
                    penalized[k] = (penalized[k] || 1.0) * 2.2;
                }
            }
        }

        routes.sort((a, b) => a.totalDistance - b.totalDistance);
        return routes.map((r, idx) => ({
            name: isMulti ? (idx === 0 ? "Shortest Multi-Stop Route" : `Multi-Stop Route ${idx + 1}`) : (idx === 0 ? "Shortest Route (Via Walkway)" : `Alternative Route ${idx + 1}`),
            path: r.path,
            totalDistance: r.totalDistance
        }));
    }

    // ================= 10. TURN-BY-TURN INSTRUCTIONS =================
    function generateTurnInstructions(coords) {
        if (!coords || coords.length < 2) return [];
        const instructions = [];
        let accumulatedDistance = 0;

        instructions.push({
            id: "step_start",
            action: "start",
            icon: "📍",
            text: "Start walking along the path",
            distance: 0,
            coord: coords[0]
        });

        for (let i = 1; i < coords.length - 1; i++) {
            const pPrev = coords[i - 1];
            const pCurr = coords[i];
            const pNext = coords[i + 1];

            const segDist = getDistance(pPrev[0], pPrev[1], pCurr[0], pCurr[1]);
            accumulatedDistance += segDist;

            const b1 = getBearing(pPrev[0], pPrev[1], pCurr[0], pCurr[1]);
            const b2 = getBearing(pCurr[0], pCurr[1], pNext[0], pNext[1]);

            let diff = b2 - b1;
            while (diff < -180) diff += 360;
            while (diff > 180) diff -= 360;

            if (Math.abs(diff) >= 32) {
                const turnType = diff > 0 ? "Turn Right" : "Turn Left";
                const icon = diff > 0 ? "↗️" : "↖️";
                instructions.push({
                    id: `turn_${i}_${Math.round(pCurr[0] * 1000)}`,
                    action: "turn",
                    icon: icon,
                    text: `${turnType} onto connecting walkway`,
                    distance: Math.round(accumulatedDistance),
                    coord: pCurr
                });
                accumulatedDistance = 0;
            }
        }

        const finalSeg = getDistance(coords[coords.length - 2][0], coords[coords.length - 2][1], coords[coords.length - 1][0], coords[coords.length - 1][1]);
        accumulatedDistance += finalSeg;

        instructions.push({
            id: "step_arrive",
            action: "arrive",
            icon: "🏁",
            text: "Arrive at destination doorway",
            distance: Math.round(accumulatedDistance),
            coord: coords[coords.length - 1]
        });

        return instructions;
    }

    function renderTurnDirections(instructions) {
        turnStepsList.innerHTML = '';
        instructions.forEach((step, idx) => {
            const div = document.createElement('div');
            div.className = `turn-step-item ${idx === 0 ? 'active' : ''}`;
            div.innerHTML = `
                <span style="font-size: 1.25rem;">${step.icon}</span>
                <div>
                    <div><strong>${step.text}</strong></div>
                    <div style="color: #64748b; font-size: 11.5px;">${step.distance > 0 ? `After ${step.distance} meters` : 'Origin'}</div>
                </div>
            `;
            turnStepsList.appendChild(div);
        });

        if (stepsTotalCount) {
            stepsTotalCount.textContent = `${instructions.length} steps`;
        }
        turnStepsContainer.classList.remove('hidden');
    }

    // ================= 11. LIVE GPS & LINE ERASING =================
    function updateUserLiveLocation(lat, lng, accuracy = 5) {
        currentUserLat = lat;
        currentUserLng = lng;

        if (recenterFabBtn) recenterFabBtn.classList.remove('hidden');

        if (!userMarker) {
            const userIcon = L.divIcon({
                className: 'user-pulse-marker',
                html: `<div style="width: 18px; height: 18px; background: #38bdf8; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 0 14px #0284c7;"></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9]
            });
            userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
            userAccuracyCircle = L.circle([lat, lng], { radius: accuracy, color: '#38bdf8', weight: 1, fillOpacity: 0.15 }).addTo(map);
        } else {
            userMarker.setLatLng([lat, lng]);
            userAccuracyCircle.setLatLng([lat, lng]);
            userAccuracyCircle.setRadius(accuracy);
        }

        if (fullRouteCoords.length > 1) {
            updateDynamicBreadcrumb([lat, lng]);
        }
    }

    if (recenterFabBtn) {
        recenterFabBtn.addEventListener('click', () => {
            if (currentUserLat && currentUserLng) {
                map.flyTo([currentUserLat, currentUserLng], 19, { duration: 0.8 });
            }
        });
    }

    function updateDynamicBreadcrumb(currentPos) {
        let closestIdx = 0;
        let minD = Infinity;

        for (let i = 0; i < fullRouteCoords.length; i++) {
            const d = getDistance(currentPos[0], currentPos[1], fullRouteCoords[i][0], fullRouteCoords[i][1]);
            if (d < minD) {
                minD = d;
                closestIdx = i;
            }
        }

        if (minD < 18) {
            const remainingCoords = [currentPos, ...fullRouteCoords.slice(closestIdx + 1)];
            const walkedCoords = fullRouteCoords.slice(0, closestIdx + 1);

            if (remainingRoutePolyline) {
                remainingRoutePolyline.setLatLngs(remainingCoords);
            }

            if (!breadcrumbPolyline) {
                breadcrumbPolyline = L.polyline(walkedCoords, {
                    color: '#94a3b8',
                    weight: 4,
                    opacity: 0.5,
                    dashArray: '3, 6'
                }).addTo(map);
            } else {
                breadcrumbPolyline.setLatLngs(walkedCoords);
            }

            updateHudInstruction(remainingCoords, currentPos);
        }
    }

    function updateHudInstruction(remainingCoords, currentPos) {
        if (!turnInstructions || turnInstructions.length === 0) return;

        let nextTurn = null;
        for (let i = 0; i < turnInstructions.length; i++) {
            const step = turnInstructions[i];
            const d = getDistance(currentPos[0], currentPos[1], step.coord[0], step.coord[1]);
            if (d > 6) {
                nextTurn = step;
                nextTurn.liveDist = Math.round(d);
                break;
            }
        }

        if (nextTurn) {
            turnHud.classList.remove('hidden');
            turnIcon.textContent = nextTurn.icon;
            turnInstruction.textContent = nextTurn.text;
            turnDistance.textContent = `in ${nextTurn.liveDist} meters`;

            const approachKey = `approach_${nextTurn.id}`;
            if (nextTurn.liveDist <= 25 && nextTurn.liveDist > 8 && !spokenMilestones.has(approachKey)) {
                spokenMilestones.add(approachKey);
                speakVoicePrompt(`In ${nextTurn.liveDist} meters, ${nextTurn.text}`);
            }

            const executeKey = `execute_${nextTurn.id}`;
            if (nextTurn.liveDist <= 8 && !spokenMilestones.has(executeKey)) {
                spokenMilestones.add(executeKey);
                speakVoicePrompt(nextTurn.text);
            }
        } else {
            turnHud.classList.remove('hidden');
            turnIcon.textContent = "🏁";
            turnInstruction.textContent = "Approaching destination";
            turnDistance.textContent = "within 5 meters";

            if (!spokenMilestones.has("arrived")) {
                spokenMilestones.add("arrived");
                speakVoicePrompt("You have arrived at your destination.");
            }
        }
    }

    // ================= 12. ROUTE SELECTION & VISUALIZATION =================
    function selectActiveRoute(index) {
        activeRouteIndex = index;
        const selectedRoute = calculatedRoutes[index];
        fullRouteCoords = selectedRoute.path;
        spokenMilestones.clear();

        if (remainingRoutePolyline) map.removeLayer(remainingRoutePolyline);
        if (breadcrumbPolyline) map.removeLayer(breadcrumbPolyline);
        alternativePolylines.forEach(p => map.removeLayer(p));
        alternativePolylines = [];
        breadcrumbPolyline = null;

        calculatedRoutes.forEach((r, idx) => {
            if (idx !== index) {
                const alt = L.polyline(r.path, {
                    color: ROUTE_PALETTE[idx] || '#64748b',
                    weight: 5,
                    opacity: 0.5,
                    dashArray: '8, 8'
                }).addTo(map);
                alt.on('click', () => selectActiveRoute(idx));
                alternativePolylines.push(alt);
            }
        });

        remainingRoutePolyline = L.polyline(fullRouteCoords, {
            color: ROUTE_PALETTE[index] || '#10b981',
            weight: 7,
            opacity: 1.0,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(map);

        turnInstructions = generateTurnInstructions(fullRouteCoords);
        renderTurnDirections(turnInstructions);

        const estTime = Math.ceil(selectedRoute.totalDistance / 75);
        speakVoicePrompt(`Route found. Distance is ${selectedRoute.totalDistance} meters, about ${estTime} minutes walk.`);

        const cards = routeCardsList.children;
        for (let i = 0; i < cards.length; i++) {
            cards[i].classList.toggle('active', i === index);
        }

        if (routeOutput) {
            routeOutput.classList.remove('hidden');
            routeOutput.innerHTML = `
                <div style="font-size: 13px;">
                    <strong style="color: ${ROUTE_PALETTE[index] || '#10b981'}">${selectedRoute.name}</strong><br>
                    Distance: <strong>${selectedRoute.totalDistance} meters</strong> (~${estTime} mins walk)
                </div>
            `;
        }

        if (!isTrackingOrSimulating && remainingRoutePolyline) {
            map.fitBounds(remainingRoutePolyline.getBounds(), {
                padding: [40, 40],
                maxZoom: 19,
                animate: true
            });
        }
    }

    function renderRoutes(routes) {
        calculatedRoutes = routes;
        routeCardsList.innerHTML = '';

        routes.forEach((route, idx) => {
            const isShortest = idx === 0;
            const routeColor = ROUTE_PALETTE[idx] || '#64748b';

            const card = document.createElement('div');
            card.className = `route-card ${isShortest ? 'active' : ''}`;
            card.innerHTML = `
                <div class="route-card-title" style="display: flex; align-items: center; justify-content: space-between;">
                    <span style="display: flex; align-items: center; gap: 6px;">
                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${routeColor};"></span>
                        <strong>${route.name}</strong>
                    </span>
                    <span>~${Math.ceil(route.totalDistance / 75)} min</span>
                </div>
                <div class="route-card-sub" style="margin-left: 16px;">${route.totalDistance} meters • Road verified</div>
            `;
            card.addEventListener('click', () => selectActiveRoute(idx));
            routeCardsList.appendChild(card);
        });

        routeOptionsContainer.classList.remove('hidden');
        selectActiveRoute(0);
    }

    // ================= 13. IN-APP LOCATION PICKER MODAL =================
    function openLocationPicker(targetKey, titleText) {
        activePickerTarget = targetKey;
        pickerTitle.textContent = titleText || "Select Campus Location";
        pickerFilterInput.value = "";
        renderPickerList("");
        locationPickerModal.classList.remove('hidden');
        setTimeout(() => pickerFilterInput.focus(), 100);
    }

    function closeLocationPicker() {
        locationPickerModal.classList.add('hidden');
        activePickerTarget = null;
    }

    function renderPickerList(filterTerm) {
        pickerItemsList.innerHTML = "";
        const term = filterTerm.toLowerCase().trim();

        if (activePickerTarget === 'start') {
            const liveItem = document.createElement('div');
            liveItem.className = 'picker-item';
            liveItem.innerHTML = `<span class="picker-item-icon">📍</span> <span>My Live Location (GPS)</span>`;
            liveItem.addEventListener('click', () => {
                selectedWaypoints.start = { id: "LIVE_LOCATION", name: "My Live Location (GPS)" };
                startDisplay.querySelector('.waypoint-text').textContent = "📍 My Live Location (GPS)";
                closeLocationPicker();
            });
            pickerItemsList.appendChild(liveItem);
        }

        const matchingPlaces = placeNamesSorted.filter(name => !term || name.toLowerCase().includes(term));

        matchingPlaces.forEach(name => {
            const icon = getPlaceIcon(name);
            const item = document.createElement('div');
            item.className = 'picker-item';
            item.innerHTML = `<span class="picker-item-icon">${icon}</span> <span>${name}</span>`;

            item.addEventListener('click', () => {
                if (activePickerTarget === 'start') {
                    selectedWaypoints.start = { id: name, name: name };
                    startDisplay.querySelector('.waypoint-text').textContent = `${icon} ${name}`;
                } else if (activePickerTarget === 'destination') {
                    selectedWaypoints.destination = { id: name, name: name };
                    const destText = destinationDisplay.querySelector('.waypoint-text');
                    destText.textContent = `${icon} ${name}`;
                    destText.classList.remove('placeholder');
                } else if (typeof activePickerTarget === 'number') {
                    selectedWaypoints.extraStops[activePickerTarget] = { id: name, name: name };
                    const stopCard = waypointsContainer.querySelectorAll('.stop-row')[activePickerTarget];
                    if (stopCard) {
                        const txt = stopCard.querySelector('.waypoint-text');
                        txt.textContent = `${icon} ${name}`;
                        txt.classList.remove('placeholder');
                    }
                }
                closeLocationPicker();
            });

            pickerItemsList.appendChild(item);
        });

        if (matchingPlaces.length === 0) {
            pickerItemsList.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; font-size:13px;">No matching places found</div>`;
        }
    }

    if (startDisplay) {
        startDisplay.parentElement.addEventListener('click', () => openLocationPicker('start', 'Choose Starting Point'));
    }

    if (destinationDisplay) {
        destinationDisplay.parentElement.addEventListener('click', () => openLocationPicker('destination', 'Choose Destination'));
    }

    if (pickerFilterInput) {
        pickerFilterInput.addEventListener('input', (e) => renderPickerList(e.target.value));
    }

    if (closePickerBtn) closePickerBtn.addEventListener('click', closeLocationPicker);
    if (pickerBackdrop) pickerBackdrop.addEventListener('click', closeLocationPicker);

    if (addStopBtn) {
        addStopBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const stopIndex = selectedWaypoints.extraStops.length;
            selectedWaypoints.extraStops.push(null);

            const div = document.createElement('div');
            div.className = 'input-group waypoint-card stop-row';
            div.innerHTML = `
                <div class="point-badge" style="background:#8b5cf6;">${String.fromCharCode(67 + stopIndex)}</div>
                <div class="waypoint-display">
                    <span class="waypoint-text placeholder">Next Stop ${stopIndex + 1}</span>
                    <i class="fa-solid fa-chevron-down waypoint-arrow"></i>
                </div>
                <button type="button" class="btn-remove-stop" title="Remove stop" aria-label="Remove stop">✕</button>
            `;

            waypointsContainer.appendChild(div);

            div.querySelector('.waypoint-display').addEventListener('click', () => {
                openLocationPicker(stopIndex, `Choose Stop ${stopIndex + 1}`);
            });

            div.querySelector('.btn-remove-stop').addEventListener('click', (ev) => {
                ev.stopPropagation();
                div.remove();
                selectedWaypoints.extraStops.splice(stopIndex, 1);
            });

            const panelBody = document.querySelector('.panel-body');
            if (panelBody) panelBody.scrollTop = panelBody.scrollHeight;
        });
    }

    // ================= 14. MOBILE DRAWER SNAP GESTURES =================
    let isDraggingHandle = false;
    let startTouchY = 0;
    let currentPanelState = 0; // 0 = Expanded (Show All Steps), 1 = Collapsed (Show Map)
    const dragArea = document.getElementById('panel-handle-area') || togglePanelBtn;

    function applySheetSnap(stateIndex) {
        if (window.innerWidth > 640 || !navPanel) return;
        currentPanelState = stateIndex;
        navPanel.style.transition = 'transform 0.26s cubic-bezier(0.2, 0.9, 0.3, 1)';

        const panelHeight = navPanel.offsetHeight;
        if (stateIndex === 0) {
            navPanel.style.transform = 'translateY(0px)';
        } else {
            const peekOffset = Math.max(0, panelHeight - 64);
            navPanel.style.transform = `translateY(${peekOffset}px)`;
        }
    }

    if (dragArea && navPanel) {
        dragArea.addEventListener('touchstart', (e) => {
            if (window.innerWidth > 640) return;
            isDraggingHandle = true;
            startTouchY = e.touches[0].clientY;
            navPanel.style.transition = 'none';
        }, { passive: true });

        dragArea.addEventListener('touchmove', (e) => {
            if (!isDraggingHandle) return;
            const deltaY = e.touches[0].clientY - startTouchY;
            const panelHeight = navPanel.offsetHeight;
            const maxOffset = Math.max(0, panelHeight - 64);

            let baseOffset = currentPanelState === 1 ? maxOffset : 0;
            let targetOffset = baseOffset + deltaY;

            if (targetOffset < 0) targetOffset = 0;
            if (targetOffset > maxOffset) targetOffset = maxOffset;

            navPanel.style.transform = `translateY(${targetOffset}px)`;
        }, { passive: true });

        dragArea.addEventListener('touchend', (e) => {
            if (!isDraggingHandle) return;
            isDraggingHandle = false;
            const endTouchY = e.changedTouches[0].clientY;
            const distanceMoved = endTouchY - startTouchY;

            if (distanceMoved > 40) {
                applySheetSnap(1);
            } else if (distanceMoved < -40) {
                applySheetSnap(0);
            } else {
                applySheetSnap(currentPanelState);
            }
        });
    }

    if (togglePanelBtn) {
        togglePanelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.innerWidth > 640) return;
            applySheetSnap(currentPanelState === 0 ? 1 : 0);
        });
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 640 && navPanel) {
            navPanel.style.transform = '';
            navPanel.style.transition = '';
            currentPanelState = 0;
        }
    });

    // ================= 15. CAMPUS TOUR MODE =================
    function startCampusTour() {
        isTourActive = true;
        currentTourIndex = 0;

        const tourCoords = campusTourStops.map(s => buildings[s.name]).filter(Boolean);
        if (tourCoords.length < 2) {
            alert("Tour landmarks are synchronizing with the campus mesh. Please retry in a few seconds.");
            return;
        }

        const routes = computeClientSideRoutes(tourCoords);
        if (routes && routes.length > 0) {
            renderRoutes(routes);
        }

        showTourStopCard(currentTourIndex);
    }

    function showTourStopCard(idx) {
        if (idx < 0 || idx >= campusTourStops.length) return;
        currentTourIndex = idx;
        const stop = campusTourStops[idx];

        tourStopNum.textContent = `${idx + 1}/${campusTourStops.length}`;
        tourStopTitle.textContent = stop.title;
        tourStopDesc.textContent = stop.desc;
        if (tourOfficialLink) {
            tourOfficialLink.href = stop.url || "https://www.giet.edu";
        }
        tourCardModal.classList.remove('hidden');

        const coords = buildings[stop.name];
        if (coords) {
            map.flyTo(coords, 19, { duration: 1.0 });
            if (markerLayers[stop.name]) markerLayers[stop.name].openTooltip();
        }

        speakVoicePrompt(`Tour Stop ${idx + 1}: ${stop.title}. ${stop.desc}`);
    }

    if (startTourBtn) startTourBtn.addEventListener('click', startCampusTour);

    if (tourNextBtn) {
        tourNextBtn.addEventListener('click', () => {
            if (currentTourIndex < campusTourStops.length - 1) {
                showTourStopCard(currentTourIndex + 1);
            } else {
                alert("You have completed the GIET University Campus Tour! Welcome to GIETU.");
                tourCardModal.classList.add('hidden');
                isTourActive = false;
            }
        });
    }

    if (tourPrevBtn) {
        tourPrevBtn.addEventListener('click', () => {
            if (currentTourIndex > 0) {
                showTourStopCard(currentTourIndex - 1);
            }
        });
    }

    if (tourSpeakBtn) {
        tourSpeakBtn.addEventListener('click', () => {
            const stop = campusTourStops[currentTourIndex];
            if (stop) speakVoicePrompt(`${stop.title}. ${stop.desc}`);
        });
    }

    if (closeTourModalBtn) {
        closeTourModalBtn.addEventListener('click', () => {
            tourCardModal.classList.add('hidden');
            isTourActive = false;
            window.speechSynthesis.cancel();
        });
    }

    // ================= 16. DATA INITIALIZER & INSTANT LOCAL-FIRST LOADER =================
    function processGeoJSONData(data) {
        campusGeoJSON = data;
        buildings = {};
        markerLayers = {};
        placeMetadata = {};
        placeNamesSorted = [];

        L.geoJSON(data, {
            style: (feature) => {
                if (feature.geometry.type === 'LineString') {
                    return {
                        color: '#f8fafc',
                        weight: 3.5,
                        opacity: 0.85,
                        dashArray: '5, 5',
                        className: 'campus-walkway-base'
                    };
                }
                return { color: '#3b82f6', weight: 2 };
            },
            pointToLayer: (feature, latlng) => {
                const name = feature.properties?.name?.trim() || '';
                const rawCat = feature.properties?.category || '';
                const icon = getPlaceIcon(name, rawCat);

                let dotColor = '#2563eb';
                if (icon === '🚻' || icon === '🚹' || icon === '🚺') dotColor = '#8b5cf6';
                else if (icon === '🏥') dotColor = '#ef4444';
                else if (icon === '🛡️') dotColor = '#f59e0b';
                else if (icon === '🏊‍♂️' || icon === '🏸' || icon === '🏀' || icon === '⚽') dotColor = '#10b981';

                return L.circleMarker(latlng, {
                    radius: 5,
                    fillColor: '#ffffff',
                    color: dotColor,
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 1
                });
            },
            onEachFeature: (feature, layer) => {
                const name = feature.properties?.name?.trim();
                const rawCat = feature.properties?.category || '';
                if (feature.geometry.type === 'Point' && name) {
                    markerLayers[name] = layer;
                    buildings[name] = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
                    placeMetadata[name] = {
                        category: getCategoryClassification(name, rawCat)
                    };
                    placeNamesSorted.push(name);

                    const icon = getPlaceIcon(name, rawCat);
                    layer.bindTooltip(`<span>${icon}</span> <span>${name}</span>`, {
                        permanent: true,
                        direction: 'top',
                        offset: [0, -6],
                        className: 'satellite-label'
                    });
                }
            }
        }).addTo(map);

        placeNamesSorted.sort();
        buildClientGraph(data);

        applyCategoryAndZoomFilter();
        clearTimeout(safetyTimer);
        hideLoader();

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => updateUserLiveLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
                () => console.warn("GPS permission pending")
            );
        }
    }

    // INSTANT LOCAL-FIRST LOADER (Bypasses Render 30s Cold Start)
    fetch('assets/data/giet_campus.geojson')
        .then(res => {
            if (!res.ok) throw new Error("Local GeoJSON not found");
            return res.json();
        })
        .then(data => {
            processGeoJSONData(data);
            hideLoader();
            console.log("⚡ Campus spatial data loaded instantly (<0.5s) from static bundle.");

            // Background non-blocking sync with backend
            fetch(`${API_URL}/api/campus-data`, { signal: AbortSignal.timeout(5000) })
                .then(res => res.json())
                .then(serverData => {
                    if (serverData && serverData.geojson) {
                        console.log("🔄 Background sync completed with live backend.");
                    }
                })
                .catch(() => console.log("Backend asleep; running on static campus data."));
        })
        .catch(err => {
            console.warn("Local bundle failed, falling back to API:", err);
            fetch(`${API_URL}/api/campus-data`)
                .then(res => res.json())
                .then(data => processGeoJSONData(data.geojson))
                .catch(apiErr => {
                    console.error("Critical: Unable to load campus data", apiErr);
                    clearTimeout(safetyTimer);
                    hideLoader();
                });
        });

    // ================= 17. ROUTE CALCULATION =================
    if (findRouteBtn) {
        findRouteBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            if (!selectedWaypoints.destination) {
                alert("Please select a Destination point.");
                return;
            }

            const coordsArray = [];

            if (selectedWaypoints.start.id === "LIVE_LOCATION") {
                if (!currentUserLat || !currentUserLng) {
                    alert("Acquiring GPS location... Please ensure location permissions are enabled.");
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                            pos => {
                                updateUserLiveLocation(pos.coords.latitude, pos.coords.longitude);
                                findRouteBtn.click();
                            },
                            err => alert("Unable to get GPS location: " + err.message)
                        );
                    }
                    return;
                }
                coordsArray.push([currentUserLat, currentUserLng]);
            } else if (buildings[selectedWaypoints.start.id]) {
                coordsArray.push(buildings[selectedWaypoints.start.id]);
            }

            selectedWaypoints.extraStops.forEach(st => {
                if (st && buildings[st.id]) coordsArray.push(buildings[st.id]);
            });

            if (buildings[selectedWaypoints.destination.id]) {
                coordsArray.push(buildings[selectedWaypoints.destination.id]);
            }

            if (coordsArray.length < 2) {
                alert("Please verify your starting and destination points.");
                return;
            }

            const routes = computeClientSideRoutes(coordsArray);
            if (!routes || routes.length === 0) {
                alert("No route connected between the selected locations.");
                return;
            }

            renderRoutes(routes);

            if (window.innerWidth <= 640) {
                applySheetSnap(0);
                setTimeout(() => {
                    const panel = document.querySelector('.panel-body');
                    if (panel && turnStepsContainer) {
                        panel.scrollTo({
                            top: turnStepsContainer.offsetTop - 20,
                            behavior: 'smooth'
                        });
                    }
                }, 280);
            }
        });
    }

    // ================= 18. GPS WATCH =================
    if (startNavBtn) {
        startNavBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert("Geolocation not supported by this browser.");
                return;
            }

            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
                isTrackingOrSimulating = false;
                startNavBtn.innerHTML = `<i class="fa-solid fa-location-arrow"></i> <span>Live GPS</span>`;
                startNavBtn.classList.remove('btn-danger');
                turnHud.classList.add('hidden');
                speakVoicePrompt("Navigation stopped.");
                return;
            }

            isTrackingOrSimulating = true;
            startNavBtn.innerHTML = `<i class="fa-solid fa-stop"></i> <span>Stop GPS</span>`;
            startNavBtn.classList.add('btn-danger');

            if (window.innerWidth <= 640) {
                applySheetSnap(1);
            }

            speakVoicePrompt("Starting GPS live navigation.");

            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    updateUserLiveLocation(lat, lng, pos.coords.accuracy);
                    map.panTo([lat, lng], { animate: true, duration: 0.5 });
                },
                (err) => alert("GPS Error: " + err.message),
                { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
            );
        });
    }

    // ================= 19. WALK SIMULATION =================
    function generateUniformAnimationPoints(coords, meterSpacing = 1.0) {
        const points = [];
        if (!coords || coords.length < 2) return points;

        for (let i = 0; i < coords.length - 1; i++) {
            const p1 = coords[i];
            const p2 = coords[i + 1];
            const segDist = getDistance(p1[0], p1[1], p2[0], p2[1]);
            const steps = Math.max(1, Math.round(segDist / meterSpacing));

            for (let s = 0; s < steps; s++) {
                const fraction = s / steps;
                const lat = p1[0] + (p2[0] - p1[0]) * fraction;
                const lng = p1[1] + (p2[1] - p1[1]) * fraction;
                points.push([lat, lng]);
            }
        }

        points.push(coords[coords.length - 1]);
        return points;
    }

    function runSimulationLoop(animationPoints, startIndex = 0) {
        if (simulationInterval) clearInterval(simulationInterval);

        const frameIntervalMs = Math.round(100 / simSpeedMultiplier);
        let stepIndex = startIndex;

        simulationInterval = setInterval(() => {
            if (stepIndex >= animationPoints.length) {
                clearInterval(simulationInterval);
                simulationInterval = null;
                isTrackingOrSimulating = false;
                simulateBtn.innerHTML = `<i class="fa-solid fa-play"></i> <span>Simulate</span>`;
                alert("You have arrived at your destination!");
                return;
            }

            const [lat, lng] = animationPoints[stepIndex];
            updateUserLiveLocation(lat, lng, 3);
            map.panTo([lat, lng], { animate: true, duration: frameIntervalMs / 1000 });
            stepIndex++;
            simulateBtn.setAttribute('data-current-idx', stepIndex);
        }, frameIntervalMs);
    }

    if (simulateBtn) {
        simulateBtn.addEventListener('click', () => {
            if (!fullRouteCoords || fullRouteCoords.length < 2) {
                alert("Find a route first to simulate walking.");
                return;
            }

            if (simulationInterval) {
                clearInterval(simulationInterval);
                simulationInterval = null;
                isTrackingOrSimulating = false;
                simulateBtn.innerHTML = `<i class="fa-solid fa-play"></i> <span>Simulate</span>`;
                speakVoicePrompt("Simulation paused.");
                return;
            }

            isTrackingOrSimulating = true;
            simulateBtn.innerHTML = `<i class="fa-solid fa-pause"></i> <span>Pause</span>`;

            if (window.innerWidth <= 640) {
                applySheetSnap(1);
            }

            speakVoicePrompt("Simulating walk.");

            const animationPoints = generateUniformAnimationPoints(fullRouteCoords, 1.0);
            window._simPointsCache = animationPoints;

            const savedIdx = parseInt(simulateBtn.getAttribute('data-current-idx') || '0', 10);
            const startAt = savedIdx >= animationPoints.length ? 0 : savedIdx;
            runSimulationLoop(animationPoints, startAt);
        });
    }

    if (speedToggleBtn) {
        speedToggleBtn.addEventListener('click', () => {
            speedOptionIdx = (speedOptionIdx + 1) % SPEED_OPTIONS.length;
            simSpeedMultiplier = SPEED_OPTIONS[speedOptionIdx];
            speedToggleBtn.textContent = `${simSpeedMultiplier}x`;

            if (simulationInterval && window._simPointsCache) {
                const currentIdx = parseInt(simulateBtn.getAttribute('data-current-idx') || '0', 10);
                runSimulationLoop(window._simPointsCache, currentIdx);
            }
        });
    }

    if (clearRouteBtn) {
        clearRouteBtn.addEventListener('click', () => {
            isTrackingOrSimulating = false;
            window.speechSynthesis.cancel();
            spokenMilestones.clear();

            if (remainingRoutePolyline) map.removeLayer(remainingRoutePolyline);
            if (breadcrumbPolyline) map.removeLayer(breadcrumbPolyline);
            alternativePolylines.forEach(p => map.removeLayer(p));
            alternativePolylines = [];
            remainingRoutePolyline = null;
            breadcrumbPolyline = null;
            fullRouteCoords = [];

            if (simulationInterval) {
                clearInterval(simulationInterval);
                simulationInterval = null;
                simulateBtn.innerHTML = `<i class="fa-solid fa-play"></i> <span>Simulate</span>`;
                simulateBtn.removeAttribute('data-current-idx');
            }
            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
                startNavBtn.innerHTML = `<i class="fa-solid fa-location-arrow"></i> <span>Live GPS</span>`;
                startNavBtn.classList.remove('btn-danger');
            }

            const extraRows = waypointsContainer.querySelectorAll('.stop-row');
            extraRows.forEach(row => row.remove());
            selectedWaypoints.extraStops = [];

            selectedWaypoints.destination = null;
            const destText = destinationDisplay.querySelector('.waypoint-text');
            destText.textContent = "Choose Destination";
            destText.classList.add('placeholder');

            turnHud.classList.add('hidden');
            tourCardModal.classList.add('hidden');
            turnStepsContainer.classList.add('hidden');
            routeOutput.classList.add('hidden');
            routeOptionsContainer.classList.add('hidden');
            map.setView(GIET_CENTER, 18);

            if (window.innerWidth <= 640) {
                applySheetSnap(0);
            }
        });
    }

    if (exitHudBtn) {
        exitHudBtn.addEventListener('click', () => {
            turnHud.classList.add('hidden');
            window.speechSynthesis.cancel();
        });
    }

    // ================= 20. SEARCH =================
    if (buildingSearch && searchResults) {
        buildingSearch.addEventListener('input', () => {
            const query = buildingSearch.value.trim().toLowerCase();
            searchResults.innerHTML = '';

            if (searchClearBtn) {
                searchClearBtn.classList.toggle('hidden', query.length === 0);
            }

            if (!query) {
                searchResults.classList.add('hidden');
                return;
            }

            const matchedPlaces = placeNamesSorted.filter(p => p.toLowerCase().includes(query));
            if (matchedPlaces.length === 0) {
                searchResults.innerHTML = `<div style="padding: 12px; text-align: center; color: #94a3b8; font-size: 13px;">No places found</div>`;
                searchResults.classList.remove('hidden');
                return;
            }

            matchedPlaces.slice(0, 8).forEach(place => {
                const icon = getPlaceIcon(place);
                const item = document.createElement('div');
                item.className = 'search-item';
                item.innerHTML = `<span style="font-size:18px;">${icon}</span> <strong>${place}</strong>`;

                const handleSelection = (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();

                    buildingSearch.value = place;
                    searchResults.classList.add('hidden');

                    selectedWaypoints.destination = { id: place, name: place };
                    const destText = destinationDisplay.querySelector('.waypoint-text');
                    destText.textContent = `${icon} ${place}`;
                    destText.classList.remove('placeholder');

                    const coords = buildings[place];
                    if (coords) {
                        map.flyTo(coords, 19, { duration: 1.0 });
                        if (markerLayers[place]) markerLayers[place].openTooltip();
                    }

                    if (window.innerWidth <= 640) {
                        applySheetSnap(0);
                    }
                };

                item.addEventListener('touchend', handleSelection);
                item.addEventListener('click', handleSelection);

                searchResults.appendChild(item);
            });

            searchResults.classList.remove('hidden');
        });

        if (searchClearBtn) {
            searchClearBtn.addEventListener('click', () => {
                buildingSearch.value = '';
                searchResults.classList.add('hidden');
                searchClearBtn.classList.add('hidden');
            });
        }

        document.addEventListener('click', (e) => {
            if (!buildingSearch.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.add('hidden');
            }
        });
    }
});