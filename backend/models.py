from sqlalchemy import Column, Integer, String, Float, Boolean
from database import Base

class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    quantity = Column(Float, default=0.0)
    unit = Column(String)  # g, ml, units, etc.
    is_staple = Column(Boolean, default=False)  # Ingrédient de base (sel, huile...)
    is_in_shopping_list = Column(Boolean, default=False)

class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    is_active = Column(Boolean, default=True) # "Je ne veux pas utiliser le four aujourd'hui"