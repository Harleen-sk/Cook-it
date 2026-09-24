# Image Node.js pour le développement
FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

RUN npm install -g expo-cli

COPY . .

EXPOSE 19006

CMD ["npx", "expo", "start", "--web", "--port", "19006"]