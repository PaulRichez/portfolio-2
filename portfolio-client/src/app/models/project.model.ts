import { Coding } from "./coding.model";

export interface Project {
  id?: number;
  documentId?: string;
  title: string;
  description?: string;
  image?: string;
  demoUrl?: string;
  sourceUrl?: string;
  codings?: Coding[];
  featured?: boolean;

  // Strapi metadata
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  locale?: string;
}
