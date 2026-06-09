import type { Core } from '@strapi/strapi';

const bootstrap = ({ strapi }: { strapi: Core.Strapi }) => {
  // RAG removed: the chatbot now injects the full CV (profil + projets + parcours)
  // directly into the prompt, so there is no ChromaDB vector store and no local
  // Ollama model to initialize. Chat generation runs on Zhipu (cloud).
  console.log('🚀 LLM Chat plugin bootstrap complete (context-injection mode — no RAG, no local model)');
};

export default bootstrap;
