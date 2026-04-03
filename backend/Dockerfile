FROM python:3.11-slim

# Définit le dossier de travail
WORKDIR /app

# Installe les dépendances système nécessaires pour SQLite
RUN apt-get update && apt-get install -y sqlite3 libsqlite3-dev

# Copie et installe les dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie tout le code local dans le conteneur
COPY . .

# Lance le serveur FastAPI avec rechargement automatique
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]