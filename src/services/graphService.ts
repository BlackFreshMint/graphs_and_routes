// src/services/graphService.ts
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fetch } from 'undici';
import * as dotenv from 'dotenv';
import cliProgress from 'cli-progress';
import minimist from 'minimist';

dotenv.config();

// Sección 1: Tipos
// ===================================================================
interface Oficina {
  clave_ofinica_postal: number;
  nombre_entidad: string;
  nombre_municipio: string;
  nombre_cuo: string;
  tipo_cuo?: string;
  domicilio: string;
  codigo_postal?: number;
  telefono?: string;
  latitud: number;
  longitud: number;
}

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

interface AristaLocal {
  origenIdx: number;
  destinoIdx: number;
  distancia: number;
  peso: number;
  polyline?: string;
}

interface GoogleRoutesResponse {
  routes?: {
    distanceMeters?: number;
    polyline?: {
      encodedPolyline: string;
    };
  }[];
}

// ===================================================================
// Sección 2: Configuración
// ===================================================================
const API_KEY = process.env.GOOGLE_MAPS_API_KEY; // Añadir esta línea
const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_GRAFO_DIR = path.join(DATA_DIR, 'cache', 'grafo');
const CACHE_RUTAS_DIR = path.join(DATA_DIR, 'cache', 'rutas');
const GRAFO_OUTPUT_PATH = path.join(DATA_DIR, 'grafo.json');

const ROUTE_REQUEST_DELAY_MS = Number(process.env.ROUTE_REQUEST_DELAY_MS) || 200;
const MAX_NEIGHBORS_PER_NODE = 10;

// Crear directorios de cache si no existen
const ensureCacheDirs = () => {
  [DATA_DIR, CACHE_GRAFO_DIR, CACHE_RUTAS_DIR].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
};
ensureCacheDirs();

// ===================================================================
// Sección 3: Funciones de Utilidad
// ===================================================================
const calcularDistancia = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const estaEnMexico = (lat: number, lng: number): boolean => {
  return lat >= 14 && lat <= 33 && lng >= -118 && lng <= -86;
};

const normalizar = (s: string): string => {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
};

const sleep = (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// ===================================================================
// Sección 4: Manejo de Caché de Rutas
// ===================================================================
const routeCacheKey = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const a = `${lat1.toFixed(5)}_${lng1.toFixed(5)}`;
  const b = `${lat2.toFixed(5)}_${lng2.toFixed(5)}`;
  return `${encodeURIComponent(a)}__${encodeURIComponent(b)}`;
};

const getRouteCachePath = (key: string) => {
  return path.join(CACHE_RUTAS_DIR, `${key}.json`);
};

const loadRouteFromCache = (key: string): { distancia: number; polyline: string } | null => {
  const cachePath = getRouteCachePath(key);
  if (!existsSync(cachePath)) return null;

  try {
    return JSON.parse(readFileSync(cachePath, 'utf-8'));
  } catch {
    return null;
  }
};

const saveRouteToCache = (key: string, payload: { distancia: number; polyline: string }) => {
  writeFileSync(getRouteCachePath(key), JSON.stringify(payload, null, 2), 'utf-8');
};

// ===================================================================
// Sección 5: Manejo de Caché de Estados
// ===================================================================
const getStateCachePath = (state: string) => {
  const safe = encodeURIComponent(normalizar(state));
  return path.join(CACHE_GRAFO_DIR, `${safe}.json`);
};

const loadStateCache = (state: string): { oficinas: Oficina[]; aristas: AristaLocal[] } | null => {
  const cachePath = getStateCachePath(state);
  if (!existsSync(cachePath)) return null;

  try {
    return JSON.parse(readFileSync(cachePath, 'utf-8'));
  } catch (err) {
    console.error(`Error leyendo cache estado ${state}:`, err);
    return null;
  }
};

const saveStateCache = (state: string, oficinas: Oficina[], aristas: AristaLocal[]) => {
  writeFileSync(
    getStateCachePath(state),
    JSON.stringify({ oficinas, aristas }, null, 2),
    'utf-8'
  );
};

const isStateCacheStale = (state: string, currentOficinas: Oficina[]): boolean => {
  const cached = loadStateCache(state);
  if (!cached) return true;

  return currentOficinas.some(current => {
    const cachedOficina = cached.oficinas.find(o => o.nombre_cuo === current.nombre_cuo);
    if (!cachedOficina) return true;

    const latDiff = Math.abs(cachedOficina.latitud - current.latitud);
    const lngDiff = Math.abs(cachedOficina.longitud - current.longitud);
    return latDiff > 1e-5 || lngDiff > 1e-5;
  });
};

// ===================================================================
// Sección 6: Operaciones de Red (CORREGIDA)
// ===================================================================
async function obtenerDistanciaRuta(origen: Nodo, destino: Nodo): Promise<{ distancia: number, polyline: string } | null> {
  const key = routeCacheKey(origen.lat, origen.lng, destino.lat, destino.lng);
  const cached = loadRouteFromCache(key);
  if (cached) return cached;

  await sleep(ROUTE_REQUEST_DELAY_MS);

  try {
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

    // Definir el cuerpo de la solicitud con tipo explícito
    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: origen.lat,
            longitude: origen.lng
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destino.lat,
            longitude: destino.lng
          }
        }
      },
      travelMode: 'DRIVE' as const,
      routingPreference: 'TRAFFIC_AWARE' as const,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY!,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify(requestBody),
    });

    const data = (await response.json()) as GoogleRoutesResponse;
    const route = data.routes?.[0];

    if (route?.distanceMeters && route?.polyline?.encodedPolyline) {
      const distancia = route.distanceMeters / 1000;
      const polyline = route.polyline.encodedPolyline;
      const payload = { distancia, polyline };

      saveRouteToCache(key, payload);
      return payload;
    }
  } catch (err) {
    console.error('Error al obtener ruta:', err);
  }

  return null;
}

// ===================================================================
// Sección 7: Operaciones de Grafos
// ===================================================================
const construirClusters = (nodos: Nodo[], aristas: Arista[]): number[] => {
  const parent = nodos.map((_, i) => i);

  const find = (x: number): number => {
    return parent[x] === x ? x : (parent[x] = find(parent[x]));
  };

  const union = (x: number, y: number) => {
    parent[find(x)] = find(y);
  };

  aristas.forEach(({ origen, destino }) => union(origen, destino));
  return parent.map(find);
};

const conectarClusters = async (nodos: Nodo[], aristas: Arista[]) => {
  const clusterIds = construirClusters(nodos, aristas);
  const clusterMap = new Map<number, Nodo[]>();

  nodos.forEach((nodo, index) => {
    const clusterId = clusterIds[index];
    clusterMap.set(clusterId, [...(clusterMap.get(clusterId) || []), nodo]);
  });

  const clusters = Array.from(clusterMap.values());
  console.log(`🔗 Detectados ${clusters.length} clusters`);

  if (clusters.length <= 1) return;

  for (let i = 0; i < clusters.length - 1; i++) {
    let mejorDistancia = Infinity;
    let mejorRuta: { a: Nodo; b: Nodo; ruta: Awaited<ReturnType<typeof obtenerDistanciaRuta>> } | null = null;

    for (const nodoA of clusters[i]) {
      for (const nodoB of clusters[i + 1]) {
        const distanciaLineal = calcularDistancia(nodoA.lat, nodoA.lng, nodoB.lat, nodoB.lng);
        if (distanciaLineal < mejorDistancia) {
          const ruta = await obtenerDistanciaRuta(nodoA, nodoB);
          if (ruta && ruta.distancia < mejorDistancia) {
            mejorDistancia = ruta.distancia;
            mejorRuta = { a: nodoA, b: nodoB, ruta };
          }
        }
      }
    }

    if (mejorRuta && mejorRuta.ruta) {
      const { a, b, ruta } = mejorRuta;
      aristas.push({
        origen: a.id,
        destino: b.id,
        distancia: ruta.distancia,
        peso: ruta.distancia,
        polyline: ruta.polyline,
      });
      console.log(`🌉 Conectado nodo ${a.id} con ${b.id} entre clusters`);
    }
  }
};

const procesarEstado = async (estado: string, todasOficinas: Oficina[]): Promise<{ oficinas: Oficina[]; aristas: AristaLocal[] } | null> => {
  const estadoNormalizado = normalizar(estado);
  const oficinasEstado = todasOficinas.filter(o =>
    normalizar(o.nombre_entidad) === estadoNormalizado
  );

  if (oficinasEstado.length === 0) {
    console.log(`⚠️ No hay oficinas para estado ${estado}, se omite.`);
    return null;
  }

  const cache = loadStateCache(estado);
  if (cache && !isStateCacheStale(estado, oficinasEstado)) {
    console.log(`🗂️ Cargado cache para estado ${estado} (${cache.oficinas.length} nodos)`);
    return cache;
  }

  console.log(`🔄 Generando cache para estado ${estado} (nodos: ${oficinasEstado.length})`);
  const nodos: Nodo[] = oficinasEstado.map((oficina, index) => ({
    id: index,
    nombre: oficina.nombre_cuo,
    categoria: oficina.tipo_cuo || 'Oficina',
    pesoCategoria: 1,
    lat: oficina.latitud,
    lng: oficina.longitud,
  }));

  const aristas: AristaLocal[] = [];
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(nodos.length, 0);

  for (let i = 0; i < nodos.length; i++) {
    const nodoActual = nodos[i];
    const vecinos = nodos
      .filter(n => n.id !== nodoActual.id)
      .map(n => ({
        nodo: n,
        distancia: calcularDistancia(nodoActual.lat, nodoActual.lng, n.lat, n.lng),
      }))
      .sort((a, b) => a.distancia - b.distancia);

    let conexiones = 0;
    for (const { nodo: vecino } of vecinos) {
      if (conexiones >= MAX_NEIGHBORS_PER_NODE) break;
      if (!estaEnMexico(vecino.lat, vecino.lng)) continue;

      const cacheKey = routeCacheKey(nodoActual.lat, nodoActual.lng, vecino.lat, vecino.lng);
      const rutaCache = loadRouteFromCache(cacheKey);

      if (rutaCache) {
        aristas.push({
          origenIdx: nodoActual.id,
          destinoIdx: vecino.id,
          distancia: rutaCache.distancia,
          peso: rutaCache.distancia,
          polyline: rutaCache.polyline,
        });
        conexiones++;
        continue;
      }

      const ruta = await obtenerDistanciaRuta(nodoActual, vecino);
      if (ruta) {
        aristas.push({
          origenIdx: nodoActual.id,
          destinoIdx: vecino.id,
          distancia: ruta.distancia,
          peso: ruta.distancia,
          polyline: ruta.polyline,
        });
        conexiones++;
      }
    }
    progressBar.update(i + 1);
  }

  progressBar.stop();
  saveStateCache(estado, oficinasEstado, aristas);
  console.log(`💾 Cache guardado para estado ${estado}`);

  return { oficinas: oficinasEstado, aristas };
};

const construirGrafoGlobal = (estadosData: { oficinas: Oficina[]; aristas: AristaLocal[] }[]) => {
  const nodosGlobal: Nodo[] = [];
  const aristasGlobal: Arista[] = [];
  let nextId = 0;

  const mapeoIds: Record<string, number[]> = {};

  estadosData.forEach(data => {
    const idsLocales: number[] = [];

    data.oficinas.forEach(oficina => {
      const nodo: Nodo = {
        id: nextId++,
        nombre: oficina.nombre_cuo,
        categoria: oficina.tipo_cuo || 'Oficina',
        pesoCategoria: 1,
        lat: oficina.latitud,
        lng: oficina.longitud,
      };
      nodosGlobal.push(nodo);
      idsLocales.push(nodo.id);
    });

    mapeoIds[data.oficinas[0].nombre_entidad] = idsLocales;

    data.aristas.forEach(aristaLocal => {
      const origenGlobal = idsLocales[aristaLocal.origenIdx];
      const destinoGlobal = idsLocales[aristaLocal.destinoIdx];

      aristasGlobal.push({
        origen: origenGlobal,
        destino: destinoGlobal,
        distancia: aristaLocal.distancia,
        peso: aristaLocal.peso,
        polyline: aristaLocal.polyline,
      });
    });
  });

  console.log(`🔢 Nodos globales: ${nodosGlobal.length}, Aristas iniciales: ${aristasGlobal.length}`);
  return { nodosGlobal, aristasGlobal };
};

// ===================================================================
// Función Principal
// ===================================================================
export async function generarGrafo(estados: string[] = []): Promise<{ nodos: Nodo[], aristas: Arista[] }> {
  if (!API_KEY) {
    throw new Error('Google Maps API Key no configurada');
  }

  const oficinasRaw = readFileSync(path.join(DATA_DIR, 'oficinas_coordenadas.json'), 'utf-8');
  const todasOficinas: Oficina[] = JSON.parse(oficinasRaw);

  const estadosSolicitados = estados.length > 0
    ? estados
    : Array.from(new Set(todasOficinas.map(o => o.nombre_entidad)));

  console.log('Estados solicitados:', estadosSolicitados);

  const estadosProcesados = await Promise.all(
    estadosSolicitados.map(estado => procesarEstado(estado, todasOficinas))
  );

  const estadosData = estadosProcesados.filter(Boolean) as { oficinas: Oficina[]; aristas: AristaLocal[] }[];

  const { nodosGlobal, aristasGlobal } = construirGrafoGlobal(estadosData);
  await conectarClusters(nodosGlobal, aristasGlobal);

  const grafo = { nodos: nodosGlobal, aristas: aristasGlobal };

  try {
    writeFileSync(GRAFO_OUTPUT_PATH, JSON.stringify(grafo, null, 2), 'utf-8');
    console.log('✅ grafo.json generado correctamente en', GRAFO_OUTPUT_PATH);
  } catch (err) {
    console.error('Error guardando grafo final:', err);
  }

  return grafo;
}

// ===================================================================
// Ejecución CLI
// ===================================================================
if (require.main === module) {
  (async () => {
    const argv = minimist(process.argv.slice(2));
    const estados = Array.isArray(argv.estado)
      ? argv.estado
      : argv.estado
        ? [argv.estado]
        : [];

    try {
      await generarGrafo(estados);
    } catch (err) {
      console.error('Error generando grafo (CLI):', err);
      process.exit(1);
    }
  })();
}
