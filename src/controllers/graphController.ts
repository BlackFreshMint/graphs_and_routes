import { Request, Response } from 'express';
import { generarGrafo } from '../services/graphService';
import * as dotenv from 'dotenv';

dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

const NO_API_KEY_HTML = `
  <html>
    <head><title>Error</title></head>
    <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 5rem;">
      <h1>Error: No hay API Key configurada</h1>
      <p>El servicio requiere una clave API para Google Maps.</p>
    </body>
  </html>
`;

const ERROR_HTML = (message: string) => `
  <html>
    <head><title>Error</title></head>
    <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 5rem;">
      <h1>No se ha podido acceder al servicio</h1>
      <p>Razón: ${message}</p>
    </body>
  </html>
`;

const parseEstadosParam = (estadosRaw: unknown): string[] => {
  if (typeof estadosRaw === 'string') {
    return estadosRaw.toLowerCase() === 'all' ? [] : [estadosRaw];
  }

  if (Array.isArray(estadosRaw)) {
    const hasAll = estadosRaw.some(e =>
      typeof e === 'string' && e.toLowerCase() === 'all'
    );
    return hasAll ? [] : estadosRaw.map(String);
  }

  return [];
};

export async function obtenerGrafo(req: Request, res: Response) {
  try {
    // Verificación única de API_KEY
    if (!GOOGLE_API_KEY) {
      return res.status(500).send(NO_API_KEY_HTML);
    }

    const estados = parseEstadosParam(req.query.estado);
    const grafo = await generarGrafo(estados);

    res.json(grafo);
  } catch (error: any) {
    console.error('Error generando el grafo:', error);
    res.status(500).send(ERROR_HTML(error.message || 'Error desconocido'));
  }
}
