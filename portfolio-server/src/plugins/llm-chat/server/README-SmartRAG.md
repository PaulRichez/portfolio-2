# SmartRAGTool - RAG Intelligent avec Ollama

## 🎯 Objectif

Le **SmartRAGTool** révolutionne l'utilisation du RAG (Retrieval-Augmented Generation) en utilisant l'intelligence artificielle pour décider automatiquement quand effectuer une recherche dans la base de données ChromaDB.

## 🧠 Intelligence Artificielle

### Modèle Utilisé
- **Nom** : `qwen3:0.6b` (Qwen 3 - 0.6 milliards de paramètres)
- **Taille** : ~522MB
- **Vitesse** : Très rapide (~100ms par analyse)
- **Précision** : Excellente pour l'analyse de pertinence

### Capacités d'Analyse
✅ **Détection automatique** de la pertinence des questions  
✅ **Extraction intelligente** des mots-clés  
✅ **Évaluation de confiance** (0-100%)  
✅ **Raisonnement expliqué** pour chaque décision  
✅ **Fallback robuste** en cas d'erreur  

## 🚀 Démarrage Rapide

### 1. Vérification du Système
```bash
# Vérifier que Ollama fonctionne
node src/plugins/llm-chat/server/scripts/check-ollama.js

# Test complet de l'intégration
node src/plugins/llm-chat/server/scripts/test-ollama-integration.js
```

### 2. Utilisation dans le Code
```typescript
import { SmartRAGTool } from '../tools/smart-rag-tool';

// Créer l'outil
const smartRAG = new SmartRAGTool(strapi);

// Analyser une question
const result = await smartRAG._call("Quels sont tes projets React ?");
console.log(result);
```

## 📊 Exemples d'Analyse IA

### ✅ Questions Nécessitant RAG
```typescript
// Question: "Quels sont tes projets React ?"
{
  shouldUseRAG: true,
  confidence: 0.95,
  keywords: ["projets", "React"],
  reasoning: "Question spécifique sur les projets avec technologie mentionnée"
}

// Question: "Comment te contacter ?"
{
  shouldUseRAG: true,
  confidence: 0.90,
  keywords: ["contact"],
  reasoning: "Demande d'informations de contact stockées en base"
}
```

### ❌ Questions Ne Nécessitant Pas RAG
```typescript
// Question: "Quel temps fait-il ?"
{
  shouldUseRAG: false,
  confidence: 0.98,
  keywords: [],
  reasoning: "Question météorologique non liée au portfolio"
}

// Question: "Que penses-tu de la politique ?"
{
  shouldUseRAG: false,
  confidence: 0.85,
  keywords: [],
  reasoning: "Question d'opinion générale non professionnelle"
}
```

## 🔧 Configuration

### Paramètres Ollama
```typescript
// Dans ollama-service.ts
const config = {
  baseUrl: 'http://localhost:11434',
  qwenModel: 'qwen3:0.6b',
  timeout: 10000
};

// Options de génération
const options = {
  temperature: 0.1,     // Faible pour cohérence
  num_ctx: 2048,        // Contexte suffisant
  top_p: 0.9           // Échantillonnage focused
};
```

### Prompt d'Analyse
Le prompt est optimisé pour `qwen3:0.6b` et guide précisément l'IA :

```
Tu es un système d'analyse intelligent qui détermine si une question 
nécessite une recherche dans une base de données de portfolio.

QUESTION À ANALYSER: "[question]"

CONTEXTE: La base de données contient...
- Projets de développement
- Compétences techniques  
- Expériences professionnelles
- Formation et éducation
- Informations de contact

RÉPONDS UNIQUEMENT au format JSON suivant :
{
  "shouldUseRAG": true/false,
  "confidence": 0.0-1.0,
  "keywords": ["mot1", "mot2"],
  "reasoning": "explication courte"
}
```

## 🛡️ Système de Fallback

En cas d'échec d'Ollama, le système bascule automatiquement :

```typescript
// Analyse manuelle de secours
private shouldUseRAGFallback(message: string): boolean {
  const portfolioKeywords = [
    'projet', 'projects', 'compétence', 'skills',
    'expérience', 'formation', 'contact',
    'react', 'vue', 'angular', 'nodejs', 'php'
  ];
  
  return portfolioKeywords.some(keyword => 
    message.toLowerCase().includes(keyword)
  );
}
```

## 📈 Performance et Monitoring

### Métriques Clés
- **Temps d'analyse** : <200ms (cible)
- **Taux de succès Ollama** : >95% (cible)
- **Précision des décisions** : >90% (évaluation manuelle)

### Logs de Surveillance
```
🤖 SmartRAGTool: Starting AI analysis with Ollama qwen3:0.6b
🧠 Ollama analysis result: { shouldUseRAG: true, confidence: 0.95 }
🎯 AI-generated search query: "projets React"
⏱️  SmartRAG AI Search: 45ms
✅ Found 3 relevant documents using AI analysis
```

### Santé du Système
```bash
# Check rapide
curl http://localhost:11434/api/tags

# Test des modèles
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model": "qwen3:0.6b", "prompt": "Test", "stream": false}'
```

## 🔄 Intégration avec LangChain

### Agent OpenAI (avec outils)
```typescript
const tools = [
  new SmartRAGTool(strapi),           // ✨ Principal - IA
  new ChromaRetrievalTool(strapi),    // 🔧 Support - Simple  
  new ChromaAdvancedRetrievalTool(strapi) // 🔧 Support - Avancé
];

const agent = await createOpenAIFunctionsAgent({
  llm: model,
  tools,
  prompt: agentPrompt
});
```

### Modèles Custom (RAG Smart)
```typescript
conversationChains.set(sessionId, {
  type: 'rag_smart',
  model: createModel(config, options),
  smartRAGTool: new SmartRAGTool(strapi),
  memory
});
```

## 🚨 Dépannage

### Problèmes Courants

#### 1. Ollama non accessible
```bash
# Vérifier le service
docker ps | grep ollama

# Redémarrer si nécessaire
docker-compose restart ollama
```

#### 2. Modèle manquant
```bash
# Installer qwen3:0.6b
docker exec portfolio-ollama ollama pull qwen3:0.6b

# Vérifier l'installation
docker exec portfolio-ollama ollama list
```

#### 3. Analyses incohérentes
- Vérifier la **température** (doit être basse: 0.1)
- Tester le **prompt** manuellement
- Considérer un **fine-tuning** si nécessaire

#### 4. Performance lente
- Vérifier les **ressources** Docker (RAM/CPU)
- Optimiser le **contexte** (num_ctx)
- Utiliser le **fallback** temporairement

### Logs d'Erreur Typiques
```
❌ Ollama analysis failed, using fallback: ECONNREFUSED
🔄 Fallback analysis used (Ollama error: Connection refused)
⚠️  No JSON found in Ollama response
```

## 📚 Ressources

### Documentation
- [Architecture RAG](./docs/RAG-INTEGRATION.md)
- [Configuration Ollama](./docs/OLLAMA-SETUP.md)
- [Prompts Templates](./prompts/)

### Scripts Utiles
- `check-ollama.js` - Vérification rapide
- `test-ollama-integration.js` - Tests complets
- `benchmark-models.js` - Comparaison de modèles

### Monitoring
- Logs Strapi : `/logs/`
- Métriques Ollama : `http://localhost:11434/`
- Tests automatisés : CI/CD pipeline

## 🎉 Avantages de cette Approche

### 🎯 **Intelligence**
- Décisions basées sur l'IA, pas sur des règles fixes
- Adaptation automatique aux nouveaux types de questions
- Amélioration continue de la précision

### ⚡ **Performance**
- Modèle léger et rapide (qwen3:0.6b)
- Cache des conversations pour éviter les re-analyses
- Fallback instantané en cas de problème

### 🔄 **Flexibilité**
- Compatible avec tous les providers LLM
- Extensible pour nouveaux domaines
- Configuration adaptable selon les besoins

### 🛡️ **Robustesse**
- Système de fallback automatique
- Logging complet pour le débogage
- Graceful degradation garantie

---

> 💡 **Note** : Ce système représente une évolution majeure vers un RAG véritablement intelligent, où l'IA décide elle-même quand et comment rechercher l'information pertinente.
