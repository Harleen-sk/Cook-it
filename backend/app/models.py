from sqlalchemy import Column, Integer, String, Float, Boolean, JSON
from .database import Base

class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    quantity = Column(Float, default=0.0)
    unit = Column(String)
    is_staple = Column(Boolean, default=False)
    is_in_shopping_list = Column(Boolean, default=False)

class Equipment(Base):
    __tablename__ = "equipments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    is_active = Column(Boolean, default=True)

class FavoriteRecipe(Base):
    __tablename__ = "favorite_recipes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    details = Column(JSON)