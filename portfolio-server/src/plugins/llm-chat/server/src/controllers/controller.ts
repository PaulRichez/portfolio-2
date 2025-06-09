import type { Core } from '@strapi/strapi';

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  index(ctx) {
    ctx.body = strapi
      .plugin('llm-chat')
      .service('service')
      .getWelcomeMessage();
  },

  async chat(ctx) {
    try {
      const { message, sessionId, maxTokens } = ctx.request.body;

      if (!message) {
        ctx.throw(400, 'Message is required');
      }

      const timerId = `🎯 Chat Controller [${sessionId || Date.now()}]`;
      console.time(timerId);

      const result = await strapi
        .plugin('llm-chat')
        .service('langchainService')
        .chat(message, { sessionId, maxTokens });

      console.timeEnd(timerId);
      ctx.body = result;
    } catch (error) {
      console.error('❌ Error in chat controller:', error);
      ctx.throw(500, error.message);
    }
  },

  async stream(ctx) {
    try {
      // Support des deux méthodes : GET (EventSource) et POST
      let message, sessionId, maxTokens;
      console.log(`🌐 Request method: ${ctx.request.method}`);
      if (ctx.request.method === 'GET') {
        // EventSource utilise GET avec query parameters
        ({ message, sessionId, maxTokens } = ctx.request.query);
      } else {
        // POST avec FormData
        if (ctx.request.body instanceof FormData || ctx.is('multipart')) {
          const body = ctx.request.body;
          message = body.get ? body.get('message') : body.message;
          sessionId = body.get ? body.get('sessionId') : body.sessionId;
          maxTokens = body.get ? body.get('maxTokens') : body.maxTokens;
        } else {
          ({ message, sessionId, maxTokens } = ctx.request.body);
        }
      }

      if (!message) {
        return ctx.badRequest('Message is required');
      }

      const options = {
        sessionId,
        maxTokens: maxTokens ? parseInt(maxTokens) : undefined,
      };

      console.log(`🌊 Starting stream for session: ${sessionId}`);

      // Configurer les headers pour Server-Sent Events
      const allowedOrigins = [
        'https://paulrichez.fr',
        'http://localhost:4201',
        'http://localhost:3000'
      ];

      const origin = ctx.request.header.origin;

      if (allowedOrigins.includes(origin)) {
        ctx.set('Access-Control-Allow-Origin', origin);
      }
      ctx.set({
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Définir le status avant de désactiver ctx.respond
      ctx.status = 200;

      // Obtenir le générateur de streaming
      const streamResult = await strapi
        .plugin('llm-chat')
        .service('langchainService')
        .streamChat(message, options);

      let fullResponse = '';

      // Utiliser Koa response stream
      ctx.respond = false; // Bypass Koa's built-in response handling

      try {
        // Envoyer un événement de démarrage
        ctx.res.write(`data: ${JSON.stringify({ type: 'start', sessionId: streamResult.sessionId })}\n\n`);

        // Traiter le streaming
        for await (const chunk of streamResult.stream()) {
          console.log('🧩 Raw chunk from service:', chunk);

          // Le chunk peut être soit une string simple, soit un objet
          let chunkContent = '';

          if (typeof chunk === 'string') {
            if (chunk.includes('[DONE]')) {
              // Fin du streaming
              ctx.res.write(`data: ${JSON.stringify({
                type: 'complete',
                sessionId: streamResult.sessionId,
                response: fullResponse
              })}\n\n`);
              break;
            } else if (chunk.startsWith('data: ')) {
              // Format SSE - extraire le contenu JSON
              try {
                const jsonStr = chunk.replace('data: ', '');
                const chunkData = JSON.parse(jsonStr);
                chunkContent = chunkData.content || chunkData.text || '';
              } catch (parseError) {
                console.warn('⚠️ Could not parse chunk as JSON:', chunk);
                chunkContent = chunk.replace('data: ', '');
              }
            } else {
              // String simple
              chunkContent = chunk;
            }
          } else if (typeof chunk === 'object' && chunk !== null) {
            // Objet direct
            chunkContent = chunk.content || chunk.text || '';
          }

          if (chunkContent && chunkContent.trim()) {
            fullResponse += chunkContent;
            ctx.res.write(`data: ${JSON.stringify({
              type: 'chunk',
              content: chunkContent
            })}\n\n`);
          }
        }

        // Si on arrive ici sans avoir envoyé 'complete', l'envoyer maintenant
        if (!fullResponse.includes('[DONE]')) {
          ctx.res.write(`data: ${JSON.stringify({
            type: 'complete',
            sessionId: streamResult.sessionId,
            response: fullResponse
          })}\n\n`);
        }

        console.log('✅ Stream completed successfully');
        ctx.res.end();
      } catch (streamError) {
        console.error('❌ Streaming error:', streamError);
        ctx.res.write(`data: ${JSON.stringify({
          type: 'error',
          message: streamError.message
        })}\n\n`);
        ctx.res.end();
      }

    } catch (error) {
      console.error('❌ Error in stream controller:', error);
      // Si les headers n'ont pas encore été envoyés, on peut encore utiliser ctx.throw
      if (!ctx.headerSent) {
        ctx.throw(500, error.message);
      } else {
        // Sinon, écrire l'erreur dans le stream
        try {
          ctx.res.write(`data: ${JSON.stringify({
            type: 'error',
            message: error.message
          })}\n\n`);
          ctx.res.end();
        } catch (writeError) {
          console.error('❌ Error writing to response:', writeError);
        }
      }
    }
  },

  async getHistory(ctx) {
    try {
      const { sessionId } = ctx.request.query;

      const history = await strapi
        .plugin('llm-chat')
        .service('langchainService')
        .getHistory(sessionId);

      ctx.body = history;
    } catch (error) {
      ctx.throw(500, error.message);
    }
  },

  async getAllSessions(ctx) {
    try {
      const sessions = await strapi
        .plugin('llm-chat')
        .service('langchainService')
        .getAllSessions();

      ctx.body = { sessions };
    } catch (error) {
      ctx.throw(500, error.message);
    }
  },

  async clearHistory(ctx) {
    try {
      const { sessionId } = ctx.request.query;

      const success = await strapi
        .plugin('llm-chat')
        .service('langchainService')
        .clearHistory(sessionId);

      ctx.body = { success, sessionId };
    } catch (error) {
      ctx.throw(500, error.message);
    }
  },

  async clearAllHistory(ctx) {
    try {
      const result = await strapi
        .plugin('llm-chat')
        .service('langchainService')
        .clearAllHistory();

      ctx.body = result;
    } catch (error) {
      ctx.throw(500, error.message);
    }
  },

  async deleteSession(ctx) {
    try {
      const { sessionId } = ctx.params;

      const success = await strapi
        .plugin('llm-chat')
        .service('langchainService')
        .deleteSession(sessionId);

      ctx.body = { success, sessionId };
    } catch (error) {
      ctx.throw(500, error.message);
    }
  },

  async updateSessionTitle(ctx) {
    try {
      const { sessionId } = ctx.params;
      const { title } = ctx.request.body;

      if (!title) {
        ctx.throw(400, 'Title is required');
      }

      const success = await strapi
        .plugin('llm-chat')
        .service('langchainService')
        .updateSessionTitle(sessionId, title);

      ctx.body = { success, sessionId, title };
    } catch (error) {
      ctx.throw(500, error.message);
    }
  },
});

export default controller;
