import { Request, Response } from 'express';
import { generarGrafo } from '../services/graphService';

export async function obtenerGrafo(req: Request, res: Response) {
  try {
    if (typeof generarGrafo !== 'function') {
      return res.status(500).send('Servicio no disponible');
    }

    const estadosRaw = req.query.estado;
    let estados: string[] = [];

    if (typeof estadosRaw === 'string') {
      if (estadosRaw.toLowerCase() === 'all') {
        estados = []; // vacío para todos los estados
      } else {
        estados = [estadosRaw];
      }
    } else if (Array.isArray(estadosRaw)) {
      if (estadosRaw.some(e => typeof e === 'string' && e.toLowerCase() === 'all')) {

        estados = [];
      } else {
        estados = estadosRaw.map(String);
      }
    }

    const grafo = await generarGrafo(estados);
    res.json(grafo);
  } catch (error: any) {
    console.error('Error generando el grafo:', error);

    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 5rem;">
          <h1>No se ha podido acceder al servicio</h1>
          <p>Razón: ${error.message || 'Error desconocido'}</p>
        </body>
      </html>
    `);
  }
}
