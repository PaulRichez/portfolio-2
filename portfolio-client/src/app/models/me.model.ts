import { Language } from './language.model';
import { CodingSkill } from './coding-skill.model';
import { Diploma } from './diploma.model';
import { Experience } from './experience.model';
import { Project } from './project.model';

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
  coding_skills?: CodingSkill[];
  experiences?: Experience[];
  diplomas?: Diploma[];
  projects?: Project[];

  // Strapi metadata
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  locale?: string;
}
