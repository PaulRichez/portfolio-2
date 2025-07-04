// Configuration des collections à indexer avec leurs champs
export interface MetadataFieldFormatter {
  nameField: string; // Champ contenant le nom (ex: 'name', 'coding.name')
  levelField?: string; // Champ contenant le niveau (optionnel)
  format?: string; // Format de sortie (ex: '{name} ({level})')
}

export interface IndexableCollectionConfig {
  fields: string[];
  metadataFields: string[];
  populate?: any; // Configuration populate pour les relations
  metadataFormatters?: Record<string, MetadataFieldFormatter>; // Configuration des formatters pour les champs metadata
}

export const INDEXABLE_COLLECTIONS: Record<string, IndexableCollectionConfig> = {
  'api::project.project': {
    fields: ['title', 'description'],
    metadataFields: ['github_link', 'link_demo', 'link_npm', 'codings'],
    populate: {
      codings: true
    }
  },
  'api::me.me': {
    fields: ['firstName', 'lastName', 'postName'],
    metadataFields: ['email', 'phoneNumber', 'website', 'github', 'linkedin', 'coding_skills', 'languages', 'diplomas', 'experiences'],
    populate: {
      coding_skills: {
        populate: {
          coding: true
        }
      },
      languages: true,
      diplomas: true,
      experiences: true
    },
    metadataFormatters: {
      coding_skills: {
        nameField: 'coding.name',
        levelField: 'level',
        format: '{name} ({level})'
      }
    }
  },
  'api::coding.coding': {
    fields: ['name', 'category'],
    metadataFields: ['project'],
    populate: {
      project: true
    }
  }
  // Ajoutez d'autres collections selon vos besoins
  // 'api::article.article': {
  //   fields: ['title', 'content'],
  //   metadataFields: ['tags', 'author', 'publishedAt'],
  //   populate: {
  //     tags: true,
  //     author: true
  //   }
  // },
  // 'api::faq.faq': {
  //   fields: ['question', 'answer'],
  //   metadataFields: ['category', 'createdAt'],
  //   populate: {
  //     category: true
  //   }
  // }
};

/**
 * Récupère la configuration populate pour une collection donnée
 */
export function getPopulateConfig(collectionName: string): any {
  const config = INDEXABLE_COLLECTIONS[collectionName];
  return config?.populate || '*'; // Fallback pour les collections sans populate spécifique
}
