// src/services/rutaService.ts
import { readFileSync } from 'fs';

export interface Nodo {
  id: number;
  nombre: string;
  categoria: string;
  pesoCategoria: number;
  lat: number;
  lng: number;
}

export interface Arista {
  origen: number;
  destino: number;
  distancia: number;
  peso: number;
  polyline?: string;
}

export type Grafo = {
  nodos: Nodo[];
  aristas: Arista[];
};

export function cargarGrafo(path: string): Grafo {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function dijkstra(grafo: Grafo, inicioId: number, finId: number): { ruta: number[], distanciaTotal: number } | null {
  const dist = new Map<number, number>();
  const prev = new Map<number, number | null>();
  const visitado = new Set<number>();

  for (const nodo of grafo.nodos) {
    dist.set(nodo.id, Infinity);
    prev.set(nodo.id, null);
  }

  dist.set(inicioId, 0);

  while (visitado.size < grafo.nodos.length) {
    let u: number | null = null;
    let minDist = Infinity;

    for (const [id, d] of dist.entries()) {
      if (!visitado.has(id) && d < minDist) {
        minDist = d;
        u = id;
      }
    }

    if (u === null || u === finId) break;

    visitado.add(u);

    const vecinos = grafo.aristas.filter(a =>
      a.origen === u || a.destino === u
    );

    for (const a of vecinos) {
      const vecino = a.origen === u ? a.destino : a.origen;
      const alt = dist.get(u)! + a.peso;

      if (alt < dist.get(vecino)!) {
        dist.set(vecino, alt);
        prev.set(vecino, u);
      }
    }
  }

  const ruta: number[] = [];
  let actual: number | null = finId;

  while (actual !== null) {
    ruta.unshift(actual);
    actual = prev.get(actual)!;
  }

  if (ruta[0] !== inicioId) return null;

  const distanciaTotal = ruta.reduce((acc, curr, i) => {
    if (i === 0) return 0;
    const a = ruta[i - 1];
    const b = curr;
    const arista = grafo.aristas.find(x =>
      (x.origen === a && x.destino === b) || (x.origen === b && x.destino === a)
    );
    return acc + (arista?.peso || Infinity);
  }, 0);

  return { ruta, distanciaTotal };
}
