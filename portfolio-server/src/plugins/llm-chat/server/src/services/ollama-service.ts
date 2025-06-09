import type { Core } from '@strapi/strapi';

/**
 * Service pour intégrer Ollama et ses modèles
 */
const ollamaService = ({ strapi }: { strapi: Core.Strapi }) => {

  // Configuration par défaut d'Ollama
  const getOllamaConfig = () => {
    const pluginConfig = strapi.config.get('plugin::llm-chat') || strapi.plugin('llm-chat').config('default');
    const config = pluginConfig as any; // Type assertion pour éviter les erreurs TypeScript
    return {
      baseUrl: config?.custom?.baseUrl || 'http://localhost:11434',
      qwenModel: 'qwen3:0.6b'
    };
  };

  /**
   * Appelle le modèle qwen3:0.6b pour analyser si le RAG est nécessaire
   */
  const shouldUseRAGWithOllama = async (userMessage: string): Promise<{
    shouldUseRAG: boolean;
    confidence: number;
    keywords: string[];
    reasoning: string;
  }> => {
    const timerId = `🧠 Ollama RAG Analysis [${Date.now()}]`;
    console.time(timerId);

    try {
      const config = getOllamaConfig();

      // Test rapide de connexion avant d'essayer l'analyse
      console.log('🔍 Testing Ollama connection...');
      const isConnected = await testConnectionQuick();
      if (!isConnected) {
        console.log('⚠️ Ollama not available, using fallback analysis');
        const shouldUseRAG = manualKeywordAnalysis(userMessage);
        console.timeEnd(timerId);
        return {
          shouldUseRAG,
          confidence: 0.8,
          keywords: shouldUseRAG ? extractBasicKeywords(userMessage) : [],
          reasoning: 'Fallback analysis'
        };
      }

      // Prompt ultra-court optimisé pour qwen3:0.6b
      const analysisPrompt = `Question: "${userMessage}"

Portfolio database contains: projects, skills, experience, education, contact.

JSON response format:
{"shouldUseRAG": true/false, "confidence": 0.9, "keywords": ["word1", "word2"]}

Examples:
"React projects?" → {"shouldUseRAG": true, "confidence": 0.9, "keywords": ["projects", "React"]}
"Weather?" → {"shouldUseRAG": false, "confidence": 0.9, "keywords": []}
"Contact?" → {"shouldUseRAG": true, "confidence": 0.9, "keywords": ["contact"]}

Response:`;

      console.log('🧠 Analyzing with Ollama qwen3:0.6b...');

      const requestBody = {
        model: config.qwenModel,
        prompt: analysisPrompt,
        stream: false,
        think: false,
        options: {
          temperature: 0.0, // Température très basse pour des réponses déterministes
          num_ctx: 512, // Contexte réduit de moitié
          top_p: 0.1, // Plus restrictif pour accélérer
          top_k: 10, // Limite les choix pour accélérer
          repeat_penalty: 1.0
        }
      };

      // Utiliser fetch sans AbortController comme dans langchain-service
      const response = await fetch(`${config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any; // Type assertion pour éviter les erreurs TypeScript
      const ollamaResponse = data.response;

      console.log('🎯 Ollama raw response:', ollamaResponse);

      // Parser la réponse JSON
      const jsonMatch = ollamaResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Ollama response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Validation et fallback
      const result = {
        shouldUseRAG: Boolean(analysis.shouldUseRAG),
        confidence: Math.max(0, Math.min(1, Number(analysis.confidence) || 0.9)),
        keywords: Array.isArray(analysis.keywords) ? analysis.keywords : [],
        reasoning: 'Fast analysis' // Reasoning simplifié
      };

      console.log('✅ Ollama analysis result:', result);
      console.timeEnd(timerId);
      return result;

    } catch (error) {
      console.timeEnd(timerId);
      console.error('❌ Ollama analysis failed:', error);

      // Fallback à l'analyse manuelle en cas d'erreur
      const shouldUseRAG = manualKeywordAnalysis(userMessage);

      return {
        shouldUseRAG,
        confidence: 0.8, // Confiance élevée pour le fallback
        keywords: shouldUseRAG ? extractBasicKeywords(userMessage) : [],
        reasoning: `Fallback: ${error instanceof Error ? error.message.substring(0, 50) : 'error'}`
      };
    }
  };

  /**
   * Analyse manuelle de fallback
   */
  const manualKeywordAnalysis = (message: string): boolean => {
    const portfolioKeywords = [
      'projet', 'projects', 'compétence', 'skills', 'expérience', 'experience',
      'formation', 'education', 'contact', 'portfolio', 'cv', 'profil',
      'react', 'vue', 'angular', 'php', 'python', 'javascript', 'typescript',
      'développé', 'développement', 'créé', 'réalisation', 'technologies'
    ];

    const lowerMessage = message.toLowerCase();
    return portfolioKeywords.some(keyword => lowerMessage.includes(keyword));
  };

  /**
   * Extraction basique de mots-clés pour le fallback
   */
  const extractBasicKeywords = (message: string): string[] => {
    const techKeywords = ['react', 'vue', 'angular', 'php', 'python', 'javascript', 'typescript'];
    const contextKeywords = ['projet', 'compétence', 'expérience', 'formation', 'contact'];

    const lowerMessage = message.toLowerCase();
    const found: string[] = [];

    [...techKeywords, ...contextKeywords].forEach(keyword => {
      if (lowerMessage.includes(keyword)) {
        found.push(keyword);
      }
    });

    return found;
  };

  /**
   * Test de connexion Ollama rapide
   */
  const testConnectionQuick = async (): Promise<boolean> => {
    try {
      const config = getOllamaConfig();
      const response = await fetch(`${config.baseUrl}/api/tags`, {
        method: 'GET'
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  };

  /**
   * Test de connexion Ollama
   */
  const testConnection = async (): Promise<boolean> => {
    try {
      const config = getOllamaConfig();
      const response = await fetch(`${config.baseUrl}/api/tags`, {
        method: 'GET'
      });

      return response.ok;
    } catch (error) {
      console.error('❌ Ollama connection test failed:', error);
      return false;
    }
  };

  /**
   * Vérifier si le modèle qwen3:0.6b est disponible
   */
  const checkQwenModel = async (): Promise<boolean> => {
    try {
      const config = getOllamaConfig();
      const response = await fetch(`${config.baseUrl}/api/tags`);

      if (!response.ok) return false;

      const data = await response.json() as any; // Type assertion pour éviter les erreurs TypeScript
      const models = data.models || [];

      return models.some((model: any) => model.name === config.qwenModel);
    } catch (error) {
      console.error('❌ Failed to check qwen model:', error);
      return false;
    }
  };

  return {
    shouldUseRAGWithOllama,
    testConnection,
    testConnectionQuick,
    checkQwenModel,
    getOllamaConfig
  };
};

export default ollamaService;
