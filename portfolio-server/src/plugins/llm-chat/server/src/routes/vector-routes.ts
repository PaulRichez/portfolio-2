export default {
  type: 'admin',
  routes: [
    // Test de connexion et configuration
    {
      method: 'POST',
      path: '/vectors/test-connection',
      handler: 'vectorController.testConnection',
      config: {
        policies: [],
        description: 'Test ChromaDB and Ollama connections'
      },
    },
    {
      method: 'GET',
      path: '/vectors/config',
      handler: 'vectorController.getConfig',
      config: {
        policies: [],
        description: 'Get vector service configuration'
      },
    },
    {
      method: 'GET',
      path: '/vectors/stats',
      handler: 'vectorController.getStats',
      config: {
        policies: [],
        description: 'Get vector index statistics'
      },
    },
    {
      method: 'GET',
      path: '/vectors/collections',
      handler: 'vectorController.getCollections',
      config: {
        policies: [],
        description: 'Get all vector collections info'
      },
    },

    // Gestion de l'index
    {
      method: 'DELETE',
      path: '/vectors/purge/all',
      handler: 'vectorController.purgeIndex',
      config: {
        policies: [],
        description: 'Purge all documents from vector index'
      },
    },
    {
      method: 'DELETE',
      path: '/vectors/purge/collection/:collection',
      handler: 'vectorController.purgeCollection',
      config: {
        policies: [],
        description: 'Purge specific collection from vector index'
      },
    },
    {
      method: 'POST',
      path: '/vectors/reindex',
      handler: 'vectorController.reindexAll',
      config: {
        policies: [],
        description: 'Reindex all configured collections'
      },
    },

    // Recherche
    {
      method: 'POST',
      path: '/vectors/search',
      handler: 'vectorController.searchDocuments',
      config: {
        policies: [],
        description: 'Search in vector index'
      },
    },

    // Génération d'embeddings
    {
      method: 'POST',
      path: '/vectors/embedding',
      handler: 'vectorController.generateEmbedding',
      config: {
        policies: [],
        description: 'Generate embedding using Ollama'
      },
    },

    // Synchronisation manuelle
    {
      method: 'POST',
      path: '/vectors/sync/full',
      handler: 'vectorController.syncFull',
      config: {
        policies: [],
        description: 'Full sync of all collections'
      },
    },
    {
      method: 'POST',
      path: '/vectors/sync/collection/:collection',
      handler: 'vectorController.syncCollection',
      config: {
        policies: [],
        description: 'Manually sync an entire collection'
      },
    },
    {
      method: 'POST',
      path: '/vectors/sync/:collection/:id',
      handler: 'vectorController.syncEntry',
      config: {
        policies: [],
        description: 'Manually sync a specific entry'
      },
    },
    {
      method: 'DELETE',
      path: '/vectors/sync/:collection/:id',
      handler: 'vectorController.deleteFromIndex',
      config: {
        policies: [],
        description: 'Remove a specific entry from vector index'
      },
    },
  ],
};
