import sqlite3
import json
import math
import os

DB_NAME = "campus.db"
GEOJSON_PATH = os.path.join("..", "frontend", "assets", "data", "giet_campus.geojson")

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def to_key(lat, lng):
    return f"{lat:.6f},{lng:.6f}"

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Buildings & POIs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS buildings (
            name TEXT PRIMARY KEY,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            category TEXT DEFAULT 'general'
        )
    """)

    # 2. Walkway segments / edges table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS edges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            target TEXT NOT NULL,
            distance REAL NOT NULL,
            weight REAL NOT NULL,
            highway_type TEXT DEFAULT 'primary',
            active INTEGER DEFAULT 1
        )
    """)

    # Check if database already has data
    cursor.execute("SELECT COUNT(*) FROM buildings")
    if cursor.fetchone()[0] == 0 and os.path.exists(GEOJSON_PATH):
        print("Seeding database from GeoJSON...")
        with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)

        edge_list = []
        all_nodes = set()
        node_coords = {}

        for feature in data.get("features", []):
            geom = feature.get("geometry", {})
            props = feature.get("properties", {})
            gtype = geom.get("type")

            # Ingest Buildings (Points)
            if gtype == "Point" and "name" in props:
                lng, lat = geom["coordinates"][:2]
                cursor.execute(
                    "INSERT OR REPLACE INTO buildings (name, lat, lng, category) VALUES (?, ?, ?, ?)",
                    (props["name"].strip(), lat, lng, props.get("category", "general"))
                )

            # Ingest Walkways (LineStrings)
            elif gtype == "LineString":
                coords = geom.get("coordinates", [])
                highway = props.get("highway", "primary")
                weight_cost = float(props.get("weight_cost", 4.5 if highway == "footway" else 1.0))

                for i in range(len(coords) - 1):
                    u_lng, u_lat = coords[i][:2]
                    v_lng, v_lat = coords[i + 1][:2]
                    u_key, v_key = to_key(u_lat, u_lng), to_key(v_lat, v_lng)

                    dist = haversine(u_lat, u_lng, v_lat, v_lng)
                    calculated_weight = dist * weight_cost

                    edge_list.append((u_key, v_key, dist, calculated_weight, highway, 1))

                    all_nodes.add(u_key)
                    all_nodes.add(v_key)
                    node_coords[u_key] = (u_lat, u_lng)
                    node_coords[v_key] = (v_lat, v_lng)

        # Auto-bridge tight physical gaps (<= 6m threshold)
        node_list = list(all_nodes)
        for i in range(len(node_list)):
            k1 = node_list[i]
            lat1, lng1 = node_coords[k1]
            for j in range(i + 1, len(node_list)):
                k2 = node_list[j]
                lat2, lng2 = node_coords[k2]
                d = haversine(lat1, lng1, lat2, lng2)
                if d <= 6.0:
                    edge_list.append((k1, k2, d, d, "junction_bridge", 1))

        cursor.executemany(
            """INSERT INTO edges (source, target, distance, weight, highway_type, active) 
               VALUES (?, ?, ?, ?, ?, ?)""",
            edge_list
        )

    conn.commit()
    conn.close()
    print("Database initialization complete.")

if __name__ == "__main__":
    init_db()