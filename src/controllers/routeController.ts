import { Request, Response } from 'express';
import { cargarGrafo, dijkstra } from '../services/routeService';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

export function obtenerRuta(req: Request, res: Response) {
  const origen = parseInt(req.query.origen as string);
  const destino = parseInt(req.query.destino as string);

  if (isNaN(origen) || isNaN(destino)) {
    return res.status(400).json({ error: 'Parámetros inválidos: origen y destino son requeridos' });
  }

  const grafo = cargarGrafo('src/data/grafo.json');
  const resultado = dijkstra(grafo, origen, destino);

  if (!resultado) {
    return res.status(404).json({ error: 'No hay ruta entre los nodos especificados' });
  }

  // Guardar archivo para que visualizador pueda usarlo
  const carpeta = 'src/data/rutas';
  if (!existsSync(carpeta)) {
    mkdirSync(carpeta, { recursive: true });
  }

  const nombreArchivo = `${origen}_${destino}.json`;
  const rutaAbsoluta = path.join(carpeta, nombreArchivo);

  writeFileSync(rutaAbsoluta, JSON.stringify(resultado, null, 2), 'utf-8');

  return res.json(resultado);
}
