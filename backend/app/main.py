from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from . import models, schemas, database
import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv
from typing import List

load_dotenv()

SessionLocal = database.SessionLocal
engine = database.engine
# Creates the tables in the SQLite file if they do not exist
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Veggie Planner API")

STAPLES_LIST = ["salt", "pepper", "olive oil", "sugar", "flour", "vinegar", "garlic powder"]

load_dotenv()

# Configuration de Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") # Vérifie que c'est le bon nom dans ton .env
if not GEMINI_API_KEY:
    print("La clé API n'est pas chargée ! Vérifie ton fichier .env")
else:
    # Affiche les 4 premiers caractères pour vérifier que c'est la bonne clé
    print(f"Clé API détectée (début) : {GEMINI_API_KEY[:4]}...")
client = genai.Client(api_key=GEMINI_API_KEY)
MODEL_NAME = "gemini-2.5-flash"


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
def generate_recipes(db: Session = Depends(get_db)):
    # 1. Récupération des données locales
    ingredients = db.query(models.Ingredient).all()
    equipment = db.query(models.Equipment).filter(models.Equipment.is_active == True).all()
    
    if not ingredients:
        return {"suggestions": []}

    # 2. Préparation du contexte pour l'IA
    ing_text = ", ".join([f"{i.quantity} {i.unit} de {i.name}" for i in ingredients])
    eq_text = ", ".join([e.name for e in equipment])

    # 3. Construction du Prompt
    prompt = f"""Tu es un chef cuisinier expert. 
    Propose 3 idées de recettes en utilisant ces ingrédients : {ing_text}.
    Matériel disponible : {eq_text}.
    
    Réponds EXCLUSIVEMENT sous forme d'un tableau JSON valide.
    Structure du JSON :
    [
      {{"id": 1, "title": "Nom de la recette", "description": "Brève explication", "score": "95% Match"}},
      ...
    ]
    Ne rajoute aucune explication avant ou après le JSON."""

    try:
        # 4. Appel à l'IA avec la nouvelle syntaxe
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                # On force le format de sortie en JSON pour éviter les erreurs de parsing
                response_mime_type="application/json" 
            )
        )

        # 5. Parsing de la réponse
        # La nouvelle bibliothèque renvoie le texte directement dans response.text
        recipe_data = json.loads(response.text)
        return {"suggestions": recipe_data}

    except Exception as e:
        print(f"ERREUR GEMINI : {str(e)}")
        # Fallback pour ne pas bloquer l'interface mobile
        return {"suggestions": [
            {
                "id": 0, 
                "title": "Chef en pause", 
                "description": "L'IA n'a pas pu répondre. Vérifie ta clé API.", 
                "score": "0%"
            }
        ]}
    
@app.get("/recipe-details")
def get_recipe_details(title: str, db: Session = Depends(get_db)):
    # On récupère les ingrédients pour donner du contexte à l'IA
    ingredients = db.query(models.Ingredient).all()
    ing_list = ", ".join([i.name for i in ingredients])

    prompt = f"""
    Rédige la recette détaillée pour : "{title}".
    Utilise prioritairement ces ingrédients : {ing_list}.
    
    Réponds au format JSON avec cette structure :
    {{
      "title": "{title}",
      "ingredients": ["item 1", "item 2"],
      "instructions": ["étape 1", "étape 2"],
      "prep_time": "15 min plus au moins",
      "difficulty": "Facile"
    }}
    """

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Erreur détaillée Gemini: {e}")
        raise HTTPException(status_code=500, detail="L'IA a eu un petit coup de chaud en cuisine et n'a pas pu générer le détail de votre recette")
    
# Route pour sauvegarder une recette
@app.post("/favorites", response_model=schemas.FavoriteRecipe)
def save_favorite(recipe: schemas.FavoriteRecipeCreate, db: Session = Depends(get_db)):
    new_fav = models.FavoriteRecipe(
        title=recipe.title,
        details=recipe.details
    )
    db.add(new_fav)
    db.commit()
    db.refresh(new_fav)
    return new_fav

# Route pour lister les favoris
@app.get("/favorites", response_model=List[schemas.FavoriteRecipe])
def get_favorites(db: Session = Depends(get_db)):
    return db.query(models.FavoriteRecipe).all()

@app.delete("/favorites/{fav_id}")
def delete_favorite(fav_id: int, db: Session = Depends(get_db)):
    db_fav = db.query(models.FavoriteRecipe).filter(models.FavoriteRecipe.id == fav_id).first()
    if not db_fav:
        raise HTTPException(status_code=404, detail="Recette non trouvée")
    
    db.delete(db_fav)
    db.commit()
    return {"message": "Favori supprimé"}