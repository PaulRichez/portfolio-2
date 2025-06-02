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
      const { message } = ctx.request.body;
      if (!message) {
        ctx.throw(400, 'Message is required');
      }

      const response = await strapi
        .plugin('llm-chat')
        .service('langchainService')
        .createChat(message);

      ctx.body = { response };
    } catch (error) {
      ctx.throw(500, error.message);
    }
  },
});

export default controller;
