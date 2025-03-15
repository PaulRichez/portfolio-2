import { Experience } from '../../app/services/experiences.service';

export class ExperiencesService {
  public static async getExperiences(): Promise<Experience[]> {
    // Temporary mock data - to be replaced with database query
    const experiences = [
      {
        id: 1,
        startDate: '2022-01',
        endDate: 'Present',
        job: 'Full Stack Developer',
        business: 'Tech Corp',
        businessWebsite: 'https://techcorp.com',
        descriptions: [
          'Developed responsive web applications using Angular and Node.js',
          'Implemented RESTful APIs for data integration'
        ]
      }
    ];

    return experiences;
  }
}