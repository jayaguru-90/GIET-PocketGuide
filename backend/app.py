import math
import json
import os
import heapq
import io
from typing import Dict, List, Tuple, Optional
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import func
from PIL import Image
import cv2
import numpy as np

from database import SessionLocal, Floor, Room, init_db

app = FastAPI(title="GIET Campus Guide API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    init_db()

GEOJSON_PATH = os.path.join(os.path.dirname(__file__), "..", "frontend", "assets", "data", "giet_campus.geojson")
if not os.path.exists(GEOJSON_PATH):
    GEOJSON_PATH = os.path.join(os.path.dirname(__file__), "assets", "data", "giet_campus.geojson")

def load_geojson():
    if not os.path.exists(GEOJSON_PATH):
        return {"type": "FeatureCollection", "features": []}
    with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def save_geojson(data):
    with open(GEOJSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

# --- Spatial Math Functions ---
def haversine_distance(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    R = 6371000  # Earth's radius in meters
    lat1, lon1 = math.radians(coord1[0]), math.radians(coord1[1])
    lat2, lon2 = math.radians(coord2[0]), math.radians(coord2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    return 2 * R * math.asin(math.sqrt(a))

def to_key(lat: float, lon: float) -> str:
    return f"{round(lat, 6)},{round(lon, 6)}"

def parse_key(key: str) -> Tuple[float, float]:
    lat, lon = map(float, key.split(","))
    return lat, lon

def calculate_bearing(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """Calculates compass heading angle (0-360 degrees) between two GPS points."""
    lat1, lon1 = math.radians(coord1[0]), math.radians(coord1[1])
    lat2, lon2 = math.radians(coord2[0]), math.radians(coord2[1])
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - (math.sin(lat1) * math.cos(lat2) * math.cos(dlon))
    return (math.degrees(math.atan2(x, y)) + 360) % 360

def build_routing_graph(features: List[dict]):
    graph: Dict[str, List[dict]] = {}
    nodes_list: List[str] = []

    def add_edge(u_key: str, v_key: str, u_coord: Tuple[float, float], v_coord: Tuple[float, float]):
        if u_key == v_key:
            return
        dist = haversine_distance(u_coord, v_coord)
        if u_key not in graph:
            graph[u_key] = []
            nodes_list.append(u_key)
        if v_key not in graph:
            graph[v_key] = []
            nodes_list.append(v_key)

        if not any(e["node"] == v_key for e in graph[u_key]):
            graph[u_key].append({"node": v_key, "weight": dist, "coord": v_coord})
        if not any(e["node"] == u_key for e in graph[v_key]):
            graph[v_key].append({"node": u_key, "weight": dist, "coord": u_coord})

    for feat in features:
        geom = feat.get("geometry", {})
        if geom.get("type") == "LineString":
            coords = geom.get("coordinates", [])
            for i in range(len(coords) - 1):
                u = (coords[i][1], coords[i][0])
                v = (coords[i+1][1], coords[i+1][0])
                add_edge(to_key(u[0], u[1]), to_key(v[0], v[1]), u, v)

    # Tolerance-based node welding: weld nodes within 12 meters to guarantee connectivity
    for i in range(len(nodes_list)):
        p1 = parse_key(nodes_list[i])
        for j in range(i + 1, len(nodes_list)):
            p2 = parse_key(nodes_list[j])
            dist = haversine_distance(p1, p2)
            if dist <= 12.0:
                add_edge(nodes_list[i], nodes_list[j], p1, p2)

    return graph, nodes_list

# Exclusions so outdoor amenities aren't listed as multi-floor buildings
EXCLUDED_CATEGORIES = {"sports ground", "water", "washroom", "security", "medical", "parking"}
EXCLUDED_KEYWORDS = ["court", "ground", "swimming", "bus-stop", "parking", "garden", "temple", "park"]

# --- Pydantic Data Contracts ---
class PointPayload(BaseModel):
    id: Optional[int] = None
    name: str
    category: str
    latitude: float
    longitude: float

class RoutePayload(BaseModel):
    id: Optional[int] = None
    name: str
    highway: Optional[str] = "footway"
    coordinates: List[List[float]]

class WaypointRequest(BaseModel):
    waypoints: List[str]

class FloorPayload(BaseModel):
    id: Optional[int] = None
    building_name: str
    floor_number: int
    name: str
    department: Optional[str] = ""

class RoomPayload(BaseModel):
    id: Optional[int] = None
    floor_id: int
    number: str
    name: str
    type: str
    description: Optional[str] = ""
    x: int
    y: int
    w: int
    h: int

# --- Outdoor Map Endpoints ---
@app.get("/api/campus-data")
def get_campus_data():
    geojson = load_geojson()
    buildings = {}
    place_names = []

    for feat in geojson.get("features", []):
        if feat.get("geometry", {}).get("type") == "Point":
            name = feat.get("properties", {}).get("name")
            if name:
                coords = feat["geometry"]["coordinates"]
                buildings[name.strip()] = [coords[1], coords[0]]
                place_names.append(name.strip())

    place_names.sort()
    return {"geojson": geojson, "buildings": buildings, "placeNames": place_names}

@app.get("/api/admin/features")
def get_all_features():
    return load_geojson()

@app.post("/api/admin/save-point")
def save_point(payload: PointPayload):
    geojson = load_geojson()
    new_feat = {
        "type": "Feature",
        "properties": {
            "name": payload.name.strip(),
            "category": payload.category
        },
        "geometry": {
            "type": "Point",
            "coordinates": [payload.longitude, payload.latitude]
        }
    }

    if payload.id is not None and 0 <= payload.id < len(geojson["features"]):
        geojson["features"][payload.id] = new_feat
    else:
        geojson["features"].append(new_feat)

    save_geojson(geojson)
    return {"status": "success", "message": "Location saved"}

@app.post("/api/admin/save-route")
def save_route(payload: RoutePayload):
    geojson = load_geojson()
    new_feat = {
        "type": "Feature",
        "properties": {
            "name": payload.name.strip(),
            "highway": payload.highway or "footway"
        },
        "geometry": {
            "type": "LineString",
            "coordinates": payload.coordinates
        }
    }

    if payload.id is not None and 0 <= payload.id < len(geojson["features"]):
        geojson["features"][payload.id] = new_feat
    else:
        geojson["features"].append(new_feat)

    save_geojson(geojson)
    return {"status": "success", "message": "Walkway saved"}

@app.delete("/api/admin/feature/{index}")
def delete_feature(index: int):
    geojson = load_geojson()
    if 0 <= index < len(geojson["features"]):
        deleted = geojson["features"].pop(index)
        save_geojson(geojson)
        return {"status": "success", "deleted": deleted.get("properties", {}).get("name")}
    raise HTTPException(status_code=404, detail="Feature not found")

# --- Core A* Pathfinding with Turn Penalties ---
@app.post("/api/routes")
def calculate_routes(req: WaypointRequest):
    cleaned_waypoints = [wp.strip() for wp in req.waypoints if wp and wp.strip()]
    if len(cleaned_waypoints) < 2:
        raise HTTPException(status_code=400, detail="Select at least two valid points.")

    geojson = load_geojson()
    buildings: Dict[str, Tuple[float, float]] = {}
    for feat in geojson.get("features", []):
        if feat.get("geometry", {}).get("type") == "Point":
            name = feat.get("properties", {}).get("name")
            if name:
                c = feat["geometry"]["coordinates"]
                buildings[name.strip().lower()] = (c[1], c[0])

    resolved_coords = []
    indoor_metadata = None
    db = SessionLocal()

    try:
        for idx, wp in enumerate(cleaned_waypoints):
            wp_lower = wp.lower()

            # 1. Direct match with outdoor landmark
            if wp_lower in buildings:
                resolved_coords.append(buildings[wp_lower])
                continue

            # 2. Check if waypoint is a room in database (e.g., "CSA-4")
            room_match = db.query(Room).join(Floor).filter(
                (func.lower(Room.number) == wp_lower) |
                (func.lower(Room.name) == wp_lower)
            ).first()

            if room_match:
                host_bldg = room_match.floor.building_name.lower().strip()
                # Find matching building coordinate
                matched_bldg_key = next((b for b in buildings if b in host_bldg or host_bldg in b), None)

                if matched_bldg_key:
                    resolved_coords.append(buildings[matched_bldg_key])
                    # If this room was the final destination, save deep-link metadata
                    if idx == len(cleaned_waypoints) - 1:
                        indoor_metadata = {
                            "building": room_match.floor.building_name,
                            "floor_number": room_match.floor.floor_number,
                            "room_code": room_match.number,
                            "room_name": room_match.name
                        }
                    continue

            raise HTTPException(status_code=400, detail=f"Location or Room '{wp}' not found on campus map.")
    finally:
        db.close()

    graph, nodes_list = build_routing_graph(geojson.get("features", []))

    def find_nearest_walkway_node(lat: float, lon: float) -> Optional[str]:
        best_node = None
        min_d = float("inf")
        for node_key in nodes_list:
            n_lat, n_lon = parse_key(node_key)
            d = haversine_distance((lat, lon), (n_lat, n_lon))
            if d < min_d:
                min_d = d
                best_node = node_key
        return best_node

    # A* Search with Turn Angle Penalty Implementation
    def a_star_search(start_node: str, target_node: str, penalties: dict):
        target_coord = parse_key(target_node)
        
        # Priority queue holds tuples of: (f_score, current_node, previous_bearing)
        initial_h = haversine_distance(parse_key(start_node), target_coord)
        unvisited = [(initial_h, start_node, None)]
        
        g_score = {start_node: 0.0}
        previous = {}
        node_bearings = {start_node: None}

        while unvisited:
            _, u, prev_bearing = heapq.heappop(unvisited)
            
            if u == target_node:
                break

            cur_g = g_score.get(u, float("inf"))
            u_coord = parse_key(u)

            for edge in graph.get(u, []):
                v = edge["node"]
                v_coord = edge["coord"]
                pen_multiplier = penalties.get((u, v), 1.0)
                edge_weight = edge["weight"] * pen_multiplier

                # Compute turn deflection penalty (>60 degrees adds +4m cost)
                current_bearing = calculate_bearing(u_coord, v_coord)
                turn_penalty = 0.0
                if prev_bearing is not None:
                    angle_diff = abs(current_bearing - prev_bearing)
                    if angle_diff > 180:
                        angle_diff = 360 - angle_diff
                    if angle_diff > 60:
                        turn_penalty = 4.0  # +4 meter turn penalty

                tentative_g = cur_g + edge_weight + turn_penalty

                if tentative_g < g_score.get(v, float("inf")):
                    g_score[v] = tentative_g
                    previous[v] = u
                    node_bearings[v] = current_bearing
                    
                    h_score = haversine_distance(v_coord, target_coord)
                    f_score = tentative_g + h_score
                    heapq.heappush(unvisited, (f_score, v, current_bearing))

        if target_node not in g_score:
            return None, float("inf")

        path = []
        curr = target_node
        while curr in previous:
            path.append(parse_key(curr))
            curr = previous[curr]
        path.append(parse_key(start_node))
        path.reverse()
        return path, g_score[target_node]

    routes = []
    penalties = {}
    is_multi = len(resolved_coords) > 2

    for attempt in range(3):
        full_coords = []
        total_dist = 0.0
        failed = False

        for i in range(len(resolved_coords) - 1):
            p1 = resolved_coords[i]
            p2 = resolved_coords[i+1]

            n1 = find_nearest_walkway_node(p1[0], p1[1])
            n2 = find_nearest_walkway_node(p2[0], p2[1])

            if not n1 or not n2:
                failed = True
                break

            leg_coords, leg_dist = a_star_search(n1, n2, penalties)
            if not leg_coords:
                failed = True
                break

            total_dist += leg_dist
            segment_full = [list(p1)]
            for pt in leg_coords:
                if list(pt) != segment_full[-1]:
                    segment_full.append(list(pt))
            if list(p2) != segment_full[-1]:
                segment_full.append(list(p2))

            if full_coords:
                full_coords.extend(segment_full[1:])
            else:
                full_coords.extend(segment_full)

        if not failed and full_coords:
            rounded_dist = round(total_dist)
            if not any(abs(r["totalDistance"] - rounded_dist) < 8 for r in routes):
                routes.append({
                    "path": full_coords,
                    "totalDistance": rounded_dist
                })
                if len(routes) >= (2 if is_multi else 3):
                    break

            # Penalize edges for diverse alternatives
            for i in range(len(full_coords) - 1):
                u_k = to_key(full_coords[i][0], full_coords[i][1])
                v_k = to_key(full_coords[i+1][0], full_coords[i+1][1])
                penalties[(u_k, v_k)] = penalties.get((u_k, v_k), 1.0) * 2.5
                penalties[(v_k, u_k)] = penalties.get((v_k, u_k), 1.0) * 2.5

    if not routes:
        raise HTTPException(status_code=404, detail="No walkway route connected between selected locations.")

    routes.sort(key=lambda r: r["totalDistance"])
    labels = [
        "Shortest Route (Via Walkway)" if not is_multi else "Shortest Multi-Stop Route",
        "Alternative 1 (Via Campus Road)",
        "Alternative 2 (Via Outer Walkway)"
    ]

    for idx, r in enumerate(routes):
        r["name"] = labels[idx] if idx < len(labels) else f"Route Option {idx + 1}"

    response = {"routes": routes}
    if indoor_metadata:
        response["indoorTarget"] = indoor_metadata

    return response

# --- Unified Search Endpoint: Outdoor Points & Indoor Rooms ---
@app.get("/api/search-destinations")
def search_destinations(q: str):
    query = q.strip().lower()
    results = []

    geojson = load_geojson()
    for feat in geojson.get("features", []):
        if feat.get("geometry", {}).get("type") == "Point":
            name = feat.get("properties", {}).get("name", "")
            cat = feat.get("properties", {}).get("category", "")
            if query in name.lower():
                results.append({
                    "title": name,
                    "subtitle": cat or "Outdoor Landmark",
                    "type": "outdoor",
                    "target": name
                })

    db = SessionLocal()
    try:
        rooms = db.query(Room).join(Floor).filter(
            (func.lower(Room.number).contains(query)) |
            (func.lower(Room.name).contains(query))
        ).all()

        for r in rooms:
            results.append({
                "title": f"{r.number} - {r.name}",
                "subtitle": f"{r.floor.building_name} • {r.floor.name}",
                "type": "indoor",
                "building": r.floor.building_name,
                "floor_number": r.floor.floor_number,
                "room_code": r.number
            })
    finally:
        db.close()

    return results[:10]

# --- Floor & Room Layout Endpoints ---
@app.get("/api/admin/buildings-list")
def get_buildings_list():
    db = SessionLocal()
    try:
        db_buildings = [b[0].strip() for b in db.query(Floor.building_name).distinct().all() if b[0]]
        geojson = load_geojson()
        
        map_buildings = []
        for f in geojson.get("features", []):
            if f.get("geometry", {}).get("type") == "Point":
                name = f.get("properties", {}).get("name", "").strip()
                cat = f.get("properties", {}).get("category", "").strip().lower()
                
                if not name or cat in EXCLUDED_CATEGORIES:
                    continue
                if any(k in name.lower() for k in EXCLUDED_KEYWORDS):
                    continue
                map_buildings.append(name)

        unique_map = {}
        for bldg in (db_buildings + map_buildings):
            key = bldg.lower().strip()
            if key not in unique_map or ("Block" in bldg and "block" in unique_map[key]):
                unique_map[key] = bldg

        return sorted(list(unique_map.values()))
    finally:
        db.close()

@app.get("/api/buildings/{building_name}/floors")
def get_floors_by_building(building_name: str):
    db = SessionLocal()
    try:
        clean_target = building_name.strip().lower()
        floors = db.query(Floor).filter(func.lower(Floor.building_name) == clean_target).order_by(Floor.floor_number).all()
        result = []
        for f in floors:
            result.append({
                "id": f.id,
                "building_name": f.building_name,
                "floor_number": f.floor_number,
                "name": f.name,
                "department": f.department,
                "rooms": [
                    {
                        "id": r.id,
                        "number": r.number,
                        "name": r.name,
                        "type": r.type,
                        "description": r.description,
                        "plan": {"x": r.x, "y": r.y, "w": r.w, "h": r.h}
                    }
                    for r in f.rooms
                ]
            })
        return result
    finally:
        db.close()

@app.post("/api/admin/save-floor")
def save_floor(payload: FloorPayload):
    db = SessionLocal()
    try:
        if payload.id:
            floor = db.query(Floor).filter(Floor.id == payload.id).first()
            if not floor:
                raise HTTPException(status_code=404, detail="Floor not found")
            floor.building_name = payload.building_name.strip()
            floor.floor_number = payload.floor_number
            floor.name = payload.name
            floor.department = payload.department
        else:
            floor = Floor(
                building_name=payload.building_name.strip(),
                floor_number=payload.floor_number,
                name=payload.name,
                department=payload.department
            )
            db.add(floor)
        db.commit()
        db.refresh(floor)
        return {"status": "success", "id": floor.id, "message": "Floor saved"}
    finally:
        db.close()

@app.delete("/api/admin/floor/{floor_id}")
def delete_floor(floor_id: int):
    db = SessionLocal()
    try:
        floor = db.query(Floor).filter(Floor.id == floor_id).first()
        if not floor:
            raise HTTPException(status_code=404, detail="Floor not found")
        db.delete(floor)
        db.commit()
        return {"status": "success", "message": "Floor deleted"}
    finally:
        db.close()

@app.post("/api/admin/save-room")
def save_room(payload: RoomPayload):
    db = SessionLocal()
    try:
        if payload.id:
            room = db.query(Room).filter(Room.id == payload.id).first()
            if not room:
                room = Room(id=payload.id)
                db.add(room)
            room.floor_id = payload.floor_id
            room.number = payload.number
            room.name = payload.name
            room.type = payload.type
            room.description = payload.description
            room.x = payload.x
            room.y = payload.y
            room.w = payload.w
            room.h = payload.h
        else:
            room = Room(
                floor_id=payload.floor_id,
                number=payload.number,
                name=payload.name,
                type=payload.type,
                description=payload.description,
                x=payload.x,
                y=payload.y,
                w=payload.w,
                h=payload.h
            )
            db.add(room)
        db.commit()
        db.refresh(room)
        return {"status": "success", "id": room.id, "message": "Room saved"}
    finally:
        db.close()

@app.delete("/api/admin/room/{room_id}")
def delete_room(room_id: int):
    db = SessionLocal()
    try:
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        db.delete(room)
        db.commit()
        return {"status": "success", "message": "Room deleted"}
    finally:
        db.close()

# --- Computer Vision Sketch / PNG Auto-Detector Endpoint ---
@app.post("/api/admin/detect-sketch")
async def detect_sketch_layout(file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    img_np = np.array(image)
    
    canvas_w, canvas_h = 900, 480
    resized = cv2.resize(img_np, (canvas_w, canvas_h))

    gray = cv2.cvtColor(resized, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY_INV, 15, 4
    )

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (4, 4))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    detected_rooms = []
    counter = 1

    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if w > 35 and h > 35 and (w * h) > 1600 and (w < canvas_w - 20 or h < canvas_h - 20):
            detected_rooms.append({
                "number": f"ROOM-{counter}",
                "name": f"Room {counter}",
                "type": "Classroom",
                "description": "Auto-detected boundary",
                "x": int(x),
                "y": int(y),
                "w": int(w),
                "h": int(h)
            })
            counter += 1

    detected_rooms.sort(key=lambda r: (r["y"] // 50, r["x"]))
    return {"status": "success", "count": len(detected_rooms), "rooms": detected_rooms}