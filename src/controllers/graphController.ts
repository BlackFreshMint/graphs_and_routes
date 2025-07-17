import { Request, Response } from 'express';
import { generarGrafo } from '../services/graphService';

export async function obtenerGrafo(req: Request, res: Response) {
  try {
    const estadosRaw = req.query.estado;
    let estados: string[] = [];

    if (typeof estadosRaw === 'string') {
      estados = [estadosRaw];
    } else if (Array.isArray(estadosRaw)) {
      // Convierte cada elemento a string para evitar errores de tipos
      estados = estadosRaw.map(String);
    }

    const grafo = await generarGrafo(estados);
    res.json(grafo);
  } catch (error) {
    console.error('Error generando el grafo:', error);
    res.status(500).json({ error: 'Error generando grafo' });
  }
}
