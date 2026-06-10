export default () => ({
  // Le chatbot ne passe plus par un plugin : il est servi par une API custom
  // légère (src/api/me/{routes,controllers,services}/chat.ts) qui stream Zhipu
  // en direct. Plus de ChromaDB / RAG / vector-sync / build de plugin.
});
