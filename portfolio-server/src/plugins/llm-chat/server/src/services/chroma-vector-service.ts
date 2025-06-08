import type { Core } from '@strapi/strapi';
import { ChromaClient, Collection } from 'chromadb';
import axios from 'axios';
import { INDEXABLE_COLLECTIONS } from '../config/indexable-collections';

// Custom embedding function that doesn't do anything (we'll provide embeddings manually)
class NullEmbeddingFunction {
  private _name: string;

  constructor() {
    this._name = 'NullEmbeddingFunction';
  }

  get name(): string {
    return this._name;
  }

  async generate(texts: string[]): Promise<number[][]> {
    // This should not be called since we provide embeddings manually
    throw new Error('NullEmbeddingFunction should not be used for generating embeddings');
  }

  async embed(texts: string[]): Promise<number[][]> {
    // This should not be called since we provide embeddings manually
    throw new Error('NullEmbeddingFunction should not be used for embedding');
  }
}

// Configuration du service
export interface ChromaConfig {
  chromaUrl: string;
  collectionName: string;
  ollamaUrl: string;
  embeddingModel: string;
}

const chromaVectorService = ({ strapi }: { strapi: Core.Strapi }) => {
  let chromaClient: ChromaClient;
  let collection: Collection;
  let config: ChromaConfig;

  // Initialisation du service
  const initialize = async () => {
    config = {
      chromaUrl: process.env.CHROMA_URL || 'http://localhost:8001',
      collectionName: process.env.CHROMA_COLLECTION || 'strapi-rag',
      ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text'
    };

    chromaClient = new ChromaClient({
      path: config.chromaUrl
    });

    await ensureCollection();

    strapi.log.info('📊 ChromaDB Vector Service initialized');
    strapi.log.info(`🔗 ChromaDB URL: ${config.chromaUrl}`);
    strapi.log.info(`📚 Collection: ${config.collectionName}`);
    strapi.log.info(`🤖 Ollama URL: ${config.ollamaUrl}`);
    strapi.log.info(`🔤 Embedding Model: ${config.embeddingModel}`);
  };

  // Créer ou obtenir une collection ChromaDB
  const ensureCollection = async (): Promise<void> => {
    try {
      const nullEmbedding = new NullEmbeddingFunction();

      // Essayer d'obtenir la collection existante
      try {
        collection = await chromaClient.getCollection({
          name: config.collectionName,
          embeddingFunction: nullEmbedding // Utiliser notre fonction d'embedding nulle
        });
        strapi.log.info(`✅ Collection "${config.collectionName}" exists`);
        return;
      } catch (error) {
        // Collection n'existe pas, on va la créer
        strapi.log.debug(`Collection "${config.collectionName}" not found, creating it...`);
      }

      // Créer la collection sans fonction d'embedding (on fournira les embeddings manuellement)
      try {
        collection = await chromaClient.createCollection({
          name: config.collectionName,
          metadata: {
            description: 'Strapi RAG Collection',
            created_at: new Date().toISOString()
          },
          embeddingFunction: nullEmbedding // Utiliser notre fonction d'embedding nulle
        });
        strapi.log.info(`✅ Collection "${config.collectionName}" created (manual embeddings)`);
      } catch (createError: any) {
        // Si l'erreur indique que la collection existe déjà, essayer de la récupérer
        if (createError.message?.includes('already exists') || createError.name === 'ChromaUniqueError') {
          strapi.log.info(`Collection "${config.collectionName}" already exists, retrieving it...`);
          collection = await chromaClient.getCollection({
            name: config.collectionName,
            embeddingFunction: nullEmbedding // Utiliser notre fonction d'embedding nulle
          });
          strapi.log.info(`✅ Collection "${config.collectionName}" retrieved successfully`);
        } else {
          throw createError;
        }
      }
    } catch (error) {
      strapi.log.error('❌ Error ensuring collection:', error);
      throw error;
    }
  };

  // Générer un embedding avec Ollama
  const generateEmbedding = async (text: string): Promise<number[]> => {
    const timerId = `generate-embedding-${Date.now()}`;
    console.time(timerId);

    try {
      const response = await axios.post(`${config.ollamaUrl}/api/embeddings`, {
        model: config.embeddingModel,
        prompt: text
      });

      if (response.data && response.data.embedding) {
        console.timeEnd(timerId);
        return response.data.embedding;
      } else {
        console.timeEnd(timerId);
        throw new Error('Invalid embedding response from Ollama');
      }
    } catch (error) {
      console.timeEnd(timerId);
      strapi.log.error('❌ Error generating embedding:', error);
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
          let value = entity[field];

          // Sérialiser les relations et objets complexes
          if (Array.isArray(value)) {
            // Pour les relations one-to-many (ex: codings, coding_skills)
            if (value.length > 0 && typeof value[0] === 'object') {
              // Extraire les IDs et noms pour faciliter la recherche
              metadata[`${field}_ids`] = value.map(item => item.id).filter(Boolean).join(',');
              metadata[`${field}_names`] = value.map(item =>
                item.name || item.coding?.name || item.title || 'Unknown'
              ).filter(Boolean).join(',');
            } else {
              metadata[field] = value.join(',');
            }
          } else if (typeof value === 'object') {
            // Pour les relations many-to-one ou objets complexes
            if (value.id) {
              metadata[`${field}_id`] = value.id;
              metadata[`${field}_name`] = value.name || value.title || 'Unknown';
            } else {
              // Essayer de sérialiser l'objet ou ignorer
              try {
                metadata[field] = JSON.stringify(value);
              } catch (error) {
                strapi.log.warn(`Cannot serialize field ${field} for ${collectionName}:${entity.id}`);
              }
            }
          } else {
            // Valeurs primitives (string, number, boolean, date)
            metadata[field] = value;
          }
        }
      });
    }

    return metadata;
  };

  // Indexer un document
  const indexDocument = async (entity: any, collectionName: string): Promise<void> => {
    const documentId = `${collectionName}-${entity.id}`;
    const timerId = `index-doc-${documentId}`;
    console.time(timerId);

    try {
      await ensureCollection();

      const content = formatDocumentContent(entity, collectionName);
      if (!content.trim()) {
        console.timeEnd(timerId);
        strapi.log.warn(`⚠️ No content to index for ${collectionName}:${entity.id}`);
        return;
      }

      const metadata = extractMetadata(entity, collectionName);

      // Supprimer le document existant s'il existe
      await deleteDocument(documentId);

      // Générer l'embedding avec Ollama
      const embeddingTimerId = `embedding-${documentId}`;
      console.time(embeddingTimerId);
      const embedding = await generateEmbedding(content);
      console.timeEnd(embeddingTimerId);

      // Ajouter le nouveau document avec l'embedding généré
      await collection.add({
        ids: [documentId],
        documents: [content],
        metadatas: [metadata],
        embeddings: [embedding]
      });

      console.timeEnd(timerId);
      strapi.log.info(`✅ Indexed document: ${documentId}`);
    } catch (error) {
      console.timeEnd(timerId);
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
    const timerId = `purge-all-${Date.now()}`;
    console.time(timerId);

    try {
      const nullEmbedding = new NullEmbeddingFunction();

      // Supprimer la collection entière pour résoudre les problèmes d'embedding
      try {
        await chromaClient.deleteCollection({
          name: config.collectionName
        });
        strapi.log.info(`🗑️ Deleted collection: ${config.collectionName}`);
      } catch (error) {
        // Collection n'existe pas, ignorer l'erreur
        strapi.log.debug(`Collection ${config.collectionName} doesn't exist or already deleted`);
      }

      // Recréer la collection pour les embeddings manuels
      try {
        collection = await chromaClient.createCollection({
          name: config.collectionName,
          metadata: {
            description: 'Strapi RAG Collection - Recreated',
            created_at: new Date().toISOString()
          },
          embeddingFunction: nullEmbedding // Utiliser notre fonction d'embedding nulle
        });
        strapi.log.info(`✅ Collection recreated for manual embeddings`);
      } catch (error) {
        console.timeEnd(timerId);
        strapi.log.error('❌ Error recreating collection:', error);
        throw error;
      }

      console.timeEnd(timerId);
      strapi.log.info('✅ ChromaDB purged and collection recreated');
      return { deleted: -1 }; // -1 indique que tout a été supprimé
    } catch (error) {
      console.timeEnd(timerId);
      strapi.log.error('❌ Error purging ChromaDB:', error);
      throw error;
    }
  };

  // Réindexer toutes les données
  const reindexAllData = async (): Promise<{ indexed: number, errors: number }> => {
    const timerId = `reindex-all-${Date.now()}`;
    console.time(timerId);

    let indexed = 0;
    let errors = 0;

    strapi.log.info('🔄 Starting full reindexing...');

    for (const [collectionName, config] of Object.entries(INDEXABLE_COLLECTIONS)) {
      const collectionTimerId = `reindex-collection-${collectionName}-${Date.now()}`;
      console.time(collectionTimerId);

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

        console.timeEnd(collectionTimerId);
        strapi.log.info(`✅ Processed ${entitiesArray.length} items from ${collectionName}`);
      } catch (error) {
        console.timeEnd(collectionTimerId);
        strapi.log.error(`❌ Error processing collection ${collectionName}:`, error);
        errors++;
      }
    }

    console.timeEnd(timerId);
    strapi.log.info(`🎯 Reindexing completed: ${indexed} indexed, ${errors} errors`);
    return { indexed, errors };
  };

  // Rechercher dans les documents
  const searchDocuments = async (query: string, limit: number = 10): Promise<any[]> => {
    const timerId = `search-docs-${Date.now()}`;
    console.time(timerId);

    try {
      await ensureCollection();

      // Générer l'embedding pour la requête avec Ollama
      const embeddingTimerId = `search-embedding-${Date.now()}`;
      console.time(embeddingTimerId);
      const queryEmbedding = await generateEmbedding(query);
      console.timeEnd(embeddingTimerId);

      // Utiliser la recherche par embedding de ChromaDB
      const chromaTimerId = `chroma-query-${Date.now()}`;
      console.time(chromaTimerId);
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        include: ['documents', 'metadatas', 'distances']
      });
      console.timeEnd(chromaTimerId);

      if (!results.ids || !results.ids[0] || results.ids[0].length === 0) {
        console.timeEnd(timerId);
        return [];
      }

      const formattedResults = results.ids[0].map((id, index) => ({
        id,
        document: results.documents[0][index],
        metadata: results.metadatas[0][index],
        distance: results.distances[0][index]
      }));

      console.timeEnd(timerId);
      return formattedResults;
    } catch (error) {
      console.timeEnd(timerId);
      strapi.log.error('❌ Error searching documents:', error);
      throw error;
    }
  };

  // Lister les documents indexés
  const listDocuments = async (limit: number = 50, offset: number = 0): Promise<any[]> => {
    try {
      await ensureCollection();

      // ChromaDB ne supporte pas directement la pagination, donc on récupère tous les documents et on pagine côté application
      const results = await collection.get({
        include: ['documents', 'metadatas'],
        limit: limit + offset // Récupérer plus pour permettre l'offset
      });

      if (!results.ids || results.ids.length === 0) {
        return [];
      }

      // Paginer les résultats côté application
      const documents = results.ids.slice(offset, offset + limit).map((id, index) => ({
        id,
        document: results.documents[offset + index],
        metadata: results.metadatas[offset + index],
        collection: results.metadatas[offset + index]?.collection || 'unknown'
      }));

      return documents;
    } catch (error) {
      strapi.log.error('❌ Error listing documents:', error);
      throw error;
    }
  };

  // Test de connexion
  const testConnection = async (): Promise<{ status: string, details: any }> => {
    try {
      // Test ChromaDB
      const chromaResponse = await chromaClient.heartbeat();

      // Test Ollama
      let ollamaStatus = 'error';
      let ollamaDetails = {};
      try {
        const ollamaResponse = await axios.get(`${config.ollamaUrl}/api/tags`);
        ollamaStatus = 'connected';
        ollamaDetails = {
          models: ollamaResponse.data.models?.map((m: any) => m.name) || [],
          embedding_model: config.embeddingModel
        };
      } catch (ollamaError) {
        ollamaDetails = { error: ollamaError.message };
      }

      return {
        status: ollamaStatus === 'connected' ? 'connected' : 'partial',
        details: {
          chroma: {
            status: 'connected',
            url: config.chromaUrl,
            response: chromaResponse
          },
          ollama: {
            status: ollamaStatus,
            url: config.ollamaUrl,
            ...ollamaDetails
          },
          collection: config.collectionName,
          embedding_mode: 'manual_ollama'
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
          // Utiliser un embedding générique pour compter les documents
          const dummyEmbedding = await generateEmbedding("count");
          const results = await collection.query({
            queryEmbeddings: [dummyEmbedding],
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

  // Exporter les documents d'une ou plusieurs collections
  const exportCollections = async (collectionNames: string[] = []): Promise<string> => {
    try {
      await ensureCollection();

      let exportText = '';
      const exportDate = new Date().toLocaleString();

      // Si aucune collection spécifiée, exporter toutes
      if (collectionNames.length === 0) {
        collectionNames = Object.keys(INDEXABLE_COLLECTIONS);
      }

      // En-tête du fichier d'export
      exportText += `# Export des Collections ChromaDB\n`;
      exportText += `Date d'export: ${exportDate}\n`;
      exportText += `Collections exportées: ${collectionNames.join(', ')}\n\n`;
      exportText += `${'='.repeat(80)}\n\n`;

      // Exporter chaque collection
      for (const collectionName of collectionNames) {
        try {
          const results = await collection.get({
            where: { collection: collectionName },
            limit: 1000, // Limite pour éviter les exports trop volumineux
            include: ['documents', 'metadatas']
          });

          if (results.ids && results.ids.length > 0) {
            exportText += `## Collection: ${collectionName}\n`;
            exportText += `Nombre de documents: ${results.ids.length}\n\n`;

            // Exporter chaque document
            for (let i = 0; i < results.ids.length; i++) {
              const id = results.ids[i];
              const document = results.documents?.[i] || '';
              const metadata = results.metadatas?.[i] || {};

              exportText += `### Document ID: ${id}\n`;
              exportText += `**Contenu:**\n${document}\n\n`;

              if (Object.keys(metadata).length > 0) {
                exportText += `**Métadonnées:**\n`;
                for (const [key, value] of Object.entries(metadata)) {
                  if (key !== 'collection') { // Éviter de répéter le nom de collection
                    exportText += `- ${key}: ${value}\n`;
                  }
                }
                exportText += '\n';
              }

              exportText += `${'-'.repeat(60)}\n\n`;
            }
          } else {
            exportText += `## Collection: ${collectionName}\n`;
            exportText += `Aucun document trouvé.\n\n`;
          }

          exportText += `${'='.repeat(80)}\n\n`;
        } catch (error) {
          exportText += `## Collection: ${collectionName}\n`;
          exportText += `Erreur lors de l'export: ${error.message}\n\n`;
          exportText += `${'='.repeat(80)}\n\n`;
        }
      }

      // Pied de page
      exportText += `Export terminé le ${new Date().toLocaleString()}\n`;
      exportText += `Total de collections traitées: ${collectionNames.length}\n`;

      return exportText;
    } catch (error) {
      strapi.log.error('❌ Error exporting collections:', error);
      throw new Error(`Failed to export collections: ${error.message}`);
    }
  };

  // Initialiser au démarrage
  initialize();

  return {
    initialize,
    generateEmbedding,
    indexDocument,
    deleteDocument,
    purgeAllDocuments,
    reindexAllData,
    searchDocuments,
    listDocuments,
    testConnection,
    getStats,
    getCollections,
    purgeCollection,
    exportCollections, // Ajouter la méthode d'export

    // Getter pour la configuration
    getConfig: () => config,
    getIndexableCollections: () => INDEXABLE_COLLECTIONS
  };
};

export default chromaVectorService;
