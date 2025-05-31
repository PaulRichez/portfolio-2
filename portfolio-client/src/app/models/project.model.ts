export interface Project {
  id?: number;
  documentId?: string;
  title: string;
  description?: string;
  image?: string;
  demoUrl?: string;
  sourceUrl?: string;
  technologies?: string[];
  featured?: boolean;

  // Strapi metadata
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  locale?: string;
}
