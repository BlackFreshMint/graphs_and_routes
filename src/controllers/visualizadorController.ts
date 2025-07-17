import { Request, Response } from 'express';
import * as dotenv from 'dotenv';
dotenv.config();

import {
  cargarGrafo,
  cargarRuta,
  generarHTMLVisualizador,
  generarHTMLVisualizadorRuta
} from '../services/visualizadorService';

const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';

export function visualizarGrafo(req: Request, res: Response) {
  try {
    const { nodos, aristas } = cargarGrafo('src/data/grafo.json');
    const html = generarHTMLVisualizador(nodos, aristas, apiKey);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error visualizando grafo:', error);
    res.status(500).send('Error visualizando grafo');
  }
}

export function visualizarRuta(req: Request, res: Response) {
  try {
    const rutaArchivo = req.query.archivo;
    if (typeof rutaArchivo !== 'string') {
      res.status(400).send('Debe especificar el archivo de ruta con ?archivo=nombre.json');
      return;
    }

    const grafo = cargarGrafo('src/data/grafo.json');
    const ruta = cargarRuta(`src/data/rutas/${rutaArchivo}`);

    // Validar que ruta.ruta es un arreglo
    if (!Array.isArray(ruta.ruta)) {
      res.status(500).send('El archivo de ruta no contiene una propiedad "ruta" válida.');
      return;
    }

    // Filtrar nodos de la ruta
    const nodosRuta = grafo.nodos.filter(n => ruta.ruta.includes(n.id));

    // Construir aristas para la ruta
    const aristasRuta = [];
    for (let i = 0; i < ruta.ruta.length - 1; i++) {
      const a = ruta.ruta[i];
      const b = ruta.ruta[i + 1];
      const arista = grafo.aristas.find(
        x => (x.origen === a && x.destino === b) || (x.origen === b && x.destino === a)
      );
      if (arista) aristasRuta.push(arista);
    }

    const html = generarHTMLVisualizadorRuta(nodosRuta, aristasRuta, apiKey);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error visualizando ruta:', error);
    res.status(500).send('Error visualizando ruta');
  }
}
