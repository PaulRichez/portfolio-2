import { Language } from './language.model';
import { Knowledge } from './knowledge.model';
import { Coding } from './coding.model';
import { Diploma } from './diploma.model';
import { Experience } from './experience.model';

export interface Me {
  id?: number;
  documentId?: string;
  firstName: string;
  lastName: string;
  email: string;
  city?: string;
  birthDay?: string; // ISO date string
  phoneNumber?: string;
  postName?: string;
  linkedin?: string;
  github?: string;
  website?: string;

  // Component relationships
  languages?: Language[];
  knowledges?: Knowledge[];
  codings?: Coding[];
  experiences?: Experience[];
  diplomas?: Diploma[];

  // Strapi metadata
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  locale?: string;
}
