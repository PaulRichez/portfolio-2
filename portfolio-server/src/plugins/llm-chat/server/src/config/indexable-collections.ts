// Configuration des collections à indexer avec leurs champs
export interface IndexableCollectionConfig {
  fields: string[];
  metadataFields: string[];
}

export const INDEXABLE_COLLECTIONS: Record<string, IndexableCollectionConfig> = {
  'api::project.project': {
    fields: ['title', 'description'],
    metadataFields: ['github_link', 'link_demo', 'createdAt']
  },
  'api::me.me': {
    fields: ['firstName', 'lastName', 'postName'],
    metadataFields: ['email', 'phoneNumber', 'website', 'github', 'linkedin']
  },
  'api::coding.coding': {
    fields: ['name', 'category'],
    metadataFields: ['icon', 'createdAt']
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
