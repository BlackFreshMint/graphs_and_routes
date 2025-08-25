import { Router } from 'express';
import { obtenerGrafo } from '../controllers/graphController';

const router = Router();
router.get('/grafo', obtenerGrafo);

export default router;
