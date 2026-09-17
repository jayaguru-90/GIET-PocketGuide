import heapq
import math
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import get_db_connection, init_db, haversine

app = FastAPI(title="GIET Campus Navigation API")

# Enable CORS for frontend integration
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

# --- Request / Response Models ---
class MultiRouteRequest(BaseModel):
    stops: List[str]  # e.g., ["Main Gate", "CSA block", "Library"]

class EdgeStatusUpdate(BaseModel):
    source: str
    target: str
    active: bool

# --- Graph Helpers ---
def load_active_graph():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT source, target, distance, weight FROM edges WHERE active = 1")
    rows = cursor.fetchall()
    conn.close()

    graph = {}
    nodes = set()
    for row in rows:
        u, v, dist, weight = row["source"], row["target"], row["distance"], row["weight"]
        if u not in graph: graph[u] = []
        if v not in graph: graph[v] = []
        graph[u].append({"node": v, "dist": dist, "weight": weight})
        graph[v].append({"node": u, "dist": dist, "weight": weight})
        nodes.add(u)
        nodes.add(v)
    return graph, nodes

def find_closest_node(lat, lng, all_nodes):
    closest = None
    min_d = float("inf")
    for n in all_nodes:
        n_lat, n_lng = map(float, n.split(","))
        d = haversine(lat, lng, n_lat, n_lng)
        if d < min_d:
            min_d = d
            closest = n
    return closest, min_d

def dijkstra_leg(start_key, end_key, graph, penalized_edges=None, penalty_multiplier=2.5):
    if penalized_edges is None:
        penalized_edges = set()

    pq = [(0, start_key, [], 0)]  # (weighted_cost, current_node, path, actual_meters)
    visited = set()

    while pq:
        cost, current, path, actual_dist = heapq.heappop(pq)

        if current in visited:
            continue
        visited.add(current)
        path = path + [current]

        if current == end_key:
            return path, actual_dist

        for edge in graph.get(current, []):
            nxt = edge["node"]
            if nxt not in visited:
                is_penalized = (current, nxt) in penalized_edges or (nxt, current) in penalized_edges
                edge_cost = edge["weight"] * (penalty_multiplier if is_penalized else 1.0)
                heapq.heappush(pq, (cost + edge_cost, nxt, path, actual_dist + edge["dist"]))

    return None, 0

# --- API Endpoints ---

@app.get("/api/buildings")
def get_buildings():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name, lat, lng, category FROM buildings ORDER BY name ASC")
    buildings = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"buildings": buildings}

@app.post("/api/route")
def compute_route(req: MultiRouteRequest):
    if len(req.stops) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 points.")

    conn = get_db_connection()
    cursor = conn.cursor()
    bldg_coords = {}
    for name in req.stops:
        cursor.execute("SELECT lat, lng FROM buildings WHERE name = ?", (name.strip(),))
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Location '{name}' not found.")
        bldg_coords[name] = [row["lat"], row["lng"]]
    conn.close()

    graph, all_nodes = load_active_graph()

    # 1. Compute Primary (Fastest / Main Road) Route
    primary_coords = []
    primary_dist = 0
    primary_used_edges = set()

    for i in range(len(req.stops) - 1):
        s_name, e_name = req.stops[i], req.stops[i + 1]
        s_coord, e_coord = bldg_coords[s_name], bldg_coords[e_name]

        s_node, s_dist = find_closest_node(s_coord[0], s_coord[1], all_nodes)
        e_node, e_dist = find_closest_node(e_coord[0], e_coord[1], all_nodes)

        leg_path, leg_dist = dijkstra_leg(s_node, e_node, graph)
        if not leg_path:
            raise HTTPException(status_code=400, detail=f"No path found between {s_name} and {e_name}.")

        for k in range(len(leg_path) - 1):
            primary_used_edges.add((leg_path[k], leg_path[k + 1]))

        # Format coordinates
        segment_coords = [s_coord] + [list(map(float, k.split(","))) for k in leg_path] + [e_coord]
        if primary_coords:
            primary_coords.extend(segment_coords[1:])
        else:
            primary_coords.extend(segment_coords)

        primary_dist += (leg_dist + s_dist + e_dist)

    routes = [{
        "name": "Fastest Route (Main Road)" if len(req.stops) == 2 else "Multi-Stop (Fastest)",
        "total_distance": round(primary_dist),
        "eta_minutes": math.ceil(primary_dist / 75),
        "coordinates": primary_coords
    }]

    # 2. Compute Alternative Route (Penalizing primary edges)
    alt_coords = []
    alt_dist = 0
    possible_alt = True

    for i in range(len(req.stops) - 1):
        s_name, e_name = req.stops[i], req.stops[i + 1]
        s_coord, e_coord = bldg_coords[s_name], bldg_coords[e_name]

        s_node, s_dist = find_closest_node(s_coord[0], s_coord[1], all_nodes)
        e_node, e_dist = find_closest_node(e_coord[0], e_coord[1], all_nodes)

        leg_path, leg_dist = dijkstra_leg(s_node, e_node, graph, penalized_edges=primary_used_edges)
        if not leg_path:
            possible_alt = False
            break

        segment_coords = [s_coord] + [list(map(float, k.split(","))) for k in leg_path] + [e_coord]
        if alt_coords:
            alt_coords.extend(segment_coords[1:])
        else:
            alt_coords.extend(segment_coords)

        alt_dist += (leg_dist + s_dist + e_dist)

    if possible_alt and abs(alt_dist - primary_dist) >= 8 and alt_dist <= primary_dist * 1.30:
        routes.append({
            "name": "Alternative Route" if len(req.stops) == 2 else "Multi-Stop (Alternative)",
            "total_distance": round(alt_dist),
            "eta_minutes": math.ceil(alt_dist / 75),
            "coordinates": alt_coords
        })

    return {"routes": routes}

@app.patch("/api/admin/edges/status")
def toggle_edge_status(update: EdgeStatusUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE edges 
        SET active = ? 
        WHERE (source = ? AND target = ?) OR (source = ? AND target = ?)
    """, (1 if update.active else 0, update.source, update.target, update.target, update.source))
    conn.commit()
    conn.close()
    return {"message": "Walkway status updated successfully."}