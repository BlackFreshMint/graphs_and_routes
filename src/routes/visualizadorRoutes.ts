import { Router } from 'express';
import { visualizarGrafo, visualizarRuta } from '../controllers/visualizadorController';

const router = Router();

// GET /api/visualizador - Muestra el grafo completo
router.get('/visualizador', visualizarGrafo);

// GET /api/visualizadorRuta?archivo=nombre.json - Visualiza ruta especificada
router.get('/visualizadorRuta', visualizarRuta);

export default router;
