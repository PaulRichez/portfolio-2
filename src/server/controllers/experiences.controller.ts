import { Request, Response } from 'express';

export class ExperiencesController {
  public static async getExperiences(req: Request, res: Response) {
    try {
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

      return res.status(200).json(experiences);
    } catch (error) {
      console.error('Error fetching experiences:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}