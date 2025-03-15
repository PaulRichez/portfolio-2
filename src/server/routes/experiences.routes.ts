import { Router } from 'express';
import { ExperiencesController } from '../controllers/experiences.controller';

const router = Router();

router.get('/', ExperiencesController.getExperiences);

export default router;