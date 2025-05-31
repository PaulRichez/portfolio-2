import { Coding } from './coding.model';

export interface CodingSkill {
  id?: number;
  coding: Coding;
  level: 'beginner' | 'Intermediate' | 'advanced' | 'expert';
}
