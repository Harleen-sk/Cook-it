# Image Node.js pour le développement
FROM node:20-slim

WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des dépendances
RUN npm install

# Installation globale de l'outil Expo CLI
RUN npm install -g expo-cli

# Copie du reste du code
COPY . .

# Port utilisé par Expo pour le Web
EXPOSE 19006

# Commande pour lancer l'app en mode Web
CMD ["npx", "expo", "start", "--web", "--port", "19006"]