import type { Core } from '@strapi/strapi';

const bootstrap = ({ strapi }: { strapi: Core.Strapi }) => {
  // bootstrap phase
  console.log('LLM Chat plugin bootstrap complete');
};

export default bootstrap;
