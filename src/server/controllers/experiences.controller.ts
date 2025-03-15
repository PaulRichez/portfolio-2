import { Request, Response } from 'express';
import { ExperiencesService } from '../services/experiences.service';

export class ExperiencesController {
  public static async getExperiences(req: Request, res: Response) {
    try {
      const experiences = await ExperiencesService.getExperiences();
      return res.status(200).json(experiences);
    } catch (error) {
      console.error('Error fetching experiences:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}