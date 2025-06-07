# 🚀 Démarrage Rapide Portfolio

# 🚀 Démarrage Rapide Portfolio

## Développement Local (Recommandé)

```bash
# 1. Démarrer les services IA + PostgreSQL
npm run dev:start

# 2. Dans un autre terminal : Strapi
npm run dev

# 3. Dans un autre terminal : Angular  
npm run client
```

**Accès :**
- Angular : http://localhost:4200
- Strapi : http://localhost:1337
- Ollama : http://localhost:11434
- ChromaDB : http://localhost:8001
- PostgreSQL : localhost:5432

## Production Docker

```bash
# 1. Construire les images
npm run docker:build

# 2. Télécharger les modèles IA (première fois)
npm run docker:setup-models

# 3. Démarrer tout
npm run docker:start
```

**Accès :**
- Frontend : http://localhost:3000
- Strapi Admin : http://localhost:1337/admin

## Commandes Utiles

### Docker Production
```bash
npm run docker:start          # Démarrer
npm run docker:stop           # Arrêter  
npm run docker:logs           # Voir logs
npm run docker:status         # Statut
npm run docker:clean          # Nettoyer tout
```

### Développement
```bash
npm run dev:start             # IA + PostgreSQL
npm run dev:stop              # Arrêter services dev
```

### Tests
```bash
npm run test:ollama           # Tester IA
npm run test:chroma           # Tester base vectorielle
```

## Dépannage Rapide

### Services ne démarrent pas
```bash
npm run docker:logs
# ou
npm run dev:logs
```

### Modèle IA manquant
```bash
npm run docker:setup-models
```

### Reset complet
```bash
npm run docker:clean
npm run docker:build
npm run docker:start
```

---

**📖 Documentation complète :** README-Docker.md
