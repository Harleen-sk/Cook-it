from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app import models, schemas, database
import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv
from typing import List

from pydantic import BaseModel, Field

load_dotenv()

SessionLocal = database.SessionLocal
engine = database.engine
# Creates the tables in the SQLite file if they do not exist
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Veggie Planner API")

STAPLES_LIST = ["salt", "pepper", "olive oil", "sugar", "flour", "vinegar", "garlic powder"]

load_dotenv()

# Configuration de Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("La clé API n'est pas chargée ! Vérifie ton fichier .env")
else:
    #Displays the first 4 characters to verify that it is the correct key
    print(f"Clé API détectée (début) : {GEMINI_API_KEY[:4]}...")
client = genai.Client(api_key=GEMINI_API_KEY)
MODEL_NAME = "gemini-2.5-flash-lite"


#Function to establish a connection to the database
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Welcome to CookIt API 🥕"}

# ROUTE 1 : Gather all the ingredients
@app.get("/ingredients", response_model=list[schemas.Ingredient])
def get_ingredients(db: Session = Depends(get_db)):
    return db.query(models.Ingredient).all()

def determine_if_staple(ingredient_name: str) -> bool:
    name_clean = ingredient_name.lower().strip()
    
    # List of word roots that indicate a staple food
    STAPLE_KEYWORDS = [
        "huile", "oil", "sel", "salt", "poivre", "pepper", "sucre", "sugar",
        "farine", "flour", "riz", "rice", "pâte", "pasta", "épice", "spice",
        "curry", "paprika", "herbe", "sauce", "vinaigre", "vinegar", "sec",
        "conserve", "boîte", "miel", "honey", "sirop", "bouillon"
    ]

    for keyword in STAPLE_KEYWORDS:
        if keyword in name_clean:
            return True
            
    return False

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

# Method for removing an ingredient by its ID
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

@app.post("/generate-ideas")
def generate_recipes(selection: schemas.SelectionRequest):
    ings_list = selection.ingredients
    eqs_list = selection.equipment
    m_type = selection.meal_type
    
    target_lang = "French" if selection.lang == "fr" else "English"

    #Converting lists to strings for the prompt
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
        #We parse the text received from Gemini to send it to the mobile device
        recipe_data = json.loads(response.text)
        return {"suggestions": recipe_data}

    except Exception as e:
        print(f"ERREUR GEMINI : {str(e)}")
        return {"suggestions": [
            {"id": 0, "title": "Chef on Break", "description": "AI is unavailable", "score": "0%"}
        ]}
    
@app.get("/recipe-details")
def get_recipe_details(title: str, db: Session = Depends(get_db)):
    #We gather the ingredients to provide context for the AI
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
    
#Steps to Save a Recipe
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

#Path to list favorites
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
        

        db_ing = db.query(models.Ingredient).filter(models.Ingredient.name == target_name).first()
        
        if db_ing:
            if not db_ing.is_staple:
                # If it's fresh, we just throw it out
                db.delete(db_ing)
            else:
                #If it's a staple, reduce the amount
                db_ing.quantity = max(0, db_ing.quantity - amount)
                #Optional: If the quantity drops to 0, we could also remove
    
    db.commit()
    return {"status": "success", "message": "Pantry updated"}

# Periode 2

class ConsumedIngredient(BaseModel):
    name: str = Field(..., description="Le nom précis de l'ingrédient trouvé dans le garde-manger")
    amount: float = Field(..., description="La quantité numérique estimée consommée pour la recette (ex: 1.5, 0.5)")

# 2. We define exactly what a long-lasting ingredient to buy looks like
class StapleToBuy(BaseModel):
    name: str = Field(..., description="Le nom du condiment ou de l'épice de longue durée à racheter (ex: curry en poudre, miel)")

# 3. The main schema that Gemini must populate (No more List[dict]—we're using our submodels)
class AgentPantryAction(BaseModel):
    ingredients_to_consume: List[ConsumedIngredient] #Expected format: [{“name”: ‘rice’, “amount”: 150}]
    staples_to_buy: List[StapleToBuy]         #Expected format: [{“name”: “curry powder”, ‘reason’: “A long-lasting ingredient used in this recipe”}]
    assistant_message: str = Field(..., description="A friendly message in French summarizing your actions") 

# 4. The flowchart for validating the mobile request (Unchanged)
class AgentRequestSchema(BaseModel):
    recipe_title: str
    used_ingredients: List[str]

class ConfirmIngredient(BaseModel):
    name: str
    amount: float

class ConfirmStaple(BaseModel):
    name: str

class AgentConfirmSchema(BaseModel):
    ingredients_to_consume: List[ConfirmIngredient]
    staples_to_buy: List[ConfirmStaple]

@app.post("/pantry/agent-preview")
def agent_preview_pantry(data: AgentRequestSchema, db: Session = Depends(get_db)):
    """
    The AI Agent analyzes the recipe and suggests inventory adjustments.
    Returns the raw JSON without modifying the database.
    """
    db_ingredients = db.query(models.Ingredient).all()
    pantry_context = [
        f"- {ing.name} (Current quantity: {ing.quantity} {ing.unit}, Staple: {ing.is_staple})" 
        for ing in db_ingredients
    ]
    pantry_text = "\n".join(pantry_context)
    raw_ingredients = "\n".join([f"- {ing}" for ing in data.used_ingredients])

    prompt = f"""
    You are an AI Kitchen Assistant Agent and Pantry Manager. 
    The user has just cooked the following recipe: "{data.recipe_title}".

    Here are the raw lines of ingredients used in this recipe:
    {raw_ingredients}

    Here is the current state of their pantry in the database:
    {pantry_text}

    Your tasks:
    Fill out the following JSON schema by adhering to these strict instructions:
    1. In 'ingredients_to_consume', identify which ingredients from the pantry were used. Extract or estimate the numerical quantity consumed (float number only, e.g., 1.0 or 0.25) and map it to the exact corresponding ingredient name in the pantry.
    2. In 'staples_to_buy', identify any long-lasting powders, spices, oils, or condiments (e.g., salt, pepper, curry, flour, honey, syrup) that were used. If the user needs them or is running low, add them to their shopping list.
    3. In 'assistant_message', write a friendly message in English summarizing your analysis (e.g., "I detected the use of yogurt and honey! Adjust the list below if needed.").
    
    Respond EXCLUSIVELY by respecting the provided JSON schema.
    """

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AgentPantryAction,
                temperature=0.1
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Gemini Agent Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="The AI Agent was unable to analyze the recipe."
        )
    
@app.post("/pantry/agent-consume")
def agent_manage_pantry(data: AgentRequestSchema, db: Session = Depends(get_db)):
    """
    Phase 2: AI Agent analyzes the case and manages the application
    by modifying the database independently.
    """
    # Current database context for the Agent
    db_ingredients = db.query(models.Ingredient).all()
    pantry_context = [
        f"- {ing.name} (Current quantity: {ing.quantity} {ing.unit}, Staple: {ing.is_staple})" 
        for ing in db_ingredients
    ]
    pantry_text = "\n".join(pantry_context)

    # Convert the list of raw ingredients into a single string for the prompt
    raw_ingredients = "\n".join([f"- {ing}" for ing in data.used_ingredients])

    # The Agent Role Prompt
    prompt = f"""
    You are an AI Kitchen Assistant Agent and Pantry Manager. 
    The user has just cooked the following recipe: "{data.recipe_title}".

    Here are the raw lines of ingredients used in this recipe:
    {raw_ingredients}

    Here is the current state of their pantry in the database:
    {pantry_text}

    Your tasks:
    Fill out the following JSON schema by adhering to these strict instructions:
    1. In 'ingredients_to_consume', identify which ingredients from the pantry were used. Extract or estimate the numerical quantity consumed (float number only, e.g., 1.0 or 0.25) and map it to the exact corresponding ingredient name in the pantry.
    2. In 'staples_to_buy', identify any long-lasting powders, spices, oils, or condiments (e.g., salt, pepper, curry, flour, honey, syrup) that were used. If the user needs them or is running low, add them to their shopping list.
    3. In 'assistant_message', write a friendly message in English summarizing your actions (e.g., "Delicious! I deducted the yogurt from your pantry and added honey to your shopping list for future meals!").
    
    Respond EXCLUSIVELY by respecting the provided JSON schema.
    """

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AgentPantryAction,
                temperature=0.1
            ),
        )
        # Parse JSON
        result_json = json.loads(response.text)
    except Exception as e:
        print(f"Gemini Agent Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="The AI Agent was unable to generate its decision."
        )

    # Implementation of the Database Administrator's Decisions
    
    # Inventory Deduction Logic
    for item in result_json.get("ingredients_to_consume", []):
        name_to_find = item.get("name", "").strip().lower()
        try:
            amount_to_deduct = float(item.get("amount", 0))
        except (ValueError, TypeError):
            amount_to_deduct = 0.0

        if not name_to_find or amount_to_deduct <= 0:
            continue

        db_ing = db.query(models.Ingredient).filter(models.Ingredient.name.ilike(f"%{name_to_find}%")).first()
        
        if db_ing:
            if not db_ing.is_staple and db_ing.quantity <= amount_to_deduct:
                db.delete(db_ing)
            else:
                db_ing.quantity = max(0.0, db_ing.quantity - amount_to_deduct)

    # Automatically add long-lasting items (Staples) to the shopping list
    for staple_item in result_json.get("staples_to_buy", []):
        staple_name = staple_item.get("name", "").strip().lower()
        if not staple_name:
            continue
        
        db_ing = db.query(models.Ingredient).filter(models.Ingredient.name.ilike(f"%{staple_name}%")).first()
        if db_ing:
            db_ing.is_in_shopping_list = True
        else:
            new_ingredient = models.Ingredient(
                name=staple_name,
                quantity=1.0,
                unit="pcs",
                is_staple=True,
                is_in_shopping_list=True
            )
            db.add(new_ingredient)

    db.commit()

    return {
        "status": "success",
        "message": result_json.get("assistant_message", "Pantry updated successfully!"),
    }

@app.post("/pantry/agent-consume")
def agent_manage_pantry(data: AgentRequestSchema, db: Session = Depends(get_db)):
    """
    Phase 2: Agent ia, who analyzes the test case and controls the application
    by modifying the database independently
    """
    #Current database context for the Agent
    db_ingredients = db.query(models.Ingredient).all()
    pantry_context = [
        f"- {ing.name} (Quantité actuelle: {ing.quantity} {ing.unit}, Ingrédient de base/Staple: {ing.is_staple})" 
        for ing in db_ingredients
    ]
    pantry_text = "\n".join(pantry_context)

    #Convert the list of raw ingredients into a single string that can be read by the prompt
    ingredients_bruts = "\n".join([f"- {ing}" for ing in data.used_ingredients])

    #The Agent Role Prompt
    prompt = f"""
    Tu es un Agent IA Assistant de Cuisine et Gérant de Garde-manger. 
    L'utilisateur vient de cuisiner la recette suivante : "{data.recipe_title}".

    Voici les lignes d'ingrédients bruts utilisées dans cette recette :
    {ingredients_bruts}

    Voici l'état actuel de son garde-manger (Pantry) en base de données :
    {pantry_text}

    Tes tâches :
    Remplis le schéma JSON suivant en suivant ces instructions strictes :
    1. Dans 'ingredients_to_consume', identifie quels ingrédients du garde-manger ont été utilisés. Extrais ou estime la quantité numérique consommée (uniquement un nombre flottant, ex: 1.0 ou 0.25) et associe-la au nom de l'ingrédient correspondant dans le garde-manger.
    2. Dans 'staples_to_buy', identifie les poudres, épices, huiles ou condiments de longue durée (ex: sel, poivre, curry, farine, miel, sirop) utilisés. Si l'utilisateur en a besoin ou va bientôt en manquer, ajoute-les pour sa liste de courses.
    3. Dans 'assistant_message', écris un message amical en français résumant tes actions (ex: "Délicieux ! J'ai déduit le yaourt de votre garde-manger et j'ai inscrit le miel sur votre liste de courses pour vos futurs plats !").
    
    Réponds EXCLUSIVEMENT en respectant le schéma JSON fourni.
    """

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AgentPantryAction,
                temperature=0.1
            ),
        )
        # Parse JSON
        result_json = json.loads(response.text)
    except Exception as e:
        print(f"Erreur Agent Gemini: {e}")
        raise HTTPException(status_code=500, detail="L'Agent IA n'a pas pu générer sa décision.")

    #Implementation of the Database Administrator's Decisions
    
    #Use of Inventory
    for item in result_json.get("ingredients_to_consume", []):
        name_to_find = item.get("name", "").strip().lower()
        try:
            amount_to_deduct = float(item.get("amount", 0))
        except (ValueError, TypeError):
            amount_to_deduct = 0.0

        if not name_to_find or amount_to_deduct <= 0:
            continue

        db_ing = db.query(models.Ingredient).filter(models.Ingredient.name.ilike(f"%{name_to_find}%")).first()
        
        if db_ing:
            if not db_ing.is_staple and db_ing.quantity <= amount_to_deduct:
                db.delete(db_ing)
            else:
                db_ing.quantity = max(0.0, db_ing.quantity - amount_to_deduct)

    #Automatically add long-lasting items (Staples) to the shopping list
    for staple_item in result_json.get("staples_to_buy", []):
        staple_name = staple_item.get("name", "").strip().lower()
        if not staple_name:
            continue
        
        db_ing = db.query(models.Ingredient).filter(models.Ingredient.name.ilike(f"%{staple_name}%")).first()
        if db_ing:
            db_ing.is_in_shopping_list = True
        else:
            new_ingredient = models.Ingredient(
                name=staple_name,
                quantity=1.0,
                unit="pcs",
                is_staple=True,
                is_in_shopping_list=True
            )
            db.add(new_ingredient)

    db.commit()

    return {
        "status": "success",
        "message": result_json.get("assistant_message", "Garde-manger mis à jour avec succès !"),
    }

@app.patch("/ingredients/{ingredient_id}/buy")
def buy_ingredient(ingredient_id: int, db: Session = Depends(get_db)):
    """
    Steps to confirm the purchase of an ingredient from the shopping list.
    Sets `is_in_shopping_list` to `False` and adjusts the quantity if necessary.
    """
    db_ing = db.query(models.Ingredient).filter(models.Ingredient.id == ingredient_id).first()
    if not db_ing:
        raise HTTPException(status_code=404, detail="Ingrédient non trouvé")
    
    db_ing.is_in_shopping_list = False
    #If the quantity dropped to 0 during cooking, it is reset to the default stock level
    if db_ing.quantity <= 0:
        db_ing.quantity = 1.0  
        
    db.commit()
    db.refresh(db_ing)
    return db_ing