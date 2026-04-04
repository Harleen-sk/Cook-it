from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from . import models, schemas, database

SessionLocal = database.SessionLocal
engine = database.engine
# Creates the tables in the SQLite file if they do not exist
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Veggie Planner API")

STAPLES_LIST = ["salt", "pepper", "olive oil", "sugar", "flour", "vinegar", "garlic powder"]

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
    
    name_lower = ingredient.name.lower()

    is_staple_auto = ingredient.name.lower() in STAPLES_LIST
    
    # Création de l'objet pour la base de données
    new_ingredient = models.Ingredient(
        name=ingredient.name.lower(),
        quantity=ingredient.quantity,
        unit=ingredient.unit if ingredient.unit else "pcs",
        is_staple=is_staple_auto  # Le système décide ici
    )
    
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

@app.get("/equipments", response_model=list[schemas.Equipment])
def get_equipments(db: Session = Depends(get_db)):
    return db.query(models.Equipment).all()

@app.post("/equipments", response_model=schemas.Equipment)
def create_equipment(equipment: schemas.EquipmentCreate, db: Session = Depends(get_db)):
    db_eq = models.Equipment(name=equipment.name.lower(), is_active=True)
    db.add(db_eq)
    db.commit()
    db.refresh(db_eq)
    return db_eq

@app.patch("/equipments/{eq_id}") # Pour basculer l'état On/Off
def toggle_equipment(eq_id: int, db: Session = Depends(get_db)):
    db_eq = db.query(models.Equipment).filter(models.Equipment.id == eq_id).first()
    db_eq.is_active = not db_eq.is_active
    db.commit()
    return db_eq

@app.get("/generate-ideas")
def get_cooking_context(db: Session = Depends(get_db)):
    # On récupère tout ce qui est disponible
    ingredients = db.query(models.Ingredient).all()
    equipment = db.query(models.Equipment).filter(models.Equipment.is_active == True).all()
    
    # On prépare un dictionnaire "contexte" pour l'IA
    context = {
        "pantry": [ing.name for ing in ingredients],
        "kitchen_tools": [eq.name for eq in equipment]
    }
    
    # Pour l'instant, on simule une réponse de l'IA
    # Plus tard, on connectera ici l'API OpenAI ou Gemini
    suggestions = [
        {
            "id": 1,
            "title": "Poêlée printanière",
            "description": "Utilise vos légumes frais avec votre poêle active.",
            "score": "90% match"
        },
        {
            "id": 2,
            "title": "Soupe réconfortante",
            "description": "Parfait si vous avez un mixeur et des oignons.",
            "score": "75% match"
        }
      ]
    return {"context": context, "suggestions": suggestions}