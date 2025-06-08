import type { Core } from '@strapi/strapi';

const bootstrap = ({ strapi }: { strapi: Core.Strapi }) => {
  // Initialiser le service ChromaDB
  try {
    strapi.plugin('llm-chat').service('chromaVectorService').initialize();
    console.log('✅ ChromaDB Vector Service initialized');
  } catch (error) {
    console.error('❌ Failed to initialize ChromaDB Vector Service:', error);
  }

  // Enregistrer les hooks de synchronisation automatique
  try {
    strapi.plugin('llm-chat').service('vectorSyncService').registerHooks();
    console.log('✅ Vector sync hooks registered');
  } catch (error) {
    console.error('❌ Failed to register vector sync hooks:', error);
  }

  console.log('🚀 LLM Chat plugin with vector RAG capabilities bootstrap complete');
};

export default bootstrap;
