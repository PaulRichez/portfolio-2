import type { Core } from '@strapi/strapi';

const vectorController = ({ strapi }: { strapi: Core.Strapi }) => ({
  // Test de connexion aux services
  async testConnection(ctx) {
    try {
      const connectionStatus = await strapi
        .plugin('llm-chat')
        .service('chromaVectorService')
        .testConnection();

      ctx.body = {
        success: true,
        ...connectionStatus
      };
    } catch (error) {
      strapi.log.error('❌ Vector connection test failed:', error);
      ctx.throw(500, `Connection test failed: ${error.message}`);
    }
  },

  // Obtenir les statistiques
  async getStats(ctx) {
    try {
      const stats = await strapi
        .plugin('llm-chat')
        .service('chromaVectorService')
        .getStats();

      const syncStatus = await strapi
        .plugin('llm-chat')
        .service('vectorSyncService')
        .getSyncStatus();

      ctx.body = {
        success: true,
        stats,
        sync: syncStatus
      };
    } catch (error) {
      strapi.log.error('❌ Failed to get vector stats:', error);
      ctx.throw(500, `Failed to get stats: ${error.message}`);
    }
  },

  // Purger tous les documents
  async purgeIndex(ctx) {
    try {
      const result = await strapi
        .plugin('llm-chat')
        .service('chromaVectorService')
        .purgeAllDocuments();

      strapi.log.info('🗑️ Vector index purged successfully');

      ctx.body = {
        success: true,
        message: 'Vector index purged successfully',
        ...result
      };
    } catch (error) {
      strapi.log.error('❌ Failed to purge vector index:', error);
      ctx.throw(500, `Failed to purge index: ${error.message}`);
    }
  },

  // Réindexer toutes les données
  async reindexAll(ctx) {
    try {
      strapi.log.info('🔄 Starting full reindexing...');

      const result = await strapi
        .plugin('llm-chat')
        .service('chromaVectorService')
        .reindexAllData();

      ctx.body = {
        success: true,
        message: 'Reindexing completed',
        ...result
      };
    } catch (error) {
      strapi.log.error('❌ Failed to reindex data:', error);
      ctx.throw(500, `Failed to reindex: ${error.message}`);
    }
  },

  // Rechercher dans les documents vectorisés
  async searchDocuments(ctx) {
    try {
      const { query, limit } = ctx.request.body;

      if (!query) {
        return ctx.badRequest('Query parameter is required');
      }

      const results = await strapi
        .plugin('llm-chat')
        .service('chromaVectorService')
        .searchDocuments(query, parseInt(limit) || 10);

      ctx.body = {
        success: true,
        query,
        results: results.length,
        data: results
      };
    } catch (error) {
      strapi.log.error('❌ Vector search failed:', error);
      ctx.throw(500, `Search failed: ${error.message}`);
    }
  },

  // Synchroniser une entrée spécifique
  async syncEntry(ctx) {
    try {
      const { collection, id } = ctx.params;

      if (!collection || !id) {
        return ctx.badRequest('Collection and ID parameters are required');
      }

      const result = await strapi
        .plugin('llm-chat')
        .service('vectorSyncService')
        .syncEntry(collection, parseInt(id));

      ctx.body = {
        success: true,
        collection,
        id: parseInt(id),
        ...result
      };
    } catch (error) {
      strapi.log.error(`❌ Failed to sync entry ${ctx.params.collection}:${ctx.params.id}:`, error);
      ctx.throw(500, `Failed to sync entry: ${error.message}`);
    }
  },

  // Synchroniser toute une collection
  async syncCollection(ctx) {
    try {
      const { collection } = ctx.params;

      if (!collection) {
        return ctx.badRequest('Collection parameter is required');
      }

      const result = await strapi
        .plugin('llm-chat')
        .service('vectorSyncService')
        .syncCollection(collection);

      ctx.body = {
        success: true,
        collection,
        ...result
      };
    } catch (error) {
      strapi.log.error(`❌ Failed to sync collection ${ctx.params.collection}:`, error);
      ctx.throw(500, `Failed to sync collection: ${error.message}`);
    }
  },

  // Supprimer un document spécifique de l'index
  async deleteFromIndex(ctx) {
    try {
      const { collection, id } = ctx.params;

      if (!collection || !id) {
        return ctx.badRequest('Collection and ID parameters are required');
      }

      const result = await strapi
        .plugin('llm-chat')
        .service('vectorSyncService')
        .forceDeletion(collection, parseInt(id));

      ctx.body = {
        success: true,
        collection,
        id: parseInt(id),
        ...result
      };
    } catch (error) {
      strapi.log.error(`❌ Failed to delete from index ${ctx.params.collection}:${ctx.params.id}:`, error);
      ctx.throw(500, `Failed to delete from index: ${error.message}`);
    }
  },

  // Obtenir la configuration actuelle
  async getConfig(ctx) {
    try {
      const config = strapi
        .plugin('llm-chat')
        .service('chromaVectorService')
        .getConfig();

      const indexableCollections = strapi
        .plugin('llm-chat')
        .service('chromaVectorService')
        .getIndexableCollections();

      const watchedCollections = strapi
        .plugin('llm-chat')
        .service('vectorSyncService')
        .getWatchedCollections();

      ctx.body = {
        success: true,
        config: {
          chromaUrl: config.chromaUrl,
          collectionName: config.collectionName,
          embeddingModel: config.embeddingModel,
          ollamaUrl: config.ollamaUrl
        },
        indexableCollections,
        watchedCollections
      };
    } catch (error) {
      strapi.log.error('❌ Failed to get vector config:', error);
      ctx.throw(500, `Failed to get config: ${error.message}`);
    }
  },

  // Générer un embedding pour un texte donné (utile pour les tests)
  async generateEmbedding(ctx) {
    try {
      const { text } = ctx.request.body;

      if (!text) {
        return ctx.badRequest('Text is required');
      }

      const embedding = await strapi
        .plugin('llm-chat')
        .service('chromaVectorService')
        .generateEmbedding(text);

      ctx.body = {
        success: true,
        text,
        embedding_length: embedding.length,
        embedding: embedding.slice(0, 10) // Afficher seulement les 10 premiers valeurs pour éviter une réponse trop grande
      };
    } catch (error) {
      strapi.log.error('❌ Failed to generate embedding:', error);
      ctx.throw(500, `Failed to generate embedding: ${error.message}`);
    }
  },

  // Obtenir les informations des collections
  async getCollections(ctx) {
    try {
      const collections = await strapi
        .plugin('llm-chat')
        .service('chromaVectorService')
        .getCollections();

      ctx.body = {
        success: true,
        collections
      };
    } catch (error) {
      strapi.log.error('❌ Failed to get collections:', error);
      ctx.throw(500, `Failed to get collections: ${error.message}`);
    }
  },

  // Purger une collection spécifique
  async purgeCollection(ctx) {
    try {
      const { collection } = ctx.params;
      const result = await strapi
        .plugin('llm-chat')
        .service('chromaVectorService')
        .purgeCollection(collection);

      ctx.body = {
        success: true,
        collection,
        ...result
      };
    } catch (error) {
      strapi.log.error('❌ Failed to purge collection:', error);
      ctx.throw(500, `Failed to purge collection: ${error.message}`);
    }
  },

  // Synchronisation complète
  async syncFull(ctx) {
    try {
      const result = await strapi
        .plugin('llm-chat')
        .service('vectorSyncService')
        .syncAll();

      ctx.body = {
        success: true,
        ...result
      };
    } catch (error) {
      strapi.log.error('❌ Failed to perform full sync:', error);
      ctx.throw(500, `Failed to perform full sync: ${error.message}`);
    }
  }
});

export default vectorController;
