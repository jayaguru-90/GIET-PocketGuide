import math
import json
import os
import heapq
from typing import Dict, List, Tuple, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="GIET Campus Guide API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEOJSON_PATH = os.path.join(os.path.dirname(__file__), "..", "frontend", "assets", "data", "giet_campus.geojson")
if not os.path.exists(GEOJSON_PATH):
    GEOJSON_PATH = os.path.join(os.path.dirname(__file__), "assets", "data", "giet_campus.geojson")

def load_geojson():
    with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def save_geojson(data):
    with open(GEOJSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def haversine_distance(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    R = 6371000  # meters
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

    # 1. Strictly record explicit vertices drawn along walkways
    for feat in features:
        geom = feat.get("geometry", {})
        if geom.get("type") == "LineString":
            coords = geom.get("coordinates", [])
            for i in range(len(coords) - 1):
                u = (coords[i][1], coords[i][0])
                v = (coords[i+1][1], coords[i+1][0])
                add_edge(to_key(u[0], u[1]), to_key(v[0], v[1]), u, v)

    # 2. Bridge small gaps (up to 12 meters) between adjacent pathway endpoints
    for i in range(len(nodes_list)):
        p1 = parse_key(nodes_list[i])
        for j in range(i + 1, len(nodes_list)):
            p2 = parse_key(nodes_list[j])
            dist = haversine_distance(p1, p2)
            if dist <= 12.0:
                add_edge(nodes_list[i], nodes_list[j], p1, p2)

    return graph, nodes_list

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

@app.post("/api/admin/import-geojson")
def import_geojson(data: dict):
    if data.get("type") != "FeatureCollection" or "features" not in data:
        raise HTTPException(status_code=400, detail="Invalid FeatureCollection GeoJSON")
    save_geojson(data)
    return {"status": "success", "count": len(data["features"])}

@app.delete("/api/admin/feature/{index}")
def delete_feature(index: int):
    geojson = load_geojson()
    if 0 <= index < len(geojson["features"]):
        deleted = geojson["features"].pop(index)
        save_geojson(geojson)
        return {"status": "success", "deleted": deleted.get("properties", {}).get("name")}
    raise HTTPException(status_code=404, detail="Feature not found")

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
    for wp in cleaned_waypoints:
        wp_lower = wp.lower()
        if wp_lower not in buildings:
            raise HTTPException(status_code=400, detail=f"Location '{wp}' not found")
        resolved_coords.append(buildings[wp_lower])

    graph, nodes_list = build_routing_graph(geojson.get("features", []))

    # Connect building pins to the closest actual walkway node
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

    def dijkstra(start_node: str, target_node: str, penalties: dict):
        distances = {start_node: 0.0}
        previous = {}
        unvisited = [(0.0, start_node)]

        while unvisited:
            cur_dist, u = heapq.heappop(unvisited)
            if u == target_node:
                break
            if cur_dist > distances.get(u, float("inf")):
                continue

            for edge in graph.get(u, []):
                v = edge["node"]
                pen_multiplier = penalties.get((u, v), 1.0)
                alt = cur_dist + (edge["weight"] * pen_multiplier)
                if alt < distances.get(v, float("inf")):
                    distances[v] = alt
                    previous[v] = u
                    heapq.heappush(unvisited, (alt, v))

        if target_node not in distances:
            return None, float("inf")

        path = []
        curr = target_node
        while curr in previous:
            path.append(parse_key(curr))
            curr = previous[curr]
        path.append(parse_key(start_node))
        path.reverse()
        return path, distances[target_node]

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

            leg_coords, leg_dist = dijkstra(n1, n2, penalties)
            if not leg_coords:
                failed = True
                break

            total_dist += leg_dist

            # Path follows mapped walkway nodes between origins and destinations
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

            for i in range(len(full_coords) - 1):
                u_k = to_key(full_coords[i][0], full_coords[i][1])
                v_k = to_key(full_coords[i+1][0], full_coords[i+1][1])
                penalties[(u_k, v_k)] = penalties.get((u_k, v_k), 1.0) * 2.5
                penalties[(v_k, u_k)] = penalties.get((v_k, u_k), 1.0) * 2.5

    if not routes:
        raise HTTPException(status_code=404, detail="No route connected between selected points")

    routes.sort(key=lambda r: r["totalDistance"])
    labels = [
        "Shortest Route (Via Walkway)" if not is_multi else "Shortest Multi-Stop Route",
        "Alternative 1 (Via Campus Road)",
        "Alternative 2 (Via Outer Walkway)"
    ]

    for idx, r in enumerate(routes):
        r["name"] = labels[idx] if idx < len(labels) else f"Route Option {idx + 1}"

    return {"routes": routes}