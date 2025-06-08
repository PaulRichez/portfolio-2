# Intégration ChromaDB + LangChain

Cette intégration permet au chatbot LangChain de rechercher automatiquement des informations pertinentes dans votre base de données vectorielle ChromaDB lorsque les utilisateurs posent des questions sur votre portfolio.

## 🚀 Fonctionnalités

### RAG (Retrieval-Augmented Generation)
- **Recherche automatique** : Le chatbot recherche automatiquement dans ChromaDB quand c'est pertinent
- **Réponses enrichies** : Les réponses incluent des informations précises de votre base de données
- **Contexte intelligent** : Le système comprend quand utiliser ou non la recherche

### Outils LangChain créés
1. **ChromaRetrievalTool** : Recherche basique dans ChromaDB
2. **ChromaAdvancedRetrievalTool** : Recherche avancée avec filtres

## 📋 Prérequis

1. **ChromaDB configuré** : Votre service `chromaVectorService` doit être opérationnel
2. **Données indexées** : Vos projets et informations personnelles doivent être indexés dans ChromaDB
3. **OpenAI configuré** : L'agent avec outils nécessite OpenAI (les modèles custom ne supportent pas les outils)

## 🛠️ Configuration

### 1. Variables d'environnement
```bash
# ChromaDB
CHROMA_URL=http://localhost:8001
CHROMA_COLLECTION=strapi-rag

# Ollama pour les embeddings
OLLAMA_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# OpenAI pour l'agent (requis pour les outils)
OPENAI_API_KEY=your-api-key
```

### 2. Configuration du plugin
```javascript
// config/plugins.ts
'llm-chat': {
  enabled: true,
  config: {
    default: {
      provider: 'openai', // Requis pour l'agent avec outils
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        modelName: 'gpt-4-turbo-preview',
        temperature: 0.7
      }
    }
  }
}
```

## 🎯 Utilisation

### 1. Chat avec RAG activé (par défaut)
```javascript
const response = await strapi.plugin('llm-chat').service('langchainService').chat(
  "Quels sont tes projets React ?",
  {
    sessionId: 'user-123',
    useRAG: true // Optionnel, activé par défaut
  }
);
```

### 2. Chat sans RAG
```javascript
const response = await strapi.plugin('llm-chat').service('langchainService').chat(
  "Bonjour, comment allez-vous ?",
  {
    sessionId: 'user-123',
    useRAG: false // Désactive la recherche ChromaDB
  }
);
```

### 3. Chat avec prompt personnalisé
```javascript
const response = await strapi.plugin('llm-chat').service('langchainService').chat(
  "Parle-moi de ton expérience",
  {
    sessionId: 'user-123',
    systemPrompt: `Tu es un développeur qui présente son portfolio professionnel.
    Utilise les outils de recherche pour trouver des informations précises.`,
    useRAG: true
  }
);
```

## 🔧 Fonctionnement technique

### 1. Détection automatique des besoins
Le chatbot analyse automatiquement si la question de l'utilisateur nécessite une recherche :
- Questions sur les projets → Recherche dans ChromaDB
- Questions sur les compétences → Recherche dans ChromaDB  
- Questions générales → Conversation normale

### 2. Outils disponibles

#### ChromaRetrievalTool
- **Nom** : `chroma_search`
- **Usage** : Recherche simple dans toute la base
- **Paramètre** : Requête en texte (string)

#### ChromaAdvancedRetrievalTool  
- **Nom** : `chroma_advanced_search`
- **Usage** : Recherche avec filtres
- **Paramètre** : JSON avec query, limit, collection

### 3. Format des résultats
Les résultats incluent :
- **Contenu** : Texte indexé du document
- **Métadonnées** : Liens GitHub, démos, contact, etc.
- **Score de pertinence** : Similarité sémantique
- **Type de contenu** : Projet, profil, article, etc.

## 📊 Types de questions supportées

### ✅ Questions qui déclenchent la recherche ChromaDB
- "Quels sont tes projets ?"
- "Montre-moi tes compétences React"
- "Comment te contacter ?"
- "Parle-moi de ton expérience"
- "Quels projets utilisent Next.js ?"

### ✅ Questions de conversation normale
- "Bonjour, comment allez-vous ?"
- "Quel temps fait-il ?"
- "Peux-tu m'aider avec du code ?"
- "Explique-moi React"

## 🧪 Tests et debugging

### 1. Vérifier ChromaDB
```javascript
const chromaService = strapi.plugin('llm-chat').service('chromaVectorService');
const stats = await chromaService.getStats();
console.log('Documents indexés:', stats);
```

### 2. Tester la recherche
```javascript
const results = await chromaService.searchDocuments("React projects", 5);
console.log('Résultats:', results);
```

### 3. Tester les outils
```javascript
const { ChromaRetrievalTool } = require('./tools/chroma-retrieval-tool');
const tool = new ChromaRetrievalTool(strapi);
const result = await tool._call("projets web");
console.log('Résultat outil:', result);
```

### 4. Script de test complet
```bash
cd src/plugins/llm-chat/server/src/examples
node test-chroma-integration.js
```

## 🔍 Troubleshooting

### Problème : L'agent ne trouve pas d'informations
**Solutions :**
1. Vérifier que ChromaDB contient des données indexées
2. Réindexer les données : `GET /api/llm-chat/chroma/reindex`
3. Tester la recherche directe dans ChromaDB

### Problème : Erreur "OpenAI Functions not supported"
**Solutions :**
1. Utiliser `provider: 'openai'` dans la configuration
2. Les modèles custom ne supportent pas les outils LangChain

### Problème : Recherche trop générale
**Solutions :**
1. Améliorer les prompts système
2. Ajuster les seuils de similarité
3. Utiliser l'outil avancé avec filtres

## 📈 Optimisations

### 1. Performance
- Cache des résultats fréquents
- Limitation du nombre de résultats (limit)
- Seuils de similarité appropriés

### 2. Qualité des réponses
- Prompts système détaillés
- Métadonnées enrichies
- Classification des types de questions

### 3. Indexation
- Réindexation régulière
- Mise à jour en temps réel des modifications
- Optimisation des champs indexés

## 🔄 Maintenance

### Réindexation automatique
Les données sont automatiquement réindexées quand :
- Un projet est créé/modifié/supprimé
- Les informations personnelles sont mises à jour
- Une réindexation manuelle est lancée

### Monitoring
- Logs détaillés des recherches
- Statistiques d'utilisation des outils
- Métriques de performance ChromaDB

## 🎨 Personnalisation

Vous pouvez personnaliser :
1. **Collections indexées** : Modifier `INDEXABLE_COLLECTIONS` dans `chroma-vector-service.ts`
2. **Prompts système** : Adapter les instructions pour l'agent
3. **Outils supplémentaires** : Créer d'autres outils LangChain
4. **Logique de déclenchement** : Modifier quand utiliser la recherche
