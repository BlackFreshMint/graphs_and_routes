// src/routes/rutaRoutes.ts
import { Router } from 'express';
import { obtenerRuta } from '../controllers/routeController';

const router = Router();

router.get('/ruta', obtenerRuta);

export default router;
