import type { Core } from '@strapi/strapi';

/**
 * Service pour intégrer Ollama et ses modèles
 */
const ollamaService = ({ strapi }: { strapi: Core.Strapi }) => {

  // Configuration par défaut d'Ollama
  const getOllamaConfig = () => {
    const pluginConfig = strapi.config.get('plugin::llm-chat') || strapi.plugin('llm-chat').config('default');
    const config = pluginConfig as any;
    return {
      baseUrl: config?.ollama?.baseUrl || process.env.CUSTOM_LLM_BASE_URL || 'http://localhost:11434',
      qwenModel: config?.ollama?.modelName || 'qwen2.5:1.5b'
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

      // 1. FAST PATH: Regex immediate analysis
      // This drastically speeds up the RAG check for common queries
      const fastPathKeywords = extractBasicKeywords(userMessage);

      // Check for common non-RAG queries (greetings, simple tests) to skip RAG immediately
      const skipKeywords = ['test', 'bonjour', 'salut', 'hello', 'coucou', 'hola', 'hi', 'ça va', 'ca va'];
      const lowerMsg = userMessage.toLowerCase().trim();
      const shouldSkipRAG = skipKeywords.some(k => lowerMsg === k || lowerMsg.startsWith(k + ' ') || lowerMsg.endsWith(' ' + k));

      if (shouldSkipRAG) {
        console.log('⚡ Fast Path: Skip RAG detected (greeting/test)');
        return {
          shouldUseRAG: false,
          confidence: 1.0,
          keywords: [],
          reasoning: 'Fast path: greeting or test detected'
        };
      }

      if (fastPathKeywords.length > 0) {
        console.log('⚡ Fast Path RAG detection: Keywords found, skipping Ollama analysis');

        return {
          shouldUseRAG: true,
          confidence: 1.0,
          keywords: fastPathKeywords,
          reasoning: `Fast Path detection (found: ${fastPathKeywords.join(', ')})`
        };
      }

      // 2. SLOW PATH: Use Ollama for ambiguous queries
      // Removed connection test to save latency - let it fail into catch block if offline
      // console.log('🔍 Testing Ollama connection for deep analysis...');
      // const isConnected = await testConnectionQuick();
      // ...

      // Prompt ultra-court optimisé pour qwen3:0.6b utilisé par PaulIA
      const analysisPrompt = `Question: "${userMessage}"

PaulIA's database contains: Paul's projects, skills, experience, education, contact info.

JSON response format:
{"shouldUseRAG": true/false, "confidence": 0.9, "keywords": ["word1", "word2"]}

Examples:
"Paul's React projects?" → {"shouldUseRAG": true, "confidence": 0.9, "keywords": ["projects", "React"]}
"Weather?" → {"shouldUseRAG": false, "confidence": 0.9, "keywords": []}
"Contact Paul?" → {"shouldUseRAG": true, "confidence": 0.9, "keywords": ["contact"]}

Response:`;

      console.log(`🧠 PaulIA analyzing with Ollama ${config.qwenModel}...`);

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

      console.log('✅ PaulIA Ollama analysis result:', result);
      console.timeEnd(timerId);
      return result;

    } catch (error) {
      console.timeEnd(timerId);
      console.error('❌ PaulIA Ollama analysis failed:', error);

      // Fallback à l'analyse manuelle pour PaulIA en cas d'erreur
      const shouldUseRAG = manualKeywordAnalysis(userMessage);

      return {
        shouldUseRAG,
        confidence: 0.8, // Confiance élevée pour le fallback de PaulIA
        keywords: shouldUseRAG ? extractBasicKeywords(userMessage) : [],
        reasoning: `PaulIA fallback: ${error instanceof Error ? error.message.substring(0, 50) : 'error'}`
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
    // Tech keywords
    const techKeywords = [
      'react', 'vue', 'angular', 'php', 'python', 'javascript', 'typescript', 'node', 'nodejs',
      'html', 'css', 'sass', 'scss', 'tailwind', 'bootstrap', 'sql', 'mysql', 'postgres', 'mongodb',
      'docker', 'aws', 'cloud', 'api', 'rest', 'graphql', 'git'
    ];

    // Core portfolio context keywords
    const contextKeywords = [
      'projet', 'project', 'réalisations', 'realisations', 'démo', 'demo',
      'compétence', 'skill', 'techno', 'stack', 'maîtrise', 'niveau',
      'expérience', 'experience', 'parcours', 'curriculum', 'cv', 'background',
      'formation', 'education', 'diplôme', 'étude', 'école',
      'contact', 'email', 'mail', 'téléphone', 'tel', 'phone', 'linkedin', 'github',
      'mission', 'travail', 'poste', 'stage', 'alternance',
      'qui es-tu', 'présente-toi', 'ton nom', 't\'appelles',
      'âge', 'age', 'naissance', 'birth', 'né en', 'years old'
    ];

    const lowerMessage = message.toLowerCase();
    const found: string[] = [];

    // Check strict inclusion
    [...techKeywords, ...contextKeywords].forEach(keyword => {
      // Logic for word boundaries or simple inclusion depending on keyword length
      if (keyword.length > 3) {
        if (lowerMessage.includes(keyword)) found.push(keyword);
      } else {
        // for short words like 'cv', 'git', use word boundary check
        if (new RegExp(`\\b${keyword}\\b`, 'i').test(lowerMessage)) found.push(keyword);
      }
    });

    return [...new Set(found)]; // Deduplicate
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
