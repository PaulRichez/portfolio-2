import type { Core } from '@strapi/strapi';

const vectorSyncService = ({ strapi }: { strapi: Core.Strapi }) => {
  // Collections à surveiller pour la synchronisation automatique
  const WATCHED_COLLECTIONS = [
    'api::project.project',
    'api::me.me'
    // Ajoutez d'autres collections selon vos besoins
    // 'api::article.article',
    // 'api::faq.faq'
  ];

  // Gérer la création d'une entrée
  const handleAfterCreate = async (event: any) => {
    const { model, result } = event;

    if (!WATCHED_COLLECTIONS.includes(model.uid)) {
      return;
    }

    try {
      strapi.log.info(`🆕 New entry created in ${model.uid}:${result.id}, indexing...`);

      await strapi
        .plugin('llm-chat')
        .service('chromaVectorService')
        .indexDocument(result, model.uid);

      strapi.log.info(`✅ Successfully indexed new entry ${model.uid}:${result.id}`);
    } catch (error) {
      strapi.log.error(`❌ Failed to index new entry ${model.uid}:${result.id}:`, error);
      // Ne pas faire échouer la création de l'entrée
    }
  };

  // Gérer la mise à jour d'une entrée
  const handleAfterUpdate = async (event: any) => {
    const { model, result } = event;

    if (!WATCHED_COLLECTIONS.includes(model.uid)) {
      return;
    }

    try {
      strapi.log.info(`📝 Entry updated in ${model.uid}:${result.id}, reindexing...`);

      await strapi
        .plugin('llm-chat')
        .service('chromaVectorService')
        .indexDocument(result, model.uid);

      strapi.log.info(`✅ Successfully reindexed updated entry ${model.uid}:${result.id}`);
    } catch (error) {
      strapi.log.error(`❌ Failed to reindex updated entry ${model.uid}:${result.id}:`, error);
      // Ne pas faire échouer la mise à jour de l'entrée
    }
  };

  // Gérer la suppression d'une entrée
  const handleAfterDelete = async (event: any) => {
    const { model, result } = event;

    if (!WATCHED_COLLECTIONS.includes(model.uid)) {
      return;
    }

    try {
      strapi.log.info(`🗑️ Entry deleted from ${model.uid}:${result.id}, removing from index...`);

      const documentId = `${model.uid}-${result.id}`;
      await strapi
        .plugin('llm-chat')
        .service('chromaVectorService')
        .deleteDocument(documentId);

      strapi.log.info(`✅ Successfully removed deleted entry ${model.uid}:${result.id} from index`);
    } catch (error) {
      strapi.log.error(`❌ Failed to remove deleted entry ${model.uid}:${result.id} from index:`, error);
      // Ne pas faire échouer la suppression de l'entrée
    }
  };

  // Enregistrer les hooks
  const registerHooks = () => {
    strapi.log.info('🔗 Registering vector sync hooks...');

    WATCHED_COLLECTIONS.forEach(collectionName => {
      try {
        // Hook après création
        strapi.db.lifecycles.subscribe({
          models: [collectionName],
          afterCreate: handleAfterCreate
        });

        // Hook après mise à jour
        strapi.db.lifecycles.subscribe({
          models: [collectionName],
          afterUpdate: handleAfterUpdate
        });

        // Hook après suppression
        strapi.db.lifecycles.subscribe({
          models: [collectionName],
          afterDelete: handleAfterDelete
        });

        strapi.log.info(`✅ Hooks registered for ${collectionName}`);
      } catch (error) {
        strapi.log.error(`❌ Failed to register hooks for ${collectionName}:`, error);
      }
    });
  };

  // Synchronisation manuelle d'une entrée
  const syncEntry = async (collectionName: string, entryId: number) => {
    if (!WATCHED_COLLECTIONS.includes(collectionName)) {
      throw new Error(`Collection ${collectionName} is not configured for vector sync`);
    }

    try {      const entry = await strapi.entityService.findOne(collectionName as any, entryId, {
        populate: '*'
      });

      if (!entry) {
        throw new Error(`Entry ${entryId} not found in ${collectionName}`);
      }

      await strapi
        .plugin('llm-chat')
        .service('chromaVectorService')
        .indexDocument(entry, collectionName);

      strapi.log.info(`✅ Manually synced ${collectionName}:${entryId}`);
      return { success: true, message: `Entry synced successfully` };
    } catch (error) {
      strapi.log.error(`❌ Failed to manually sync ${collectionName}:${entryId}:`, error);
      throw error;
    }
  };

  // Synchronisation manuelle de toutes les entrées d'une collection
  const syncCollection = async (collectionName: string) => {
    if (!WATCHED_COLLECTIONS.includes(collectionName)) {
      throw new Error(`Collection ${collectionName} is not configured for vector sync`);
    }

    try {      const entries = await strapi.entityService.findMany(collectionName as any, {
        populate: '*',
        pagination: { limit: -1 }
      });

      const entitiesArray = Array.isArray(entries) ? entries : [entries];
      let synced = 0;
      let errors = 0;

      for (const entry of entitiesArray) {
        if (entry) {
          try {
            await strapi
              .plugin('llm-chat')
              .service('chromaVectorService')
              .indexDocument(entry, collectionName);
            synced++;
          } catch (error) {
            strapi.log.error(`❌ Failed to sync ${collectionName}:${entry.id}:`, error);
            errors++;
          }
        }
      }

      strapi.log.info(`✅ Collection sync completed for ${collectionName}: ${synced} synced, ${errors} errors`);
      return { success: true, synced, errors, total: entitiesArray.length };
    } catch (error) {
      strapi.log.error(`❌ Failed to sync collection ${collectionName}:`, error);
      throw error;
    }
  };

  // Synchronisation complète de toutes les collections
  const syncFull = async (): Promise<{ synced: number, errors: number }> => {
    try {
      strapi.log.info('🔄 Starting full synchronization of all collections...');

      const result = await strapi
        .plugin('llm-chat')
        .service('chromaVectorService')
        .reindexAllData();

      strapi.log.info(`✅ Full sync completed: ${result.indexed} indexed, ${result.errors} errors`);

      return {
        synced: result.indexed,
        errors: result.errors
      };
    } catch (error) {
      strapi.log.error('❌ Full sync failed:', error);
      throw error;
    }
  };

  // Vérifier l'état de la synchronisation
  const getSyncStatus = () => {
    return {
      watchedCollections: WATCHED_COLLECTIONS,
      hooksRegistered: true,
      lastCheck: new Date().toISOString()
    };
  };

  // Forcer la désynchronisation (pour les tests)
  const forceDeletion = async (collectionName: string, entryId: number) => {
    const documentId = `${collectionName}-${entryId}`;

    try {
      await strapi
        .plugin('llm-chat')
        .service('chromaVectorService')
        .deleteDocument(documentId);

      strapi.log.info(`🗑️ Force deleted ${documentId} from vector index`);
      return { success: true, message: `Document deleted from vector index` };
    } catch (error) {
      strapi.log.error(`❌ Failed to force delete ${documentId}:`, error);
      throw error;
    }
  };

  return {
    registerHooks,
    syncEntry,
    syncCollection,
    syncFull,
    getSyncStatus,
    forceDeletion,

    // Getters pour la configuration
    getWatchedCollections: () => WATCHED_COLLECTIONS,

    // Handlers pour tests manuels
    handleAfterCreate,
    handleAfterUpdate,
    handleAfterDelete
  };
};

export default vectorSyncService;
