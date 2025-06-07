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
      const { message, sessionId, systemPrompt, maxTokens, temperature } = ctx.request.body;
      if (!message) {
        ctx.throw(400, 'Message is required');
      }

      const result = await strapi
        .plugin('llm-chat')
        .service('langchainService')
        .chat(message, { sessionId, systemPrompt, maxTokens, temperature });

      ctx.body = result;
    } catch (error) {
      ctx.throw(500, error.message);
    }
  },

  async getHistory(ctx) {
    try {
      const { sessionId } = ctx.request.query;

      const history = strapi
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
      const sessions = strapi
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

      const success = strapi
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
      const result = strapi
        .plugin('llm-chat')
        .service('langchainService')
        .clearAllHistory();

      ctx.body = result;
    } catch (error) {
      ctx.throw(500, error.message);
    }
  },
});

export default controller;
