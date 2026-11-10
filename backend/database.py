import os
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    ForeignKey,
    Text,
    func
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

# Ensure the database file resolves relative to the current file location
DB_PATH = os.path.join(os.path.dirname(__file__), "campus_guide.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- Outdoor Map Models ---
class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    category = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)

class Walkway(Base):
    __tablename__ = "walkways"

    id = Column(Integer, primary_key=True, index=True)
    start_id = Column(Integer, ForeignKey("locations.id"))
    end_id = Column(Integer, ForeignKey("locations.id"))
    distance = Column(Float)

# --- Building Layout Models ---
class Floor(Base):
    __tablename__ = "floors"

    id = Column(Integer, primary_key=True, index=True)
    building_name = Column(String, index=True, nullable=False)
    floor_number = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    department = Column(String, nullable=True)
    
    rooms = relationship(
        "Room",
        back_populates="floor",
        cascade="all, delete-orphan"
    )

class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    floor_id = Column(Integer, ForeignKey("floors.id"), nullable=False)
    number = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    
    # 2D Coordinates matching the 900x480 architectural canvas
    x = Column(Integer, nullable=False)
    y = Column(Integer, nullable=False)
    w = Column(Integer, nullable=False)
    h = Column(Integer, nullable=False)

    floor = relationship("Floor", back_populates="rooms")

def init_db():
    Base.metadata.create_all(bind=engine)
    seed_csa_third_floor()

def seed_csa_third_floor():
    db = SessionLocal()
    try:
        # Case-insensitive query to prevent duplicate CSA block rows
        existing = db.query(Floor).filter(
            func.lower(Floor.building_name) == "csa block",
            Floor.floor_number == 3
        ).first()

        if not existing:
            csa_f3 = Floor(
                building_name="CSA Block",
                floor_number=3,
                name="Third Floor",
                department="DEPARTMENT OF COMPUTER SCIENCE AND APPLICATIONS (CSA)"
            )
            db.add(csa_f3)
            db.commit()
            db.refresh(csa_f3)

            rooms_data = [
                {"number": "CSA-4", "name": "CSA 4", "type": "Classroom", "description": "CSA 4 classroom", "x": 105, "y": 40, "w": 65, "h": 125},
                {"number": "CSA-3", "name": "CSA 3", "type": "Classroom", "description": "CSA 3 classroom", "x": 178, "y": 40, "w": 65, "h": 125},
                {"number": "FC-2", "name": "FC-2 EXAM SEC", "type": "Office", "description": "Examination Section", "x": 250, "y": 40, "w": 120, "h": 60},
                {"number": "OFFICE", "name": "Office", "type": "Office", "description": "Department Office", "x": 250, "y": 108, "w": 58, "h": 57},
                {"number": "FC-1", "name": "FC-1", "type": "Office", "description": "Faculty Room 1", "x": 312, "y": 108, "w": 58, "h": 57},
                {"number": "FC-3", "name": "FC-3", "type": "Office", "description": "Faculty Room 3", "x": 380, "y": 40, "w": 55, "h": 55},
                {"number": "TOILET-STAFF", "name": "TOILET STAFF", "type": "Washroom", "description": "Staff Toilet", "x": 443, "y": 40, "w": 60, "h": 40},
                {"number": "FC-4", "name": "FC-4", "type": "Office", "description": "Faculty Room 4", "x": 443, "y": 86, "w": 60, "h": 38},
                {"number": "FC-5", "name": "FC-5", "type": "Office", "description": "Faculty Room 5", "x": 443, "y": 130, "w": 60, "h": 35},
                {"number": "CSA-2", "name": "CSA 2", "type": "Classroom", "description": "CSA 2 classroom", "x": 512, "y": 40, "w": 60, "h": 125},
                {"number": "CSA-1", "name": "CSA 1", "type": "Classroom", "description": "CSA 1 classroom", "x": 578, "y": 40, "w": 60, "h": 125},
                {"number": "BEE-LAB", "name": "BEE LAB", "type": "Laboratory", "description": "Basic Electrical Engineering Lab", "x": 105, "y": 285, "w": 125, "h": 125},
                {"number": "BE-LAB", "name": "BE LAB", "type": "Laboratory", "description": "Basic Electronics Lab", "x": 242, "y": 285, "w": 125, "h": 125},
                {"number": "MPMC-LAB", "name": "MPMC LAB", "type": "Laboratory", "description": "Microprocessor & Microcontroller Lab", "x": 379, "y": 285, "w": 125, "h": 125},
                {"number": "CSA-AUD", "name": "CSA AUDITORIUM", "type": "Auditorium", "description": "CSA Department Auditorium", "x": 516, "y": 285, "w": 140, "h": 125},
                {"number": "WATER-FILTER", "name": "WATER FILTER", "type": "Utility", "description": "Drinking Water Station", "x": 668, "y": 40, "w": 70, "h": 150},
                {"number": "WC-M", "name": "STUDENT TOILET (M)", "type": "Washroom", "description": "Boys Washroom", "x": 748, "y": 40, "w": 110, "h": 50},
                {"number": "WC-F", "name": "STUDENT TOILET (F)", "type": "Washroom", "description": "Girls Washroom", "x": 748, "y": 270, "w": 110, "h": 55},
                {"number": "HOD", "name": "HoD CHAMBER", "type": "Office", "description": "Head of Department Room", "x": 668, "y": 355, "w": 105, "h": 55}
            ]

            for r in rooms_data:
                room = Room(floor_id=csa_f3.id, **r)
                db.add(room)
            db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    init_db()