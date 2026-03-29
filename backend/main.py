from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
import models
from database import SessionLocal, engine

# Crée les tables dans le fichier SQLite si elles n'existent pas
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Veggie Planner API")

# Fonction pour obtenir une connexion à la base de données
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Welcome to Veggie Planner API 🥕"}

@app.get("/ingredients")
def get_ingredients(db: Session = Depends(get_db)):
    # Récupère tous les ingrédients en base de données
    return db.query(models.Ingredient).all()