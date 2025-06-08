/**
 * Exemple d'endpoints API pour utiliser l'intégration ChromaDB + LangChain
 *
 * Ces endpoints peuvent être ajoutés à votre contrôleur existant
 */

// Exemple d'ajout dans le contrôleur chat
const chatController = {
  // ...autres méthodes existantes...

  /**
   * Chat avec RAG activé par défaut
   * POST /api/llm-chat/chat-with-rag
   */
  async chatWithRAG(ctx) {
    try {
      const { message, sessionId, useRAG = true, systemPrompt } = ctx.request.body;

      if (!message) {
        return ctx.badRequest('Message is required');
      }

      const langchainService = strapi.plugin('llm-chat').service('langchainService');

      const response = await langchainService.chat(message, {
        sessionId: sessionId || ctx.state.user?.id?.toString() || 'anonymous',
        useRAG,
        systemPrompt
      });

      ctx.body = {
        success: true,
        data: {
          response: response.response,
          sessionId: response.sessionId,
          hasContextualInfo: response.response.includes('=== Informations trouvées'), // Indicateur si ChromaDB a été utilisé
          messageCount: response.history?.length || 0
        }
      };
    } catch (error) {
      strapi.log.error('Error in chatWithRAG:', error);
      ctx.internalServerError('Failed to process chat with RAG');
    }
  },

  /**
   * Chat intelligent qui détecte automatiquement le besoin de RAG
   * POST /api/llm-chat/smart-chat
   */
  async smartChat(ctx) {
    try {
      const { message, sessionId, systemPrompt } = ctx.request.body;

      if (!message) {
        return ctx.badRequest('Message is required');
      }

      // Logique pour décider si on a besoin de RAG
      const needsRAG = this.shouldUseRAG(message);

      const langchainService = strapi.plugin('llm-chat').service('langchainService');

      const response = await langchainService.chat(message, {
        sessionId: sessionId || ctx.state.user?.id?.toString() || 'anonymous',
        useRAG: needsRAG,
        systemPrompt: systemPrompt || (needsRAG ? this.getPortfolioPrompt() : this.getGeneralPrompt())
      });

      ctx.body = {
        success: true,
        data: {
          response: response.response,
          sessionId: response.sessionId,
          usedRAG: needsRAG,
          messageCount: response.history?.length || 0
        }
      };
    } catch (error) {
      strapi.log.error('Error in smartChat:', error);
      ctx.internalServerError('Failed to process smart chat');
    }
  },

  /**
   * Test direct des outils ChromaDB
   * POST /api/llm-chat/test-chroma-tools
   */
  async testChromaTools(ctx) {
    try {
      const { query, tool = 'basic', options = {} } = ctx.request.body;

      if (!query) {
        return ctx.badRequest('Query is required');
      }

      const { ChromaRetrievalTool, ChromaAdvancedRetrievalTool } = require('../tools/chroma-retrieval-tool');

      let result;
      if (tool === 'advanced') {
        const advancedTool = new ChromaAdvancedRetrievalTool(strapi);
        result = await advancedTool._call(JSON.stringify({ query, ...options }));
      } else {
        const basicTool = new ChromaRetrievalTool(strapi);
        result = await basicTool._call(query);
      }

      ctx.body = {
        success: true,
        data: {
          query,
          tool,
          result,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      strapi.log.error('Error testing chroma tools:', error);
      ctx.internalServerError('Failed to test chroma tools');
    }
  },

  /**
   * Recherche directe dans ChromaDB sans LLM
   * GET /api/llm-chat/search
   */
  async searchChroma(ctx) {
    try {
      const { q: query, limit = 5, collection } = ctx.query;

      if (!query) {
        return ctx.badRequest('Query parameter "q" is required');
      }

      const chromaService = strapi.plugin('llm-chat').service('chromaVectorService');
      const results = await chromaService.searchDocuments(query, parseInt(limit));

      // Filtrer par collection si spécifié
      let filteredResults = results;
      if (collection) {
        filteredResults = results.filter(result =>
          result.metadata?.collection === collection
        );
      }

      ctx.body = {
        success: true,
        data: {
          query,
          collection: collection || 'all',
          totalResults: results.length,
          filteredResults: filteredResults.length,
          results: filteredResults.map(result => ({
            id: result.id,
            content: result.document,
            collection: result.metadata?.collection,
            similarity: (1 - result.distance).toFixed(3),
            metadata: result.metadata
          }))
        }
      };
    } catch (error) {
      strapi.log.error('Error searching chroma:', error);
      ctx.internalServerError('Failed to search ChromaDB');
    }
  },

  // Méthodes utilitaires
  shouldUseRAG(message) {
    const portfolioKeywords = [
      'projet', 'projects', 'compétence', 'skills', 'expérience', 'experience',
      'formation', 'education', 'contact', 'réalisation', 'portfolio',
      'technologie', 'technology', 'développement', 'development',
      'react', 'vue', 'angular', 'nodejs', 'php', 'python',
      'qui es-tu', 'présente', 'cv', 'profil'
    ];

    const lowerMessage = message.toLowerCase();
    return portfolioKeywords.some(keyword => lowerMessage.includes(keyword));
  },

  getPortfolioPrompt() {
    return `Tu es un assistant IA qui présente le portfolio d'un développeur web.

INSTRUCTIONS :
1. Utilise l'outil 'chroma_search' pour rechercher des informations pertinentes
2. Réponds en français de manière professionnelle mais accessible
3. Inclus les liens et détails techniques quand ils sont disponibles
4. Si aucune information n'est trouvée, dis-le clairement
5. Mets en valeur les compétences et réalisations

Tu peux rechercher des informations sur :
- Les projets de développement web et mobile
- Les compétences techniques et frameworks
- L'expérience professionnelle et formations
- Les coordonnées et liens sociaux`;
  },

  getGeneralPrompt() {
    return `Tu es un assistant IA utile et bienveillant.
    Réponds en français de manière naturelle et conversationnelle.
    Si l'utilisateur pose des questions sur le portfolio ou les projets,
    suggère d'utiliser des mots-clés plus spécifiques pour obtenir des informations détaillées.`;
  }
};

// Exemple d'endpoints à ajouter dans les routes
const additionalRoutes = [
  {
    method: 'POST',
    path: '/chat-with-rag',
    handler: 'chat.chatWithRAG',
    config: {
      policies: [],
      middlewares: [],
    },
  },
  {
    method: 'POST',
    path: '/smart-chat',
    handler: 'chat.smartChat',
    config: {
      policies: [],
      middlewares: [],
    },
  },
  {
    method: 'POST',
    path: '/test-chroma-tools',
    handler: 'chat.testChromaTools',
    config: {
      policies: [],
      middlewares: [],
    },
  },
  {
    method: 'GET',
    path: '/search',
    handler: 'chat.searchChroma',
    config: {
      policies: [],
      middlewares: [],
    },
  }
];

// Exemple d'utilisation côté client (JavaScript)
const clientExamples = {
  // Chat avec RAG
  async chatWithRAG(message, sessionId) {
    const response = await fetch('/api/llm-chat/chat-with-rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId })
    });
    return response.json();
  },

  // Chat intelligent
  async smartChat(message, sessionId) {
    const response = await fetch('/api/llm-chat/smart-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId })
    });
    return response.json();
  },

  // Recherche directe
  async searchPortfolio(query, limit = 5) {
    const response = await fetch(`/api/llm-chat/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return response.json();
  },

  // Test des outils
  async testTools(query, tool = 'basic') {
    const response = await fetch('/api/llm-chat/test-chroma-tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, tool })
    });
    return response.json();
  }
};

module.exports = {
  chatController,
  additionalRoutes,
  clientExamples
};
