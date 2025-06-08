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
      const { message, sessionId, maxTokens } = ctx.request.body;

      if (!message) {
        return ctx.badRequest('Message is required');
      }

      const options = {
        sessionId,
        maxTokens: maxTokens ? parseInt(maxTokens) : undefined,
      };

      // Pour l'instant, utiliser la méthode chat normale
      // Plus tard, on pourra implémenter un vrai streaming avec WebSockets
      const result = await strapi
        .plugin('llm-chat')
        .service('langchainService')
        .chat(message, options);

      ctx.body = {
        response: result.response,
        sessionId: result.sessionId,
        streaming: true // Indicateur pour le frontend
      };

    } catch (error) {
      strapi.log.error('Error in stream controller:', error);
      ctx.throw(500, error.message);
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
