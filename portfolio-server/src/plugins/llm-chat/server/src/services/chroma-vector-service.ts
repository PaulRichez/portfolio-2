import type { Core } from '@strapi/strapi';
import { ChromaClient, Collection } from 'chromadb';
import axios from 'axios';

// Configuration du service
export interface ChromaConfig {
  chromaUrl: string;
  collectionName: string;
  embeddingModel: string;
  ollamaUrl?: string;
}

// Collections à indexer avec leurs champs
const INDEXABLE_COLLECTIONS = {
  'api::project.project': {
    fields: ['title', 'description'],
    metadataFields: ['github_link', 'link_demo', 'createdAt']
  },
  'api::me.me': {
    fields: ['firstName', 'lastName', 'postName'],
    metadataFields: ['email', 'phoneNumber', 'website', 'github', 'linkedin']
  }
  // Ajoutez d'autres collections selon vos besoins
  // 'api::article.article': {
  //   fields: ['title', 'content'],
  //   metadataFields: ['tags', 'author', 'publishedAt']
  // },
  // 'api::faq.faq': {
  //   fields: ['question', 'answer'],
  //   metadataFields: ['category', 'createdAt']
  // }
};

const chromaVectorService = ({ strapi }: { strapi: Core.Strapi }) => {
  let chromaClient: ChromaClient;
  let collection: Collection;
  let config: ChromaConfig;

  // Initialisation du service
  const initialize = async () => {
    config = {
      chromaUrl: process.env.CHROMA_URL || 'http://localhost:8001',
      collectionName: process.env.CHROMA_COLLECTION || 'strapi-rag',
      embeddingModel: process.env.EMBEDDING_MODEL || 'mxbai-embed-large',
      ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434'
    };

    chromaClient = new ChromaClient({
      path: config.chromaUrl
    });

    await ensureCollection();

    strapi.log.info('📊 ChromaDB Vector Service initialized');
    strapi.log.info(`🔗 ChromaDB URL: ${config.chromaUrl}`);
    strapi.log.info(`📚 Collection: ${config.collectionName}`);
  };

  // Générer des embeddings via Ollama
  const generateEmbedding = async (text: string): Promise<number[]> => {
    try {
      const response = await axios.post(`${config.ollamaUrl}/api/embeddings`, {
        model: config.embeddingModel,
        prompt: text
      });

      if (!response.data.embedding) {
        throw new Error('No embedding returned from Ollama');
      }

      return response.data.embedding;
    } catch (error) {
      strapi.log.error('❌ Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  };

  // Créer ou obtenir une collection ChromaDB
  const ensureCollection = async (): Promise<void> => {
    try {
      // Essayer d'obtenir la collection existante
      try {
        collection = await chromaClient.getCollection({
          name: config.collectionName
        });
        strapi.log.info(`✅ Collection "${config.collectionName}" exists`);
        return;
      } catch (error) {
        // Collection n'existe pas, on va la créer
      }

      // Créer la collection si elle n'existe pas
      // Utiliser embeddingFunction: null pour éviter l'embedding par défaut
      collection = await chromaClient.createCollection({
        name: config.collectionName,
        metadata: {
          description: 'Strapi RAG Collection',
          created_at: new Date().toISOString()
        },
        embeddingFunction: null // Pas d'embedding automatique, on utilise Ollama
      });

      strapi.log.info(`✅ Collection "${config.collectionName}" created`);
    } catch (error) {
      strapi.log.error('❌ Error ensuring collection:', error);
      throw error;
    }
  };

  // Formater le contenu pour l'indexation
  const formatDocumentContent = (entity: any, collectionName: string): string => {
    const config = INDEXABLE_COLLECTIONS[collectionName];
    if (!config) return '';

    const parts: string[] = [];

    config.fields.forEach(field => {
      if (entity[field]) {
        let value = entity[field];
        // Nettoyer le contenu rich text si nécessaire
        if (typeof value === 'object' && value.length) {
          value = value.map(block => block.children?.map(child => child.text).join(' ')).join(' ');
        }
        parts.push(`${field}: ${value}`);
      }
    });

    return parts.join('\n');
  };

  // Extraire les métadonnées
  const extractMetadata = (entity: any, collectionName: string): Record<string, any> => {
    const config = INDEXABLE_COLLECTIONS[collectionName];
    const metadata: Record<string, any> = {
      strapi_id: entity.id,
      collection: collectionName,
      indexed_at: new Date().toISOString()
    };

    if (config?.metadataFields) {
      config.metadataFields.forEach(field => {
        if (entity[field] !== undefined && entity[field] !== null) {
          metadata[field] = entity[field];
        }
      });
    }

    return metadata;
  };

  // Indexer un document
  const indexDocument = async (entity: any, collectionName: string): Promise<void> => {
    try {
      await ensureCollection();

      const content = formatDocumentContent(entity, collectionName);
      if (!content.trim()) {
        strapi.log.warn(`⚠️ No content to index for ${collectionName}:${entity.id}`);
        return;
      }

      const embedding = await generateEmbedding(content);
      const metadata = extractMetadata(entity, collectionName);
      const documentId = `${collectionName}-${entity.id}`;

      // Supprimer le document existant s'il existe
      await deleteDocument(documentId);

      // Ajouter le nouveau document
      await collection.add({
        ids: [documentId],
        embeddings: [embedding],
        documents: [content],
        metadatas: [metadata]
      });

      strapi.log.info(`✅ Indexed document: ${documentId}`);
    } catch (error) {
      strapi.log.error(`❌ Error indexing document ${collectionName}:${entity.id}:`, error);
      throw error;
    }
  };

  // Supprimer un document
  const deleteDocument = async (documentId: string): Promise<void> => {
    try {
      await ensureCollection();

      await collection.delete({
        ids: [documentId]
      });

      strapi.log.info(`🗑️ Deleted document: ${documentId}`);
    } catch (error) {
      // Ignorer les erreurs si le document n'existe pas
      strapi.log.error(`❌ Error deleting document ${documentId}:`, error);
    }
  };

  // Purger tous les documents
  const purgeAllDocuments = async (): Promise<{ deleted: number }> => {
    try {
      // Supprimer la collection entière
      try {
        await chromaClient.deleteCollection({
          name: config.collectionName
        });
        strapi.log.info(`🗑️ Deleted collection: ${config.collectionName}`);
      } catch (error) {
        // Collection n'existe pas, ignorer l'erreur
      }

      // Recréer la collection
      await ensureCollection();

      strapi.log.info('✅ ChromaDB purged and collection recreated');
      return { deleted: -1 }; // -1 indique que tout a été supprimé
    } catch (error) {
      strapi.log.error('❌ Error purging ChromaDB:', error);
      throw error;
    }
  };

  // Réindexer toutes les données
  const reindexAllData = async (): Promise<{ indexed: number, errors: number }> => {
    let indexed = 0;
    let errors = 0;

    strapi.log.info('🔄 Starting full reindexing...');

    for (const [collectionName, config] of Object.entries(INDEXABLE_COLLECTIONS)) {
      try {
        strapi.log.info(`📋 Processing collection: ${collectionName}`);
          const entities = await strapi.entityService.findMany(collectionName as any, {
          populate: '*',
          pagination: { limit: -1 } // Récupérer toutes les entrées
        });

        const entitiesArray = Array.isArray(entities) ? entities : [entities];

        for (const entity of entitiesArray) {
          if (entity) {
            try {
              await indexDocument(entity, collectionName);
              indexed++;
            } catch (error) {
              strapi.log.error(`❌ Failed to index ${collectionName}:${entity.id}:`, error);
              errors++;
            }
          }
        }

        strapi.log.info(`✅ Processed ${entitiesArray.length} items from ${collectionName}`);
      } catch (error) {
        strapi.log.error(`❌ Error processing collection ${collectionName}:`, error);
        errors++;
      }
    }

    strapi.log.info(`🎯 Reindexing completed: ${indexed} indexed, ${errors} errors`);
    return { indexed, errors };
  };

  // Rechercher dans les documents
  const searchDocuments = async (query: string, limit: number = 10): Promise<any[]> => {
    try {
      await ensureCollection();

      const queryEmbedding = await generateEmbedding(query);

      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        include: ['documents', 'metadatas', 'distances']
      });

      if (!results.ids || !results.ids[0] || results.ids[0].length === 0) {
        return [];
      }

      return results.ids[0].map((id, index) => ({
        id,
        document: results.documents[0][index],
        metadata: results.metadatas[0][index],
        distance: results.distances[0][index]
      }));
    } catch (error) {
      strapi.log.error('❌ Error searching documents:', error);
      throw error;
    }
  };

  // Test de connexion
  const testConnection = async (): Promise<{ status: string, details: any }> => {
    try {
      // Test ChromaDB
      const chromaResponse = await chromaClient.heartbeat();

      // Test Ollama
      let ollamaStatus = 'disconnected';
      try {
        const ollamaResponse = await axios.get(`${config.ollamaUrl}/api/tags`);
        ollamaStatus = 'connected';
      } catch (error) {
        ollamaStatus = 'disconnected';
      }

      return {
        status: 'connected',
        details: {
          chroma: {
            status: 'connected',
            url: config.chromaUrl,
            response: chromaResponse
          },
          ollama: {
            status: ollamaStatus,
            url: config.ollamaUrl,
            model: config.embeddingModel
          },
          collection: config.collectionName
        }
      };
    } catch (error) {
      return {
        status: 'error',
        details: {
          error: error.message,
          chroma_url: config.chromaUrl,
          ollama_url: config.ollamaUrl
        }
      };
    }
  };

  // Obtenir les statistiques
  const getStats = async (): Promise<any> => {
    try {
      await ensureCollection();

      const count = await collection.count();

      return {
        collection_name: config.collectionName,
        document_count: count,
        indexed_collections: Object.keys(INDEXABLE_COLLECTIONS),
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      strapi.log.error('❌ Error getting stats:', error);
      return {
        collection_name: config.collectionName,
        document_count: 0,
        error: error.message
      };
    }
  };

  // Obtenir les informations sur les collections
  const getCollections = async (): Promise<any[]> => {
    try {
      const collections = [];

      for (const [contentType, collectionConfig] of Object.entries(INDEXABLE_COLLECTIONS)) {
        try {
          await ensureCollection();

          // Compter les documents de ce type de contenu dans la collection
          const results = await collection.query({
            queryTexts: [""],
            nResults: 1,
            where: { collection: contentType }
          });

          collections.push({
            name: contentType,
            count: results.ids?.[0]?.length || 0,
            lastUpdated: new Date().toISOString(),
            enabled: true,
            contentType: contentType,
            fields: collectionConfig.fields
          });
        } catch (error) {
          // Collection ou type de contenu n'existe pas encore
          collections.push({
            name: contentType,
            count: 0,
            lastUpdated: null,
            enabled: true,
            contentType: contentType,
            fields: collectionConfig.fields
          });
        }
      }

      return collections;
    } catch (error) {
      strapi.log.error('❌ Error getting collections:', error);
      return [];
    }
  };

  // Purger une collection spécifique
  const purgeCollection = async (collectionName: string): Promise<any> => {
    try {
      await ensureCollection();

      // Supprimer tous les documents de ce type dans la collection principale
      await collection.delete({
        where: { collection: collectionName }
      });

      strapi.log.info(`✅ Collection ${collectionName} purged`);
      return { purged: true, collection: collectionName };
    } catch (error) {
      strapi.log.error(`❌ Error purging collection ${collectionName}:`, error);
      return { purged: false, error: error.message };
    }
  };

  // Initialiser au démarrage
  initialize();

  return {
    initialize,
    indexDocument,
    deleteDocument,
    purgeAllDocuments,
    reindexAllData,
    searchDocuments,
    testConnection,
    getStats,
    generateEmbedding,
    getCollections,
    purgeCollection,

    // Getter pour la configuration
    getConfig: () => config,
    getIndexableCollections: () => INDEXABLE_COLLECTIONS
  };
};

export default chromaVectorService;
