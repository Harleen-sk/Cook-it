from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from . import models, schemas, database

SessionLocal = database.SessionLocal
engine = database.engine
# Creates the tables in the SQLite file if they do not exist
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

# ROUTE 1 : Récupérer tous les ingrédients
@app.get("/ingredients", response_model=list[schemas.Ingredient])
def get_ingredients(db: Session = Depends(get_db)):
    return db.query(models.Ingredient).all()

# ROUTE 2 : Ajouter un nouvel ingrédient
@app.post("/ingredients", response_model=schemas.Ingredient)
def create_ingredient(ingredient: schemas.IngredientCreate, db: Session = Depends(get_db)):
    # On vérifie si l'ingrédient existe déjà
    db_ingredient = db.query(models.Ingredient).filter(models.Ingredient.name == ingredient.name).first()
    if db_ingredient:
        raise HTTPException(status_code=400, detail="Ingredient already exists")
    
    # Création de l'objet pour la base de données
    new_ingredient = models.Ingredient(**ingredient.dict())
    db.add(new_ingredient)
    db.commit()
    db.refresh(new_ingredient)
    return new_ingredient

# Route pour supprimer un ingrédient par son ID
@app.delete("/ingredients/{ingredient_id}")
def delete_ingredient(ingredient_id: int, db: Session = Depends(get_db)):
    db_ingredient = db.query(models.Ingredient).filter(models.Ingredient.id == ingredient_id).first()
    if not db_ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    
    db.delete(db_ingredient)
    db.commit()
    return {"message": "Ingredient deleted successfully"}