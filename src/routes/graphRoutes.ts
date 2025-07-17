import { Router } from 'express';
import { obtenerGrafo } from '../controllers/graphController';

const router = Router();

// Cambiar la ruta a /grafo para que coincida con la URL
router.get('/grafo', obtenerGrafo);

export default router;
