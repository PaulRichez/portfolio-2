# 🚀 Démarrage Rapide — Portfolio

Stack : **Angular 19** (front) + **Strapi 5** (back, SQLite en local). Chatbot IA via **Zhipu** (cloud,
pas de RAG, aucun modèle local).

## Développement local

Prérequis : Node 18–22. Pour le chatbot, mettre une clé Zhipu (gratuite, open.bigmodel.cn) dans
`portfolio-server/.env` → `ZHIPU_API_KEY=...`.

```bash
# 1. Backend Strapi (SQLite, port 1337)
cd portfolio-server && npm run develop
#    → 1er boot sur base vide : le contenu (CV, projets) est seedé ~60 s après le démarrage.

# 2. Frontend Angular (port 4200)
cd portfolio-client && npm start
```

**Accès :**
- Front : http://localhost:4200
- Strapi admin : http://localhost:1337/admin  (crée le compte admin au 1er passage — il n'est PAS seedé)
- API : http://localhost:1337/api

**Re-seed** (base existante) : arrêter Strapi, supprimer `portfolio-server/.tmp/data.db`, relancer,
attendre ~60 s.

## Landing pages

Les 3 landings (repo voisin `../portfolio-landing/` : Nebula/Astro, Lumina/Next, Pulse/Vue) sont
servies par Strapi sous `/nebula`, `/lumina`, `/pulse`. Après une modif d'une landing :

```bash
npm run sync:landings   # rebuild les 3 + recopie dans portfolio-server/public/
```

## Production (Coolify)

Déploiement via la ressource **"Docker Compose"** de Coolify, sur le `docker-compose.yml` **racine**.
- **Domaines** (`paulrichez.fr` → service `angular`, `api.paulrichez.fr` → service `strapi`) : dans l'UI Coolify.
- **Secrets** (`APP_KEYS`, `JWT_SECRET`, `ADMIN_JWT_SECRET`, `API_TOKEN_SALT`, `ZHIPU_API_KEY`) : dans l'UI Coolify.
- **SSL** : automatique (Let's Encrypt via Traefik) — d'où la suppression de nginx/certbot.

Test des images Docker en local :
```bash
npm run docker:build && npm run docker:start   # front: http://localhost:3000 · strapi: http://localhost:1337
```
