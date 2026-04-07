from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app import models, schemas, database
import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv
from typing import List

from pydantic import BaseModel

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

def determine_if_staple(ingredient_name: str) -> bool:
    name_clean = ingredient_name.lower().strip()
    
    # Liste des racines de mots qui indiquent un produit de base (Staple)
    STAPLE_KEYWORDS = [
        "huile", "oil", "sel", "salt", "poivre", "pepper", "sucre", "sugar",
        "farine", "flour", "riz", "rice", "pâte", "pasta", "épice", "spice",
        "curry", "paprika", "herbe", "sauce", "vinaigre", "vinegar", "sec",
        "conserve", "boîte", "miel", "honey", "sirop", "bouillon"
    ]
    
    # On vérifie si l'une des racines est présente dans le nom
    # Exemple : "Huile de tournesol" contient "huile" -> True
    for keyword in STAPLE_KEYWORDS:
        if keyword in name_clean:
            return True
            
    return False

# Utilisation dans ta route de création
@app.post("/ingredients")
def create_ingredient(ingredient: schemas.IngredientCreate, db: Session = Depends(get_db)):
    # Détermination automatique sans API
    auto_staple = determine_if_staple(ingredient.name)
    
    db_ingredient = models.Ingredient(
        name=ingredient.name,
        quantity=ingredient.quantity,
        unit=ingredient.unit or "pcs",
        is_staple=auto_staple
    )
    db.add(db_ingredient)
    db.commit()
    db.refresh(db_ingredient)
    return db_ingredient

# ROUTE 2 : Ajouter un nouvel ingrédient
# @app.post("/ingredients", response_model=schemas.Ingredient)
# def create_ingredient(ingredient: schemas.IngredientCreate, db: Session = Depends(get_db)):
#     # On vérifie si l'ingrédient existe déjà
#     db_ingredient = db.query(models.Ingredient).filter(models.Ingredient.name == ingredient.name).first()
#     if db_ingredient:
#         raise HTTPException(status_code=400, detail="Ingredient already exists")
    
#     name_lower = ingredient.name.lower()

#     is_staple_auto = ingredient.name.lower() in STAPLES_LIST
    
#     # Création de l'objet pour la base de données
#     new_ingredient = models.Ingredient(
#         name=ingredient.name.lower(),
#         quantity=ingredient.quantity,
#         unit=ingredient.unit if ingredient.unit else "pcs",
#         is_staple=is_staple_auto  # Le système décide ici
#     )
    
#     db.add(new_ingredient)
#     db.commit()
#     db.refresh(new_ingredient)
#     return new_ingredient

# @app.post("/ingredients")
# def create_ingredient(ingredient: schemas.IngredientCreate, db: Session = Depends(get_db)):
#     # On utilise l'IA pour déterminer le type
#     is_staple_decision = classify_ingredient_with_ai(ingredient.name)
    
#     db_ingredient = models.Ingredient(
#         name=ingredient.name,
#         quantity=ingredient.quantity,
#         is_staple=is_staple_decision # Résultat de l'IA
#     )
#     db.add(db_ingredient)
#     db.commit()
#     return db_ingredient

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

# Préparation du contexte pour l'IA
# @app.post("/generate-ideas")
# def generate_recipes(selection: SelectionRequest):    
#     # On récupère les listes envoyées
#     ings = ", ".join(selection.get("ingredients", []))
#     eqs = ", ".join(selection.get("equipment", []))
    
#     # if not ingredients:
#     #     return {"suggestions": []}

#     # Construction du Prompt
#     prompt = f"""Tu es un chef cuisinier expert. 
#     Propose 3 idées de recettes en utilisant ces ingrédients : {ings}.
#     Matériel disponible : {eqs}.
    
#     Réponds EXCLUSIVEMENT sous forme d'un tableau JSON valide.
#     Structure du JSON :
#     [
#       {{"id": 1, "title": "Nom de la recette", "description": "Brève explication", "score": "95% Match"}},
#       ...
#     ]
#     Ne rajoute aucune explication avant ou après le JSON."""

#     try:
#         # Appel à l'IA avec la nouvelle syntaxe
#         response = client.models.generate_content(
#             model=MODEL_NAME,
#             contents=prompt,
#             config=types.GenerateContentConfig(
#                 temperature=0.7,
#                 # On force le format de sortie en JSON pour éviter les erreurs de parsing
#                 response_mime_type="application/json" 
#             )
#         )

#         # Parsing de la réponse
#         # La nouvelle bibliothèque renvoie le texte directement dans response.text
#         recipe_data = json.loads(response.text)
#         return {"suggestions": recipe_data}

#     except Exception as e:
#         print(f"ERREUR GEMINI : {str(e)}")
#         # Fallback pour ne pas bloquer l'interface mobile
#         return {"suggestions": [
#             {
#                 "id": 0, 
#                 "title": "Chef en pause", 
#                 "description": "L'IA n'a pas pu répondre. Vérifie ta clé API.", 
#                 "score": "0%"
#             }
#         ]}

@app.post("/generate-ideas")
def generate_recipes(selection: schemas.SelectionRequest):    
    # CORRECT : On utilise la notation pointée car 'selection' est un objet
    # On accède directement aux attributs définis dans ta classe SelectionRequest
    ings_list = selection.ingredients
    eqs_list = selection.equipment
    m_type = selection.meal_type
    
    target_lang = "French" if selection.lang == "fr" else "English"

    # Transformation des listes en chaînes de caractères pour le prompt
    ings = ", ".join(ings_list)
    eqs = ", ".join(eqs_list)
    
    if not ings:
        return {"suggestions": []}

    prompt = f"""You are a professional Chef. 
    Provide 3 recipe ideas in {target_lang} using ONLY these ingredients: {ings}.
    Available equipment: {eqs}.
    Meal type: {m_type}.

    SPECIFIC RULES:
    1. Respond EXCLUSIVELY in JSON format.
    2. The field 'used_ingredients_list' MUST use the EXACT names from this list: {ings}.
    3. Réponds EXCLUSIVEMENT en JSON avec cette structure :
    {{
        "id": 1,
        "title": "Recipe Name",
        "description": "Short summary",
        "prep_time": "20 min",
        "ingredients": ["100g rice", "1tbsp oil"],
        "instructions": ["Step 1", "Step 2"],
        "used_ingredients_list": [
          {{"name": "rice", "amount": 100}},
          {{"name": "oil", "amount": 15}}
      ]
    }}
    IMPORTANT : All text fields (title, description) must be in {target_lang}
    The 'used_ingredients_list' field must contain the EXACT names of the ingredients in the pantry so that I can remove them.
    The unit for 'amount' must be grams (g) or milliliters (ml). For pieces, enter the number.

    Do not add any text before or after the JSON."""

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                response_mime_type="application/json" 
            )
        )
        # On parse le texte reçu de Gemini pour l'envoyer au mobile
        recipe_data = json.loads(response.text)
        return {"suggestions": recipe_data}

    except Exception as e:
        print(f"ERREUR GEMINI : {str(e)}")
        return {"suggestions": [
            {"id": 0, "title": "Chef en pause", "description": "L'IA est indisponible.", "score": "0%"}
        ]}
    
@app.get("/recipe-details")
def get_recipe_details(title: str, db: Session = Depends(get_db)):
    # On récupère les ingrédients pour donner du contexte à l'IA
    ingredients = db.query(models.Ingredient).all()
    ing_list = ", ".join([i.name for i in ingredients])
    lang: str = Query("en", description="Language of the recipe (fr or en)"),

    lang_instruction = "Réponds exclusivement en français." if lang == "fr" else "Respond exclusively in English."

    prompt = f"""
    {lang_instruction}
    Task: Write a detailed recipe for: "{title}".
    Context: Use these available ingredients primarily: {ing_list}.
    Substitutions: Suggest substitutions if some key ingredients for "{title}" are missing from the context list.
    
    JSON Structure to follow:
    {{
      "title": "{title}",
      "ingredients": ["item 1", "item 2"],
      "instructions": ["step 1", "step 2"],
      "prep_time": "approximate duration",
      "difficulty": "Easy/Medium/Hard"
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
    return {"message": "deleted"}

@app.post("/pantry/consume")
def consume_ingredients(data: schemas.CookingUpdate, db: Session = Depends(get_db)):
    for item in data.used_ingredients:
        target_name = item.get("name").strip().lower()
        amount = item.get("amount", 0)
        
        # On cherche l'ingrédient en base
        db_ing = db.query(models.Ingredient).filter(models.Ingredient.name == target_name).first()
        
        if db_ing:
            if not db_ing.is_staple:
                # Si c'est du frais, on supprime carrément
                db.delete(db_ing)
            else:
                # Si c'est un staple, on réduit la quantité
                db_ing.quantity = max(0, db_ing.quantity - amount)
                # Optionnel : si la quantité tombe à 0, on pourrait aussi supprimer
    
    db.commit()
    return {"status": "success", "message": "Pantry updated"}