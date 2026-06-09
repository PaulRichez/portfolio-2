# Audit du chatbot IA (`llm-chat`) — analyse & simplification

> Verdict : **le RAG est over-engineered pour ce cas d'usage.** Le corpus (ton CV) est minuscule.
> On peut supprimer ~2 500 lignes, 2 services (Ollama + ChromaDB), et obtenir un chatbot **plus
> rapide, plus fiable, et qui ne fait tourner AUCUN modèle local**.

---

## 1. Ce que fait le système aujourd'hui

Pour **un seul message** du visiteur, le pipeline actuel enchaîne :

```
front ──SSE──> /llm-chat/stream
   └─> LangChain agent (function-calling)
         └─> SmartRAGTool._call()
               ├─ 1) Ollama qwen3:0.6b  → décide "faut-il chercher ?" + mots-clés + confiance (JSON)
               ├─ 2) Ollama nomic-embed → embedding de la requête
               ├─ 3) ChromaDB           → recherche vectorielle top-N
               └─ 4) formate les résultats
         └─> Zhipu GLM-4-Flash → génère la réponse finale
   └─> persiste user+assistant en base (chat-message / chat-session)
   └─> suggestions-service → génère des questions de suivi
+ vector-sync-service → réindexe ChromaDB à chaque modif de contenu
```

→ Jusqu'à **3 appels modèles** + 1 requête vectorielle + 2 écritures DB **par message**.
Code concerné : ~4 400 lignes serveur, dont ~2 500 dédiées au RAG/vecteurs.

## 2. Le constat qui change tout : le corpus est minuscule

Ce qui est indexé (`indexable-collections.ts`) = **tout ton CV** :
- ~12 projets (titre + description courte)
- 1 profil (toi) + ~5 expériences + ~3 diplômes + ~25 compétences + 2 langues
- ~25 technologies

**Total ≈ 40-50 mini-documents ≈ 3 000-6 000 tokens.**

Or GLM-4-Flash a une fenêtre de **128 000 tokens**. **Ton CV entier rentre ~25 fois dans le contexte.**

> Le RAG sert à retrouver l'aiguille dans une botte de foin. Ici il n'y a pas de botte de foin —
> il y a 40 lignes. On peut donner **tout** le CV au modèle à chaque fois.

## 3. Pourquoi « ça marche pas très bien »

1. **Un modèle 0.6B (qwen3) pour décider du RAG** : sur le N100, lent et peu fiable pour sortir du
   JSON structuré (`shouldUseRAG/keywords/confidence`). S'il rate → fallback mots-clés bancal.
2. **Function-calling de l'agent sur GLM-4-Flash** : le tool-calling est inconstant → parfois l'outil
   n'est pas appelé → pas de contexte → réponse générique ou hallucinée.
3. **Empilement de points de panne** : Ollama up ? ChromaDB up ? Index à jour ? Agent appelle l'outil ?
   Embedding OK ? Chaque maillon peut casser → impression d'instabilité.
4. **Latence** : 3 appels séquentiels + recherche vectorielle, dont 2 modèles **locaux** sur N100.
5. **Bug de prompt** : l'exemple du system-prompt dit *« J'utilise Angular et NestJS »* → mauvaise
   stack (c'est Strapi), ça **amorce une hallucination**.
6. **Fuite de données** : `phoneNumber` est indexé et mis en metadata → le bot peut donner ton numéro.
7. **Failover trompeur** : `providerOrder = ['zhipu','ollama','custom']` → si la clé Zhipu manque, ça
   bascule silencieusement sur Ollama local (lent) au lieu d'échouer clairement.

## 4. Archi recommandée : injection de contexte (zéro RAG)

```
front ──SSE──> /llm-chat/stream
   └─> récupère le CV complet (projets + me + compétences) depuis Strapi  [~5k tokens]
   └─> system prompt (persona) + CV + historic + message
   └─> Zhipu GLM-4-Flash (1 seul appel, streamé)
```

- **1 seul appel modèle** (Zhipu), streamé. Rapide, fiable.
- **Toujours le contexte complet** → réponses exactes, aucune « retrieval miss ».
- **AUCUN modèle local** : plus besoin d'Ollama du tout (même pas pour les embeddings).
- Le N100 ne fait plus tourner que **Strapi** (+ Angular).

## 5. Les ajustements concrets

**À garder :**
- Le endpoint streaming SSE (bonne UX) — juste simplifié.
- Le persona system-prompt (corriger « NestJS » → « Strapi/Angular »).
- (Optionnel) la persistance d'historique (chat-session/chat-message) si tu veux l'historique.
- (Optionnel) les suggestions de suivi — générées inline par le même appel, ou supprimées.

**À supprimer / désactiver (~2 500 lignes) :**
- `tools/smart-rag-tool.ts`, `services/chroma-vector-service.ts`, `services/ollama-service.ts`,
  `services/vector-sync-service.ts`, `controllers/vector-controller.ts`, `routes/vector-routes.ts`,
  `config/indexable-collections.ts`.
- Dans `langchain-service.ts` : le chemin `rag_smart`/agent → ne garder que le chemin "simple"
  **+ injection du CV** dans le prompt.

**Côté infra (`docker-compose.yml`) :**
- Retirer les services **`ollama`** et **`chromadb`** (et leurs volumes + healthchecks).
- Retirer les env `EMBEDDING_BASE_URL`, `CUSTOM_LLM_BASE_URL`, `CHROMA_URL`.
- Garder : `LLM_PROVIDER=zhipu`, `ZHIPU_API_KEY`, `ZHIPU_MODEL_NAME`.

**Privacy :** ne PAS injecter `phoneNumber` dans le contexte.

## 6. Gains

| | Avant | Après |
|---|---|---|
| Appels modèle / message | jusqu'à 3 | **1** |
| Modèles locaux (N100) | 2 (qwen0.6b + embed) | **0** |
| Services conteneurs | Strapi + Ollama + ChromaDB | **Strapi seul** |
| Points de panne | ~6 | **1 (l'API Zhipu)** |
| Code serveur plugin | ~4 400 lignes | **~1 500** |
| Fiabilité réponses | variable | **élevée (contexte complet)** |

## 7. Effort & risque

- **Effort** : ~½ journée. Il existe déjà un chemin non-RAG (`custom_simple`) dans
  `langchain-service.ts` (`useRAG !== false`) → on s'appuie dessus + on ajoute l'injection du CV.
- **Risque** : faible. On retire de la complexité, on n'en ajoute pas. Le seul appel externe restant
  (Zhipu) est déjà câblé et testé côté config.

---

---

## 8. ✅ IMPLÉMENTÉ (refacto fait)

Le passage RAG → injection de contexte a été réalisé :

- **`langchain-service.ts`** : nouveau `buildCvContext()` (profil + projets + parcours + compétences,
  **téléphone exclu**) + `buildPromptWithContext()` injecte ce CV dans CHAQUE prompt. `useRAG` forcé à
  `false` → plus de SmartRAGTool, plus d'agent, plus d'appel à ChromaDB/Ollama.
- **`config/plugins.ts`** : `providerOrder: ['zhipu']` → un seul provider (cloud), pas de fallback local.
- **`prompts/system-prompt.ts`** : nettoyé (suppression de l'exemple « NestJS » erroné + des consignes
  « outils/RAG » ; anti-hallucination : ne répondre que depuis le CONTEXTE injecté).
- **`bootstrap.ts`** : vidé (plus d'init ChromaDB ni de hooks de sync vectorielle).
- **`docker-compose.yml`** : services **`ollama` + `chromadb` supprimés** (+ volumes + env
  `CHROMA_URL`/`EMBEDDING_BASE_URL`/`CUSTOM_LLM_BASE_URL`). Reste : `LLM_PROVIDER`, `ZHIPU_API_KEY`,
  `ZHIPU_MODEL_NAME`.

**Fichiers RAG devenus morts** (toujours sur disque mais plus jamais exécutés — suppression possible
plus tard sans risque) : `tools/smart-rag-tool.ts`, `services/chroma-vector-service.ts`,
`services/ollama-service.ts`, `services/vector-sync-service.ts`, `controllers/vector-controller.ts`,
`routes/vector-routes.ts`, `config/indexable-collections.ts`. (Ils restent enregistrés mais ne sont
plus instanciés : bootstrap ne les appelle plus et `useRAG=false`.)

**Pour tester en local** : il faut une **clé Zhipu** (`ZHIPU_API_KEY`) — sans elle, le seul provider
configuré est skippé et le bot ne répond pas. Avec la clé : `npm run develop`, puis le chatbot du
portfolio répond en 1 appel Zhipu, contexte CV complet.
