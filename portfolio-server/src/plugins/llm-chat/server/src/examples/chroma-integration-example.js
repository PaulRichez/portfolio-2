/**
 * Exemple d'utilisation de l'intégration ChromaDB avec LangChain
 *
 * Ce fichier montre comment utiliser le service LangChain modifié
 * pour bénéficier de la recherche automatique dans ChromaDB
 */

// Exemples d'appels au service LangChain avec RAG activé

// 1. Conversation simple avec RAG activé (par défaut)
const chatWithRAG = async (strapi) => {
  const langchainService = strapi.plugin('llm-chat').service('langchainService');

  const response = await langchainService.chat(
    "Quels sont les projets React que tu as développés ?",
    {
      sessionId: 'user-123',
      useRAG: true // Optionnel, activé par défaut
    }
  );

  console.log('Réponse avec RAG:', response.response);
};

// 2. Conversation sans RAG (conversation simple)
const chatWithoutRAG = async (strapi) => {
  const langchainService = strapi.plugin('llm-chat').service('langchainService');

  const response = await langchainService.chat(
    "Bonjour, comment ça va ?",
    {
      sessionId: 'user-123',
      useRAG: false // Désactive la recherche ChromaDB
    }
  );

  console.log('Réponse sans RAG:', response.response);
};

// 3. Conversation avec prompt système personnalisé
const chatWithCustomPrompt = async (strapi) => {
  const langchainService = strapi.plugin('llm-chat').service('langchainService');

  const response = await langchainService.chat(
    "Parle-moi de tes compétences en développement web",
    {
      sessionId: 'user-123',
      systemPrompt: `Tu es un développeur web expérimenté qui présente son portfolio.
      Utilise les outils de recherche pour trouver des informations précises sur les projets et compétences.
      Réponds de manière professionnelle mais accessible.`,
      useRAG: true
    }
  );

  console.log('Réponse avec prompt personnalisé:', response.response);
};

// 4. Test direct des outils ChromaDB
const testChromaTools = async (strapi) => {
  const { ChromaRetrievalTool, ChromaAdvancedRetrievalTool } = require('../tools/chroma-retrieval-tool');

  // Test de l'outil de base
  const basicTool = new ChromaRetrievalTool(strapi);
  const basicResult = await basicTool._call("projets React");
  console.log('Résultat recherche basique:', basicResult);

  // Test de l'outil avancé
  const advancedTool = new ChromaAdvancedRetrievalTool(strapi);
  const advancedResult = await advancedTool._call(JSON.stringify({
    query: "développement web",
    limit: 3,
    collection: "api::project.project"
  }));
  console.log('Résultat recherche avancée:', advancedResult);
};

// 5. Vérification que ChromaDB contient des données
const checkChromaData = async (strapi) => {
  const chromaService = strapi.plugin('llm-chat').service('chromaVectorService');

  // Vérifier les statistiques
  const stats = await chromaService.getStats();
  console.log('Statistiques ChromaDB:', stats);

  // Lister quelques documents
  const documents = await chromaService.listDocuments(5);
  console.log('Échantillon de documents:', documents);

  // Test de recherche directe
  const searchResults = await chromaService.searchDocuments("React", 3);
  console.log('Résultats de recherche:', searchResults);
};

// 6. Scénarios d'utilisation typiques
const typicalUseCases = async (strapi) => {
  const langchainService = strapi.plugin('llm-chat').service('langchainService');

  const scenarios = [
    "Peux-tu me présenter ton portfolio ?",
    "Quels sont tes projets les plus récents ?",
    "Quelles technologies maîtrises-tu ?",
    "Comment puis-je te contacter ?",
    "Peux-tu me parler de ton expérience professionnelle ?",
    "Montre-moi un projet utilisant Next.js",
    "Quelles sont tes compétences en backend ?",
  ];

  for (const message of scenarios) {
    console.log(`\n=== Question: ${message} ===`);
    try {
      const response = await langchainService.chat(message, {
        sessionId: 'demo-session',
        useRAG: true
      });
      console.log('Réponse:', response.response.substring(0, 200) + '...');
    } catch (error) {
      console.error('Erreur:', error.message);
    }
  }
};

// Fonction principale pour tester l'intégration
const testChromaIntegration = async (strapi) => {
  console.log('🚀 Test de l\'intégration ChromaDB + LangChain');

  try {
    // 1. Vérifier que ChromaDB fonctionne
    console.log('\n1. Vérification ChromaDB...');
    await checkChromaData(strapi);

    // 2. Tester les outils directement
    console.log('\n2. Test des outils ChromaDB...');
    await testChromaTools(strapi);

    // 3. Tester les conversations avec RAG
    console.log('\n3. Test des conversations avec RAG...');
    await chatWithRAG(strapi);

    // 4. Tester les scénarios typiques
    console.log('\n4. Test des scénarios typiques...');
    await typicalUseCases(strapi);

    console.log('\n✅ Tests terminés avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
  }
};

module.exports = {
  testChromaIntegration,
  chatWithRAG,
  chatWithoutRAG,
  chatWithCustomPrompt,
  testChromaTools,
  checkChromaData,
  typicalUseCases
};
