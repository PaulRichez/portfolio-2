/**
 * Smart RAG System avec Ollama qwen3:0.6b
 * =====================================
 *
 * Le système RAG intelligent utilise Ollama avec le modèle qwen3:0.6b pour déterminer
 * automatiquement quand une recherche dans ChromaDB est nécessaire.
 *
 * Architecture:
 *
 * 1. **SmartRAGTool** (outil principal et unique)
 *    - Utilise Ollama qwen3:0.6b pour analyser les questions
 *    - Détermine automatiquement si une recherche RAG est nécessaire
 *    - Extrait les mots-clés optimaux avec l'IA
 *    - Effectue la recherche ChromaDB si pertinent
 *    - Formate intelligemment les résultats
 *    - Fallback vers analyse manuelle si Ollama échoue
 *
 * 2. **Services intégrés:**
 *    - ollamaService: Interface avec le modèle qwen3:0.6b
 *    - chromaVectorService: Recherche vectorielle avec embeddings
 *    - langchainService: Orchestration des outils LangChain
 *
 * Avantages de cette approche unifiée:
 * - Analyse IA intelligente vs détection manuelle par mots-clés
 * - Confiance et reasoning pour chaque décision
 * - Extraction dynamique des mots-clés par IA
 * - Adaptation automatique du nombre de résultats
 * - Robustesse avec fallback en cas d'erreur Ollama
 * - Interface simplifiée avec un seul outil principal
 *
 * Configuration Ollama:
 * - Modèle: qwen3:0.6b (optimisé pour les décisions RAG)
 * - URL: http://localhost:11434 (par défaut)
 * - Timeout: 10 secondes
 * - Température: 0.1 (réponses cohérentes)
 *
 * Ancien système supprimé:
 * - ChromaRetrievalTool (remplacé par SmartRAGTool)
 * - ChromaAdvancedRetrievalTool (fonctionnalités intégrées dans SmartRAGTool)
 * - Logique manuelle de détection par mots-clés (gardée en fallback)
 *
 * Utilisation:
 * Le SmartRAGTool est automatiquement utilisé par l'agent LangChain quand une
 * question nécessite potentiellement une recherche contextuelle. L'IA détermine
 * la pertinence et effectue la recherche de manière autonome.
 */

export interface SmartRAGAnalysis {
  shouldUseRAG: boolean;
  confidence: number;
  keywords: string[];
  reasoning: string;
}

export interface RAGSystemConfig {
  ollamaUrl: string;
  chromaUrl: string;
  qwenModel: string;
  timeout: number;
}
