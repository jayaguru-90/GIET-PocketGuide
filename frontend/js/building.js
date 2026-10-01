
```javascript
/* =========================================================
   GIETU CAMPUS GUIDE
   BUILDING DIRECTORY + DYNAMIC SQLITE FLOOR PLAN
   ========================================================= */

const buildingNames = [
    { id: 1, name: "AME", icon: "📍", category: "Academic", description: "AME academic and training facility." },
    { id: 2, name: "Admin Block", icon: "🏛️", category: "Administration", description: "Main administrative block of GIET University." },
    { id: 3, name: "Admin WC", icon: "🚻", category: "Washroom", description: "Washroom facility near the Admin Block." },
    { id: 4, name: "Agriculture Block", icon: "🌾", category: "Academic", description: "Agriculture Engineering academic block." },
    { id: 5, name: "BSH Building", icon: "🔬", category: "Academic", description: "Basic Science and Humanities academic building." },
    { id: 6, name: "Badminton Court", icon: "🏸", category: "Sports", description: "Campus badminton sports facility." },
    { id: 7, name: "Basket Ball Court", icon: "🏀", category: "Sports", description: "Campus basketball sports facility." },
    { id: 8, name: "Bio tech Building", icon: "🧪", category: "Academic", description: "Biotechnology academic and laboratory building." },
    { id: 9, name: "Bus-stop", icon: "🚌", category: "Transport", description: "Campus bus stop and transportation point." },
    { id: 10, name: "CSA Block", icon: "💻", category: "Academic", description: "Computer Science and Applications academic block." },
    { id: 11, name: "CSE Building", icon: "💻", category: "Academic", description: "Computer Science and Engineering academic building." },
    { id: 12, name: "CSE WC", icon: "🚻", category: "Washroom", description: "Washroom facility serving the CSE Building." },
    { id: 13, name: "Canteen", icon: "🍱", category: "Food", description: "Campus canteen serving food and refreshments." },
    { id: 14, name: "Car parking", icon: "🌳", category: "Parking", description: "Campus vehicle parking area." },
    { id: 15, name: "Central Mess", icon: "🍲", category: "Food", description: "Central campus dining and mess facility." },
    { id: 16, name: "Cool Parloor", icon: "🍧", category: "Food", description: "Campus refreshment and food facility." },
    { id: 17, name: "Dept. Manegment", icon: "📊", category: "Administration", description: "Department management facility." },
    { id: 18, name: "Dispensary", icon: "🏥", category: "Medical", description: "Campus medical and first-aid facility." },
    { id: 19, name: "ECE Block", icon: "⚡", category: "Academic", description: "Electronics and Communication Engineering block." },
    { id: 20, name: "GIET Temple", icon: "🛕", category: "Religious", description: "GIET campus temple." },
    { id: 21, name: "GPS School", icon: "📍", category: "Education", description: "GPS School campus facility." },
    { id: 22, name: "Gandhi Park", icon: "🌳", category: "Recreation", description: "Campus green recreational area." },
    { id: 23, name: "Gens washroom", icon: "🚹", category: "Washroom", description: "General men's washroom facility." },
    { id: 24, name: "Giet main ground", icon: "⚽", category: "Sports", description: "GIET main sports ground." },
    { id: 25, name: "Guest House", icon: "🏨", category: "Accommodation", description: "GIET University guest accommodation." },
    { id: 26, name: "Hardware section", icon: "⚡", category: "Technical", description: "Campus hardware and technical support section." },
    { id: 27, name: "Library", icon: "📚", category: "Academic", description: "Central library and learning resource facility." },
    { id: 28, name: "MB WC", icon: "🚻", category: "Washroom", description: "Washroom facility serving the MB area." },
    { id: 29, name: "Main Gate", icon: "🚪", category: "Entrance", description: "Main entrance gate of GIET University." },
    { id: 30, name: "Mechanical building", icon: "⚙️", category: "Academic", description: "Mechanical Engineering academic building." },
    { id: 31, name: "NC-10", icon: "🏢", category: "Academic", description: "NC-10 campus building." },
    { id: 32, name: "NC-13", icon: "🏢", category: "Academic", description: "NC-13 campus building." },
    { id: 33, name: "NC-14", icon: "🏢", category: "Academic", description: "NC-14 campus building." },
    { id: 34, name: "NC-8", icon: "🏢", category: "Academic", description: "NC-8 campus building." },
    { id: 35, name: "NC-9", icon: "🏢", category: "Academic", description: "NC-9 campus building." },
    { id: 36, name: "Parking", icon: "🌳", category: "Parking", description: "General campus parking area." },
    { id: 37, name: "RDB Building", icon: "🏫", category: "Academic", description: "RDB academic building." },
    { id: 38, name: "RDB WC", icon: "🚻", category: "Washroom", description: "Washroom facility serving the RDB Building." },
    { id: 39, name: "Swimming pool", icon: "🏊‍♂️", category: "Sports", description: "GIET campus swimming pool." },
    { id: 40, name: "Temple Garden/Open Gym", icon: "🛕", category: "Recreation", description: "Temple garden and open gym recreational area." },
    { id: 41, name: "security", icon: "🛡️", category: "Security", description: "Campus security facility." },
    { id: 42, name: "wc1", icon: "🚻", category: "Washroom", description: "Campus washroom facility WC1." }
];

function createRooms(prefix, buildingName, floorNumber) {
    var shortName = buildingName.replace(" Building", "").replace(" Block", "");
    return [
        { number: prefix + "-" + floorNumber + "01", name: shortName + " Room 01", type: "Room", description: buildingName + " room on this floor." },
        { number: prefix + "-" + floorNumber + "02", name: shortName + " Room 02", type: "Room", description: buildingName + " room on this floor." },
        { number: prefix + "-" + floorNumber + "03", name: shortName + " Room 03", type: "Room", description: buildingName + " room on this floor." },
        { number: prefix + "-" + floorNumber + "04", name: "Faculty / Office", type: "Office", description: buildingName + " faculty or office area." }
    ];
}

function createFloors(building) {
    var academicBuildings = [
        "AME", "Agriculture Block", "BSH Building", "Bio tech Building",
        "CSA Block", "CSE Building", "ECE Block", "Mechanical building",
        "NC-10", "NC-13", "NC-14", "NC-8", "NC-9", "RDB Building", "Library"
    ];

    if (academicBuildings.indexOf(building.name) !== -1) {
        var prefix = building.name.replace(/\s/g, "").substring(0, 4).toUpperCase();
        return [
            { id: 1, name: "Ground Floor", floor_number: 1, rooms: createRooms(prefix, building.name, "G") },
            { id: 2, name: "First Floor", floor_number: 2, rooms: createRooms(prefix, building.name, "F") },
            { id: 3, name: "Second Floor", floor_number: 3, rooms: createRooms(prefix, building.name, "S") },
            { id: 4, name: "Third Floor", floor_number: 4, rooms: createRooms(prefix, building.name, "T") }
        ];
    }

    return [
        {
            id: 1,
            name: "Ground Level",
            floor_number: 1,
            rooms: [
                { number: "AREA-01", name: building.name, type: building.category, description: building.description },
                { number: "AREA-02", name: "Main Area", type: "Facility", description: "Main area of " + building.name + "." },
                { number: "AREA-03", name: "Support Area", type: "Facility", description: "Support area of " + building.name + "." }
            ]
        }
    ];
}

var buildings = buildingNames.map(function(b) {
    b.floors = createFloors(b);
    return b;
});

// DOM Elements
var buildingList = document.getElementById("buildingList");
var buildingCount = document.getElementById("buildingCount");
var buildingSearch = document.getElementById("buildingSearch");
var clearSearch = document.getElementById("clearSearch");
var buildingDetails = document.getElementById("buildingDetails");
var selectedBuildingName = document.getElementById("selectedBuildingName");
var selectedBuildingDescription = document.getElementById("selectedBuildingDescription");
var selectedBuildingIcon = document.getElementById("selectedBuildingIcon");
var closeBuilding = document.getElementById("closeBuilding");
var floorTabs = document.getElementById("floorTabs");
var floorCount = document.getElementById("floorCount");
var selectedFloorName = document.getElementById("selectedFloorName");
var roomCount = document.getElementById("roomCount");
var floorLayout = document.getElementById("floorLayout");
var roomInformation = document.getElementById("roomInformation");
var roomName = document.getElementById("roomName");
var roomDescription = document.getElementById("roomDescription");
var noResults = document.getElementById("noResults");
var themeButton = document.getElementById("themeButton");

var selectedBuilding = null;
var selectedFloor = null;

function getTotalRooms(building) {
    return building.floors.reduce(function(tot, f) {
        return tot + (f.rooms ? f.rooms.length : 0);
    }, 0);
}

function displayBuildings(data) {
    if (!buildingList) return;
    buildingList.innerHTML = "";
    if (buildingCount) buildingCount.textContent = data.length;

    if (data.length === 0) {
        if (noResults) noResults.classList.remove("hidden");
        return;
    }
    if (noResults) noResults.classList.add("hidden");

    data.forEach(function(building) {
        var card = document.createElement("div");
        card.className = "building-card";

        var levelLabel = building.floors.length === 1 ? "Level" : "Floors";
        var htmlContent = "";
        htmlContent += '

```

';
htmlContent += '

' + building.icon + '

';
htmlContent += '

→

';
htmlContent += '

';
htmlContent += '

### ' + building.name + '

';
htmlContent += '

' + building.description + '

';
htmlContent += '

';
htmlContent += '  ' + building.floors.length + ' ' + levelLabel + '';
htmlContent += '  ' + getTotalRooms(building) + ' Areas';
htmlContent += '  ' + building.category + '';
htmlContent += '

';

```
    card.innerHTML = htmlContent;

    card.addEventListener("click", function() {
        openBuilding(building);
    });
    buildingList.appendChild(card);
});

```

}

function openBuilding(building) {
selectedBuilding = building;
if (selectedBuildingName) selectedBuildingName.textContent = building.name;
if (selectedBuildingDescription) selectedBuildingDescription.textContent = building.description;
if (selectedBuildingIcon) selectedBuildingIcon.textContent = building.icon;

```
var url = "http://127.0.0.1:8000/api/buildings/" + encodeURIComponent(building.name) + "/floors";
fetch(url)
    .then(function(res) {
        if (res.ok) return res.json();
        return null;
    })
    .then(function(dbFloors) {
        if (dbFloors && dbFloors.length > 0) {
            building.floors = dbFloors;
        }
    })
    .catch(function(e) {
        console.warn("Backend not running or offline, using fallback array:", e);
    })
    .finally(function() {
        var levelText = building.floors.length === 1 ? "Level" : "Floors";
        if (floorCount) floorCount.textContent = building.floors.length + " " + levelText;
        if (buildingDetails) buildingDetails.classList.remove("hidden");

        renderFloors(building.floors);

        if (building.floors.length > 0) {
            var def = building.floors[0];
            if (building.name === "CSA Block") {
                for (var i = 0; i < building.floors.length; i++) {
                    var f = building.floors[i];
                    if (f.floor_number === 3 || (f.name && f.name.indexOf("Third") !== -1)) {
                        def = f;
                        break;
                    }
                }
            }
            selectFloor(def);
        }

        setTimeout(function() {
            if (buildingDetails) {
                buildingDetails.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }, 100);
    });

```

}

function renderFloors(floors) {
if (!floorTabs) return;
floorTabs.innerHTML = "";
floors.forEach(function(floor, i) {
var btn = document.createElement("button");
btn.className = "floor-tab";
if (i === 0) btn.classList.add("active");
btn.textContent = floor.name;

```
    btn.addEventListener("click", function() {
        var allTabs = document.querySelectorAll(".floor-tab");
        for (var j = 0; j < allTabs.length; j++) {
            allTabs[j].classList.remove("active");
        }
        btn.classList.add("active");
        selectFloor(floor);
    });
    floorTabs.appendChild(btn);
});

```

}

function selectFloor(floor) {
selectedFloor = floor;
if (selectedFloorName) selectedFloorName.textContent = floor.name;
if (roomCount) roomCount.textContent = floor.rooms ? floor.rooms.length : 0;
renderRooms(floor.rooms || []);
if (roomInformation) roomInformation.classList.add("hidden");
}

function addCSABoardDecorations(plan) {
var label = document.createElement("div");
label.className = "plan-label";
label.textContent = selectedFloor.department || "DEPARTMENT OF COMPUTER SCIENCE AND APPLICATIONS (CSA)";
plan.appendChild(label);

```
var corridor = document.createElement("div");
corridor.className = "floor-corridor horizontal";
corridor.style.left = "105px";
corridor.style.width = "540px";
corridor.style.top = "175px";
corridor.style.height = "90px";
corridor.textContent = "THIRD FLOOR CORRIDOR";
plan.appendChild(corridor);

var vertical = document.createElement("div");
vertical.className = "floor-corridor vertical";
vertical.style.left = "655px";
vertical.style.top = "190px";
vertical.style.width = "70px";
vertical.style.height = "165px";
vertical.textContent = "CORRIDOR";
plan.appendChild(vertical);

var stairL = document.createElement("div");
stairL.className = "staircase";
stairL.style.left = "25px";
stairL.style.top = "170px";
stairL.style.width = "65px";
stairL.style.height = "100px";
stairL.innerHTML = "STAIRS";
plan.appendChild(stairL);

var stairR = document.createElement("div");
stairR.className = "staircase";
stairR.style.left = "735px";
stairR.style.top = "95px";
stairR.style.width = "110px";
stairR.style.height = "165px";
stairR.innerHTML = "STAIRCASE";
plan.appendChild(stairR);

```

}

function addFloorStructure(plan) {
var label = document.createElement("div");
label.className = "plan-label";
label.textContent = (selectedFloor.name || "").toUpperCase();
plan.appendChild(label);

```
var hCorr = document.createElement("div");
hCorr.className = "floor-corridor horizontal";
hCorr.style.left = "20px";
hCorr.style.right = "20px";
hCorr.style.height = "58px";
hCorr.style.top = "218px";
hCorr.textContent = "MAIN CORRIDOR";
plan.appendChild(hCorr);

```

}

function renderRooms(rooms) {
if (!floorLayout) return;
floorLayout.innerHTML = "";
var plan = document.createElement("div");
plan.className = "floor-plan";

```
var isCSA = selectedBuilding &&
    selectedBuilding.name === "CSA Block" &&
    selectedFloor &&
    (selectedFloor.name === "Third Floor" || selectedFloor.floor_number === 3);

if (isCSA) {
    plan.classList.add("csa-board-theme");
    addCSABoardDecorations(plan);
} else {
    addFloorStructure(plan);
}

rooms.forEach(function(room, i) {
    var el = document.createElement("div");
    el.className = "room";

    if (room.plan) {
        el.style.left = room.plan.x + "px";
        el.style.top = room.plan.y + "px";
        el.style.width = room.plan.w + "px";
        el.style.height = room.plan.h + "px";
    } else {
        var defPos = [
            { x: 105, y: 40 }, { x: 340, y: 40 }, { x: 575, y: 40 },
            { x: 105, y: 300 }, { x: 340, y: 300 }, { x: 575, y: 300 }
        ];
        var p = defPos[i % defPos.length];
        el.style.left = p.x + "px";
        el.style.top = p.y + "px";
        el.style.width = "150px";
        el.style.height = "90px";
    }

    var labelText = room.name || room.number || "";
    el.innerHTML = '

```

' + labelText + '

';

```
    el.addEventListener("click", function(ev) {
        ev.stopPropagation();
        var allRooms = document.querySelectorAll(".room");
        for (var k = 0; k < allRooms.length; k++) {
            allRooms[k].classList.remove("selected");
        }
        el.classList.add("selected");
        showRoomInformation(room);
    });

    plan.appendChild(el);
});

floorLayout.appendChild(plan);

```

}

function showRoomInformation(room) {
if (roomName) roomName.textContent = (room.number || "") + " - " + (room.name || "");
if (roomDescription) roomDescription.textContent = room.description || "Room details available in department directory.";
if (roomInformation) {
roomInformation.classList.remove("hidden");
roomInformation.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
}

if (closeBuilding) {
closeBuilding.addEventListener("click", function() {
if (buildingDetails) buildingDetails.classList.add("hidden");
selectedBuilding = null;
selectedFloor = null;
window.scrollTo({ top: 0, behavior: "smooth" });
});
}

if (buildingSearch) {
buildingSearch.addEventListener("input", function() {
var s = buildingSearch.value.toLowerCase().trim();
displayBuildings(buildings.filter(function(b) {
return b.name.toLowerCase().indexOf(s) !== -1 ||
b.description.toLowerCase().indexOf(s) !== -1 ||
b.category.toLowerCase().indexOf(s) !== -1;
}));
});
}

if (clearSearch) {
clearSearch.addEventListener("click", function() {
buildingSearch.value = "";
displayBuildings(buildings);
buildingSearch.focus();
});
}

var darkMode = true;
if (themeButton) {
themeButton.addEventListener("click", function() {
darkMode = !darkMode;
if (darkMode) {
document.body.style.background = "radial-gradient(circle at 15% 15%, rgba(37,99,235,0.35), transparent 32%), radial-gradient(circle at 85% 20%, rgba(124,58,237,0.28), transparent 30%), linear-gradient(135deg, #07152f, #0c2347, #07152f)";
themeButton.textContent = "☾";
} else {
document.body.style.background = "linear-gradient(135deg, #dbeafe, #eef2ff, #f8fafc)";
themeButton.textContent = "☀";
}
});
}

displayBuildings(buildings);

```

```