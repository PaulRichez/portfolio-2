# Portfolio‑2 — Audit "Pro" & feuille de route

> Rédigé le 2026‑06‑09 après l'ajout des 3 landing pages et le nettoyage du template SAKAI.
> Objectif : lister, par priorité, ce qui reste à faire pour rendre le portfolio **propre,
> rapide, sûr et déployable** sur Coolify (`paulrichez.fr`).

---

## 0. Ce qui a été fait aujourd'hui ✅

**3 projets « landing page » créés** (dossier voisin `../portfolio-landing/`), chacun buildé avec succès :
- `nebula-astro` — Astro 4 + Tailwind (SaaS analytics IA)
- `lumina-next` — Next.js 14 + React + Tailwind (studio créatif)
- `pulse-vue` — Vue 3 + Vite + Tailwind (app fitness)

**Intégration côté Strapi** :
- 3 nouveaux `projects` ajoutés au seed (`portfolio-server/src/api/project/services/migration.ts`),
  avec covers SVG générés (`makeCover`) — pas besoin de screenshots.
- Nouveaux `codings` ajoutés (`.../coding/services/migration.ts`) : **TypeScript, Astro, Next.js,
  Tailwind CSS, Vite**.
- Les landings sont placées en **fin de tableau** → créées en dernier → affichées en premier
  (tri `createdAt desc`).

**Correctifs côté affichage** :
- `me` controller (`.../api/me/controllers/me.ts`) : mapping `link_demo→demoUrl`,
  `github_link→sourceUrl`, `link_npm→npmUrl`. ⚠️ **Avant, les boutons « Démo » et « Code » ne
  s'affichaient JAMAIS** (le template lit `demoUrl/sourceUrl`, l'API renvoyait `link_demo/github_link`).
  C'est corrigé pour TOUS les projets. Limite de projets affichés passée de **6 → 9**.

**Purge du template SAKAI** :
- `app.menu.ts` : menu démo (UI Components, Hierarchy, Submenu…, lien sakai‑ng) **remplacé** par un
  menu portfolio réel (Accueil / Projets / Expériences / Formation / Compétences + GitHub/LinkedIn),
  avec scroll fluide vers les sections.
- `app.footer.ts` : crédit « SAKAI by PrimeNG » **remplacé** par un footer perso.
- `home.component.html` : ids d'ancrage ajoutés (`#about`, `#projects`, `#experience`, `#education`, `#skills`).
- `index.html` : **SEO complet ajouté** (title, description, keywords, author, Open Graph, Twitter,
  canonical, `lang="fr"`, theme‑color).
- `projects.component.html` : bloc commenté mort supprimé.

**Builds vérifiés** : les 3 landings ✅, `portfolio-client` (`ng build`) ✅, compilation TS serveur
(`strapi build`) ✅.

---

## 1. 🔴 P0 — Bloquants avant mise en prod

### 1.1 Build serveur — RÉSOLU ✅ (c'était un conflit de peer deps langchain)
**Vraie cause racine** : `npm install` du serveur **échouait** sur un conflit ERESOLVE —
`@langchain/openai@^1.2.0` (root, veut `@langchain/core` v1) vs le plugin `llm-chat`
(`@langchain/openai@^0.5.11` + `@langchain/core@^0.3.57`, v0.3). npm refusait l'install →
**`node_modules` jamais créé** → le binaire `strapi-plugin` (du `postinstall` = `build:plugins`)
était absent → faux symptôme « strapi-plugin not recognized ».

**Corrigé** :
- Ajout de `portfolio-server/.npmrc` → `legacy-peer-deps=true` (install OK partout, local + Coolify,
  sans avoir à se souvenir du flag).
- `Dockerfile` : `npm ci --omit=dev` → `npm ci --legacy-peer-deps` (le plugin compile pendant
  `npm run build` et a besoin de ses devDeps : typescript, @strapi/sdk-plugin).
- **Vérifié** : `npm install` + `npm run build` passent, le plugin `llm-chat` compile en
  `dist/server/index.{js,mjs}`.

**Reste (P3)** : aligner un jour les versions langchain (root v1 vs plugin v0.3) pour supprimer le
conflit à la source ; `npm audit` remonte 95 vulns (typique Strapi+langchain), à trier sans urgence.

### 1.2 Chatbot IA — gardé en démo (archi cloud + embeddings locaux) ✅
Décision : on **garde** le chatbot RAG (`/api/llm-chat/stream`). Le N100 ne pouvant pas faire tourner
un gros modèle, l'archi retenue sépare le lourd du léger :
- **Génération (chat)** → **Zhipu GLM‑4‑Flash** (cloud gratuit, OpenAI‑compatible). Câblé via
  `config/plugins.ts` (bloc `zhipu` ajouté) ; le service essaie l'ordre `['zhipu','ollama','custom']`
  et prend zhipu si `ZHIPU_API_KEY` est défini.
- **Embeddings** (`nomic-embed-text`, 137M) → **Ollama local** sur le N100 (léger, CPU). Découplé du
  chat via `EMBEDDING_BASE_URL` (patch `chroma-vector-service.ts`).
- **ChromaDB** → N100 (léger, CPU).

**Env à définir au déploiement** :
```
LLM_PROVIDER=zhipu
ZHIPU_API_KEY=<clé open.bigmodel.cn>
ZHIPU_MODEL_NAME=glm-4-flash        # optionnel
EMBEDDING_BASE_URL=http://ollama:11434   # Ollama local (embeddings only)
CHROMA_URL=http://chromadb:8000          # service ChromaDB du compose
```
Le conteneur `ollama` n'a plus besoin du modèle de chat : seul `nomic-embed-text` est requis
(on peut retirer le `ollama pull qwen2.5:1.5b` du docker‑compose).
**Reste conseillé (P3)** : gérer proprement l'échec réseau côté front (message de repli si l'endpoint
ne répond pas) — aujourd'hui pas de gestion d'erreur explicite.

---

## 2. 🟠 P1 — Haute priorité (qualité perçue & SEO)

### 2.1 Données perso exposées publiquement
`/api/me/populated` (auth: false) renvoie **email + numéro de téléphone** en clair
(`me/services/migration.ts`). Le **téléphone public = spam/scraping**.
**Fix** : retirer `phoneNumber` (et éventuellement l'email) du payload public, ou créer une variante
publique sans ces champs.

### 2.2 SEO — compléments
Fait : meta + OG + Twitter. **Reste** :
- `og:image` (1200×630) + `twitter:image` — créer une image de partage (sinon pas d'aperçu sur
  LinkedIn/X). À déposer dans `public/og.png` et référencer en absolu.
- `robots.txt` + `sitemap.xml` (statiques dans `public/`).
- JSON‑LD `Person` (nom, poste, liens, ville) pour le knowledge graph.
- SPA sans SSR → le contenu Strapi n'est pas pré‑rendu. Les **meta sont statiques (OK)** mais pour un
  vrai gain SEO, envisager Angular SSR/prerender de la home plus tard.

### 2.3 Favicon & PWA basique
`index.html` pointe encore vers `favicon.ico` par défaut.
**Fix** : favicon SVG de marque + `apple-touch-icon` + `site.webmanifest` (nom, couleurs, icônes).

### 2.4 Poids du bundle initial
`main` ≈ **818 KB brut / 125 KB transféré** (PrimeNG complet + prism + ngx‑markdown). Le chatbot et
le markdown sont chargés dans le bundle initial alors qu'ils sont secondaires.
**Fix** : lazy‑load du composant chatbot (et de prism/markdown) ; n'importer que les modules PrimeNG
utilisés. Objectif : < 500 KB initial.

---

## 3. 🟡 P2 — Moyen (robustesse & maintenance)

### 3.1 Fiabilité du seed
`database/migrations/011-populate-me-data.js` lance `populateAllData()` via `setTimeout(60s)` en
**fire‑and‑forget** dans `up()` : non `await`é, aucune erreur remontée, et **course possible** si
plusieurs migrations se déclenchent. Les migrations ne s'exécutant **qu'une fois**, modifier les
tableaux ne reseed PAS une base existante.
**Fix** :
- Déplacer le seed vers un vrai `bootstrap` (`src/index.ts`) idempotent avec un flag « seedé », ou un
  `npm run seed` dédié.
- **Re‑seed d'une base locale existante** : supprimer `portfolio-server/.tmp/data.db` puis relancer
  (à documenter dans le `QUICK-START.md`).

### 3.2 Données en dur → JSON
Projets/codings/profil sont **codés en dur en TS**. Externaliser en `*.json` (chargés par le service)
rendrait les ajouts triviaux (c'était l'attente initiale « juste ajouter en JSON »).

### 3.3 Images projets en base64
Plusieurs projets stockent l'image en **base64 dans la base** → la réponse `/me/populated` pèse
plusieurs centaines de Ko. Préférer l'**upload média Strapi** + URL. (Les covers des nouvelles
landings sont des data‑URI SVG légers.)

### 3.4 Code mort
Composant `pages/home/sections/knowledges/` **non utilisé** dans la home → à supprimer (laissé en
place aujourd'hui pour rester chirurgical).

### 3.5 Thème non personnalisé
Thème PrimeNG **Aura par défaut** (bleu/gris), police système. Ajouter des couleurs de marque + une
police (Inter/Sora) donnerait une identité propre.

---

## 4. 🟢 P3 — Finitions

- **Accessibilité** : les boutons icône‑seule de la topbar (chatbot, dark mode, palette) n'ont pas
  d'`aria-label`. Ajouter des labels. Vérifier les contrastes des textes « muted ».
- **Console** : retirer les `console.log` des services de migration.
- **UX chargement** : remplacer le spinner brut par des skeletons de cartes.
- **Lighthouse** : passer un audit après déploiement (perf/SEO/a11y/best‑practices).
- **i18n** : strings FR en dur (acceptable ; `lang="fr"` posé). Prévoir ngx‑translate seulement si un
  jour bilingue.

---

## 5. ✅ Checklist de déploiement Coolify

- [ ] **Corriger 1.1** (build plugin) et vérifier `docker build` du serveur en conditions réelles.
- [ ] **Décider 1.2** (chatbot IA on/off pour le MVP).
- [ ] Choisir la base : **Postgres** recommandé en prod (le `docker-compose` a un profil `postgres`) ;
      sinon SQLite avec **volume persistant** pour `.tmp/`.
- [ ] Définir les secrets : `APP_KEYS`, `JWT_SECRET`, `ADMIN_JWT_SECRET`, `API_TOKEN_SALT`, `DATABASE_*`
      (valeurs fortes, jamais commitées).
- [ ] Mapper les domaines : `paulrichez.fr` (client) et `api.paulrichez.fr` (Strapi) — le prod client
      pointe déjà vers `https://api.paulrichez.fr/api`.
- [ ] Volume persistant pour `public/uploads` (médias Strapi).
- [ ] 1er boot : attendre ~60 s (seed), puis vérifier `GET /api/me/populated` → 9 projets dont les 3
      landings, **boutons Démo/Code présents**.
- [ ] Vérifier les permissions du rôle **public** (project.find, me/populated) — gérées par
      `strapi-plugin-config-sync` (`config/sync/`).
- [ ] Déployer les 3 landings (`../portfolio-landing/*`) sur des sous‑domaines `*.paulrichez.fr` et
      mettre à jour les `link_demo` du seed si les URLs diffèrent.
- [ ] Créer `og.png`, `robots.txt`, `sitemap.xml`, favicon de marque.

---

## 6. Récapitulatif des fichiers modifiés aujourd'hui

```
portfolio-server/src/api/project/services/migration.ts   + makeCover() + 3 projets landing
portfolio-server/src/api/coding/services/migration.ts    + 5 codings (TS, Astro, Next.js, Tailwind, Vite)
portfolio-server/src/api/me/controllers/me.ts            mapping demoUrl/sourceUrl/npmUrl + limit 6→9
portfolio-client/src/index.html                          SEO/OG/Twitter complets
portfolio-client/src/app/layout/component/app.menu.ts    menu SAKAI → menu portfolio
portfolio-client/src/app/layout/component/app.footer.ts  crédit SAKAI → footer perso
portfolio-client/src/app/pages/home/home/home.component.html   ids d'ancrage de sections
portfolio-client/.../sections/projects/projects.component.html dead code supprimé
../portfolio-landing/{nebula-astro,lumina-next,pulse-vue}      3 nouveaux projets
```

_— Audit généré automatiquement ; à relire et prioriser selon ton temps disponible._
