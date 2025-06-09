# Étape 1 : Build Angular avec Node
FROM node:20-alpine AS builder

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci

# Copier tout le code source
COPY . .

# Lancer le build de l'application Angular
RUN npm run build

# Étape 2 : Image finale basée sur Nginx pour servir l'app
FROM nginx:alpine

# Copier l'application buildée dans le dossier nginx public
COPY --from=builder /app/dist/portfolio-client /usr/share/nginx/html

# Copier la configuration nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exposer le port standard HTTP
EXPOSE 80

# Health check (optionnel mais recommandé)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Commande de démarrage nginx
CMD ["nginx", "-g", "daemon off;"]
