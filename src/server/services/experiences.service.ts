import { Experience } from '../../app/services/experiences.service';
import { db } from '../db';

export class ExperiencesService {
  public static async getExperiences(): Promise<Experience[]> {
    try {
      const experiences = await db('experiences')
        .select({
          id: 'id',
          startDate: 'start_date',
          endDate: 'end_date',
          job: 'job',
          business: 'business',
          businessWebsite: 'business_website',
          descriptions: 'descriptions'
        });

      return experiences.map(exp => ({
        ...exp,
        descriptions: JSON.parse(exp.descriptions as string)
      }));
    } catch (error) {
      console.error('Error fetching experiences:', error);
      throw error;
    }
  }
}