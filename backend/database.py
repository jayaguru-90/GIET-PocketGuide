from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./campus_guide.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

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

def init_db():
    Base.metadata.create_all(bind=engine)