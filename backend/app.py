import os
import json
import math
import heapq
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="GIETU Campus Routing & Spatial Admin Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEOJSON_PATH = os.path.join(os.path.dirname(__file__), "..", "frontend", "assets", "data", "giet_campus.geojson")

def get_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000  # meters
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2) ** 2)
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def to_key(lat: float, lng: float) -> str:
    return f"{lat:.6f},{lng:.6f}"

def parse_key(key: str) -> List[float]:
    parts = key.split(",")
    return [float(parts[0]), float(parts[1])]

def project_point_on_segment(p, a, b):
    x, y = p[1], p[0]
    x1, y1 = a[1], a[0]
    x2, y2 = b[1], b[0]
    dx, dy = x2 - x1, y2 - y1
    len_sq = dx * dx + dy * dy
    if len_sq == 0:
        return a
    t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / len_sq))
    return [y1 + t * dy, x1 + t * dx]

def load_graph():
    if not os.path.exists(GEOJSON_PATH):
        raise HTTPException(status_code=404, detail="Campus GeoJSON file not found on server")

    with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    graph = {}
    nodes = []
    node_set = set()
    buildings = {}
    segments = []

    def reg_node(k):
        if k not in node_set:
            node_set.add(k)
            nodes.append(k)

    def add_edge(u_key, v_key, u_coord, v_coord):
        if u_key == v_key:
            return
        d = get_distance(u_coord[0], u_coord[1], v_coord[0], v_coord[1])
        reg_node(u_key)
        reg_node(v_key)
        if u_key not in graph:
            graph[u_key] = []
        if v_key not in graph:
            graph[v_key] = []
        if not any(e["node"] == v_key for e in graph[u_key]):
            graph[u_key].append({"node": v_key, "weight": d, "coord": v_coord})
        if not any(e["node"] == u_key for e in graph[v_key]):
            graph[v_key].append({"node": u_key, "weight": d, "coord": u_coord})

    for feat in data.get("features", []):
        geom = feat.get("geometry", {})
        props = feat.get("properties", {}) or {}
        gtype = geom.get("type")

        if gtype == "LineString":
            coords = geom.get("coordinates", [])
            for i in range(len(coords) - 1):
                u = [coords[i][1], coords[i][0]]
                v = [coords[i + 1][1], coords[i + 1][0]]
                add_edge(to_key(u[0], u[1]), to_key(v[0], v[1]), u, v)
                segments.append({"u": u, "v": v})

        elif gtype == "Point":
            name = (props.get("name") or "").strip()
            if name:
                c = geom.get("coordinates", [])
                buildings[name] = [c[1], c[0]]

    # Auto-stitch nearby junctions within 8 meters
    for i in range(len(nodes)):
        p1 = parse_key(nodes[i])
        for j in range(i + 1, len(nodes)):
            p2 = parse_key(nodes[j])
            if get_distance(p1[0], p1[1], p2[0], p2[1]) <= 8.0:
                add_edge(nodes[i], nodes[j], p1, p2)

    return graph, nodes, buildings, segments, data

def find_nearest_node(target_lat: float, target_lng: float, graph, nodes, segments) -> str:
    best_key = None
    min_d = float("inf")

    for key in nodes:
        lat, lng = parse_key(key)
        d = get_distance(target_lat, target_lng, lat, lng)
        if d < min_d:
            min_d = d
            best_key = key

    for seg in segments:
        proj = project_point_on_segment([target_lat, target_lng], seg["u"], seg["v"])
        d = get_distance(target_lat, target_lng, proj[0], proj[1])
        if d < min_d:
            min_d = d
            best_key = to_key(proj[0], proj[1])
            u_key = to_key(seg["u"][0], seg["u"][1])
            v_key = to_key(seg["v"][0], seg["v"][1])
            if best_key not in graph:
                graph[best_key] = []
            graph[best_key].append({"node": u_key, "weight": get_distance(proj[0], proj[1], seg["u"][0], seg["u"][1]), "coord": seg["u"]})
            graph[best_key].append({"node": v_key, "weight": get_distance(proj[0], proj[1], seg["v"][0], seg["v"][1]), "coord": seg["v"]})

    return best_key

def dijkstra_search(start_key: str, end_key: str, graph, penalized: Dict[tuple, float] = None):
    if penalized is None:
        penalized = {}
    queue = [(0.0, start_key, [])]
    visited = set()
    best_cost = {start_key: 0.0}

    while queue:
        cost, current, path = heapq.heappop(queue)
        if current in visited:
            continue
        visited.add(current)
        curr_path = path + [current]

        if current == end_key:
            return curr_path, cost

        for edge in graph.get(current, []):
            nxt = edge["node"]
            if nxt in visited:
                continue

            multiplier = penalized.get((current, nxt), penalized.get((nxt, current), 1.0))
            next_cost = cost + (edge["weight"] * multiplier)

            if next_cost < best_cost.get(nxt, float("inf")):
                best_cost[nxt] = next_cost
                heapq.heappush(queue, (next_cost, nxt, curr_path))

    return None, float("inf")

def compute_chained_route(waypoints_coords: List[List[float]], graph, nodes, segments, penalized: Dict[tuple, float]):
    full_path_coords = []
    all_node_path = []

    for i in range(len(waypoints_coords) - 1):
        pt_start = waypoints_coords[i]
        pt_end = waypoints_coords[i + 1]

        start_node = find_nearest_node(pt_start[0], pt_start[1], graph, nodes, segments)
        end_node = find_nearest_node(pt_end[0], pt_end[1], graph, nodes, segments)

        if not start_node or not end_node:
            return None, None

        leg_node_path, _ = dijkstra_search(start_node, end_node, graph, penalized)
        if not leg_node_path:
            return None, None

        leg_coords = [pt_start] + [parse_key(k) for k in leg_node_path] + [pt_end]

        if full_path_coords:
            full_path_coords.extend(leg_coords[1:])
            all_node_path.extend(leg_node_path[1:])
        else:
            full_path_coords.extend(leg_coords)
            all_node_path.extend(leg_node_path)

    return full_path_coords, all_node_path

# ================= SCHEMAS =================
class LocationPayload(BaseModel):
    id: Optional[int] = None
    name: str
    category: str
    latitude: float
    longitude: float

class RoutePayload(BaseModel):
    id: Optional[int] = None
    name: str
    coordinates: List[List[float]]  # [[lng, lat], ...]

class RouteComputeRequest(BaseModel):
    waypoints: List[str]

# ================= PUBLIC ROUTING APIS =================
@app.get("/api/campus-data")
def get_campus_data():
    _, _, buildings, _, raw_json = load_graph()
    return {
        "geojson": raw_json,
        "buildings": buildings,
        "placeNames": sorted(list(buildings.keys()))
    }

@app.post("/api/routes")
def compute_routes(req: RouteComputeRequest):
    if len(req.waypoints) < 2:
        raise HTTPException(status_code=400, detail="Provide at least a Start and Destination")

    graph, nodes, buildings, segments, _ = load_graph()

    waypoints_coords = []
    for name in req.waypoints:
        if name not in buildings:
            raise HTTPException(status_code=404, detail=f"Location '{name}' not found")
        waypoints_coords.append(buildings[name])

    routes = []
    penalized: Dict[tuple, float] = {}
    is_multi_stop = len(req.waypoints) > 2

    for _ in range(6):
        full_coords, node_path = compute_chained_route(waypoints_coords, graph, nodes, segments, penalized)
        if not full_coords:
            break

        dist = sum(
            get_distance(full_coords[i][0], full_coords[i][1], full_coords[i+1][0], full_coords[i+1][1])
            for i in range(len(full_coords) - 1)
        )

        is_distinct = True
        for r in routes:
            if abs(r["totalDistance"] - dist) < 10:
                is_distinct = False
                break

        if is_distinct:
            routes.append({
                "path": full_coords,
                "totalDistance": round(dist)
            })
            if len(routes) >= (2 if is_multi_stop else 3):
                break

        if node_path and len(node_path) > 3:
            mid_start = max(1, int(len(node_path) * 0.2))
            mid_end = min(len(node_path) - 1, int(len(node_path) * 0.8))
            for i in range(mid_start, mid_end):
                penalized[(node_path[i], node_path[i + 1])] = penalized.get((node_path[i], node_path[i + 1]), 1.0) * 2.2

    if not routes:
        raise HTTPException(status_code=404, detail="No continuous path found across all destinations")

    routes.sort(key=lambda r: r["totalDistance"])

    labeled = []
    for idx, r in enumerate(routes):
        if is_multi_stop:
            title = f"Multi-Stop Route {idx + 1}" if idx > 0 else "Shortest Multi-Stop Route"
        else:
            names = [
                "Shortest Route (Via Walkway / Shortcut)",
                "Alternative 1 (Via Swimming Pool Road)",
                "Alternative 2 (Via Garden & Main Road)"
            ]
            title = names[idx] if idx < len(names) else f"Alternative {idx}"

        labeled.append({
            "name": title,
            "path": r["path"],
            "totalDistance": r["totalDistance"]
        })

    return {"routes": labeled}

# ================= ADMIN SPATIAL CRUD APIS =================

@app.get("/api/admin/features")
def get_admin_features():
    """Returns the full live GeoJSON directly from disk."""
    with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data

@app.post("/api/admin/save-point")
def save_point(payload: LocationPayload):
    """Adds a new point or edits an existing point in giet_campus.geojson."""
    with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    if payload.id is not None and 0 <= payload.id < len(data["features"]):
        # Update existing point
        feat = data["features"][payload.id]
        feat["properties"]["name"] = payload.name.strip()
        feat["properties"]["category"] = payload.category.strip()
        feat["geometry"]["coordinates"] = [payload.longitude, payload.latitude, 0]
    else:
        # Prevent exact duplicate naming
        for feat in data["features"]:
            if feat.get("geometry", {}).get("type") == "Point":
                if feat.get("properties", {}).get("name", "").strip().lower() == payload.name.strip().lower():
                    raise HTTPException(status_code=400, detail="A location with this name already exists")

        new_feat = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [payload.longitude, payload.latitude, 0]
            },
            "properties": {
                "name": payload.name.strip(),
                "category": payload.category.strip()
            }
        }
        data["features"].append(new_feat)

    with open(GEOJSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return {"message": "Location saved successfully"}

@app.post("/api/admin/save-route")
def save_route(payload: RoutePayload):
    """Adds a new walkway or edits an existing LineString in giet_campus.geojson."""
    if len(payload.coordinates) < 2:
        raise HTTPException(status_code=400, detail="A walkway corridor requires at least 2 coordinate vertices")

    with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    geo_coords = [[c[0], c[1], 0] if len(c) == 2 else c for c in payload.coordinates]

    if payload.id is not None and 0 <= payload.id < len(data["features"]):
        # Update existing route
        feat = data["features"][payload.id]
        feat["properties"]["name"] = payload.name.strip()
        feat["geometry"]["coordinates"] = geo_coords
    else:
        new_feat = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": geo_coords
            },
            "properties": {
                "name": payload.name.strip()
            }
        }
        data["features"].append(new_feat)

    with open(GEOJSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return {"message": "Walkway route saved successfully"}

@app.delete("/api/admin/feature/{feature_index}")
def delete_feature(feature_index: int):
    """Deletes any point or route by its feature array index."""
    with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    if feature_index < 0 or feature_index >= len(data["features"]):
        raise HTTPException(status_code=404, detail="Feature index out of range")

    deleted = data["features"].pop(feature_index)

    with open(GEOJSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return {"message": f"Successfully deleted '{deleted.get('properties', {}).get('name', 'Feature')}'"}