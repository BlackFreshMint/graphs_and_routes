// src/services/graphService.ts
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fetch } from 'undici';
import * as dotenv from 'dotenv';
import cliProgress from 'cli-progress';
import minimist from 'minimist';

dotenv.config();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
if (!GOOGLE_API_KEY) {
  console.warn("Service is unable due to the lack of an API key");
  // Evita que el código se ejecute
  module.exports = {}; // exporta vacío para que otros módulos no fallen
}


// -------------------- Configurables --------------------
const DATA_DIR = path.join(__dirname, '..', 'data'); // src/data
const CACHE_GRAFO_DIR = path.join(DATA_DIR, 'cache', 'grafo');
const CACHE_RUTAS_DIR = path.join(DATA_DIR, 'cache', 'rutas');
const GRAFO_OUTPUT_PATH = path.join(DATA_DIR, 'grafo.json');

// Delay between route requests (ms) to avoid rate limit spikes
const ROUTE_REQUEST_DELAY_MS = Number(process.env.ROUTE_REQUEST_DELAY_MS) || 200;
// Concurrency for parallel route requests (kept low to be safe)
const BATCH_CONCURRENCY = Number(process.env.BATCH_CONCURRENCY) || 3;

// Ensure cache dirs exist
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(CACHE_GRAFO_DIR)) mkdirSync(CACHE_GRAFO_DIR, { recursive: true });
if (!existsSync(CACHE_RUTAS_DIR)) mkdirSync(CACHE_RUTAS_DIR, { recursive: true });

// -------------------- Tipos --------------------
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

function calcularDistancia(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estaEnMexico(lat: number, lng: number): boolean {
  return lat >= 14 && lat <= 33 && lng >= -118 && lng <= -86;
}

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function routeCacheKey(lat1: number, lng1: number, lat2: number, lng2: number) {
  // rounded to 5 decimals to normalize
  const a = `${lat1.toFixed(5)}_${lng1.toFixed(5)}`;
  const b = `${lat2.toFixed(5)}_${lng2.toFixed(5)}`;
  return `${encodeURIComponent(a)}__${encodeURIComponent(b)}`;
}

function getRouteCachePath(key: string) {
  return path.join(CACHE_RUTAS_DIR, `${key}.json`);
}

function loadRouteFromCache(key: string): { distancia: number; polyline: string } | null {
  const p = getRouteCachePath(key);
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, 'utf-8');
    return JSON.parse(raw) as { distancia: number; polyline: string };
  } catch {
    return null;
  }
}

function saveRouteToCache(key: string, payload: { distancia: number; polyline: string }) {
  const p = getRouteCachePath(key);
  writeFileSync(p, JSON.stringify(payload, null, 2), 'utf-8');
}

function getStateCachePath(state: string) {
  const safe = encodeURIComponent(normalizar(state));
  return path.join(CACHE_GRAFO_DIR, `${safe}.json`);
}

function loadStateCache(state: string): { oficinas: Oficina[]; aristas: AristaLocal[] } | null {
  const p = getStateCachePath(state);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as { oficinas: Oficina[]; aristas: AristaLocal[] };
  } catch (err) {
    console.error('Error leyendo cache estado:', state, err);
    return null;
  }
}

function saveStateCache(state: string, oficinas: Oficina[], aristas: AristaLocal[]) {
  const p = getStateCachePath(state);
  writeFileSync(p, JSON.stringify({ oficinas, aristas }, null, 2), 'utf-8');
}

function isStateCacheStale(state: string, currentOficinas: Oficina[]): boolean {
  const cached = loadStateCache(state);
  if (!cached) return true;
  const cachedMap = new Map<string, Oficina>();
  for (const o of cached.oficinas) cachedMap.set(o.nombre_cuo, o);
  for (const cur of currentOficinas) {
    const c = cachedMap.get(cur.nombre_cuo);
    if (!c) return true; // new office -> treat as stale (or we could append)
    // if coordinates changed more than a small epsilon, mark stale
    const latDiff = Math.abs(c.latitud - cur.latitud);
    const lngDiff = Math.abs(c.longitud - cur.longitud);
    if (latDiff > 1e-5 || lngDiff > 1e-5) return true;
  }
  return false;
}

async function obtenerDistanciaRuta(origen: Nodo, destino: Nodo): Promise<{ distancia: number, polyline: string } | null> {
  // Check route cache
  const key = routeCacheKey(origen.lat, origen.lng, destino.lat, destino.lng);
  const cached = loadRouteFromCache(key);
  if (cached) {
    return { distancia: cached.distancia, polyline: cached.polyline };
  }

  // If not cached: make request (with small delay to avoid rate limiting)
  try {
    // Respect delay (sequential caller should await this)
    await sleep(ROUTE_REQUEST_DELAY_MS);

    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    const body = {
      origin: { location: { latLng: { latitude: origen.lat, longitude: origen.lng } } },
      destination: { location: { latLng: { latitude: destino.lat, longitude: destino.lng } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as unknown as GoogleRoutesResponse;
    const route = data.routes?.[0];

    if (route?.distanceMeters && route?.polyline?.encodedPolyline) {
      const payload = {
        distancia: route.distanceMeters / 1000,
        polyline: route.polyline.encodedPolyline,
      };
      // Save to cache
      try { saveRouteToCache(key, payload); } catch (err) { /* non-fatal */ }
      return payload;
    }
  } catch (err) {
    console.error('Error al obtener ruta:', err);
  }
  return null;
}

function construirClusters(nodos: Nodo[], aristas: Arista[]): number[] {
  const parent = nodos.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : parent[x] = find(parent[x]));
  const union = (x: number, y: number) => { parent[find(x)] = find(y); };
  for (const { origen, destino } of aristas) union(origen, destino);
  return parent.map(find);
}

async function conectarClusters(nodos: Nodo[], aristas: Arista[]) {
  const clusterIds = construirClusters(nodos, aristas);
  const clusterMap = new Map<number, Nodo[]>();
  nodos.forEach((n, i) => {
    const cid = clusterIds[i];
    if (!clusterMap.has(cid)) clusterMap.set(cid, []);
    clusterMap.get(cid)!.push(n);
  });

  const clusters = Array.from(clusterMap.values());
  console.log(`🔗 Detectados ${clusters.length} clusters`);

  if (clusters.length <= 1) return;

  for (let i = 0; i < clusters.length - 1; i++) {
    let mejorDist = Infinity;
    let mejorRuta: { a: Nodo; b: Nodo; ruta: Awaited<ReturnType<typeof obtenerDistanciaRuta>> | null } | null = null;

    for (const a of clusters[i]) {
      for (const b of clusters[i + 1]) {
        const straight = calcularDistancia(a.lat, a.lng, b.lat, b.lng);
        if (straight < mejorDist) {
          const ruta = await obtenerDistanciaRuta(a, b);
          if (ruta && ruta.distancia < mejorDist) {
            mejorDist = ruta.distancia;
            mejorRuta = { a, b, ruta };
          }
        }
      }
    }

    if (mejorRuta) {
      const { a, b, ruta } = mejorRuta;
      aristas.push({
        origen: a.id,
        destino: b.id,
        distancia: ruta!.distancia,
        peso: ruta!.distancia,
        polyline: ruta!.polyline,
      });
      console.log(`🌉 Conectado nodo ${a.id} con ${b.id} entre clusters`);
    }
  }
}

export async function generarGrafo(estados: string[] = []): Promise<{ nodos: Nodo[], aristas: Arista[] }> {
  const oficinasRaw = readFileSync(path.join(DATA_DIR, 'oficinas_coordenadas.json'), 'utf-8');
  const todasOficinas: Oficina[] = JSON.parse(oficinasRaw);

  const estadosSolicitados = estados.length > 0 ? estados.map(normalizar) :
    Array.from(new Set(todasOficinas.map(o => normalizar(o.nombre_entidad))));

  console.log('Estados solicitados:', estadosSolicitados);

  const statesData: { state: string; oficinas: Oficina[]; aristasLocal: AristaLocal[] }[] = [];

  for (const estadoNorm of estadosSolicitados) {
    const oficinasEstado = todasOficinas.filter(o => normalizar(o.nombre_entidad) === estadoNorm);

    if (oficinasEstado.length === 0) {
      console.log(`⚠️ No hay oficinas para estado ${estadoNorm}, se omite.`);
      continue;
    }

    const stateCache = loadStateCache(estadoNorm);
    const stale = isStateCacheStale(estadoNorm, oficinasEstado);

    if (stateCache && !stale) {
      console.log(`🗂️ Cargado cache para estado ${estadoNorm} (${stateCache.oficinas.length} nodos)`);
      statesData.push({ state: estadoNorm, oficinas: stateCache.oficinas, aristasLocal: stateCache.aristas });
      continue;
    }

    console.log(`🔄 Generando cache para estado ${estadoNorm} (nodos: ${oficinasEstado.length})`);

    const nodosLocales: Nodo[] = oficinasEstado.map((o, i) => ({
      id: i,
      nombre: o.nombre_cuo,
      categoria: o.tipo_cuo || 'Oficina',
      pesoCategoria: 1,
      lat: o.latitud,
      lng: o.longitud,
    }));

    const aristasLocales: AristaLocal[] = [];
    const K = 10;

    const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progress.start(nodosLocales.length, 0);

    for (let i = 0; i < nodosLocales.length; i++) {
      const nodo = nodosLocales[i];
      const vecinos = nodosLocales
        .filter(n => n.id !== nodo.id)
        .map(n => ({ destino: n, distancia: calcularDistancia(nodo.lat, nodo.lng, n.lat, n.lng) }))
        .sort((a, b) => a.distancia - b.distancia);

      let conexiones = 0;
      for (const { destino } of vecinos) {
        if (conexiones >= K) break;
        if (!estaEnMexico(destino.lat, destino.lng)) continue;

        const key = routeCacheKey(nodo.lat, nodo.lng, destino.lat, destino.lng);
        const rCached = loadRouteFromCache(key);
        if (rCached) {
          aristasLocales.push({
            origenIdx: nodo.id,
            destinoIdx: destino.id,
            distancia: rCached.distancia,
            peso: rCached.distancia,
            polyline: rCached.polyline,
          });
          conexiones++;
          continue;
        }

        const ruta = await obtenerDistanciaRuta(nodo, destino);
        if (ruta) {
          aristasLocales.push({
            origenIdx: nodo.id,
            destinoIdx: destino.id,
            distancia: ruta.distancia,
            peso: ruta.distancia,
            polyline: ruta.polyline,
          });
          conexiones++;
        }
      }

      progress.update(i + 1);
    }

    progress.stop();

    // Guardar cache de estado
    try {
      saveStateCache(estadoNorm, oficinasEstado, aristasLocales);
      console.log(`💾 Cache guardado para estado ${estadoNorm}`);
    } catch (err) {
      console.error('Error guardando cache estado', estadoNorm, err);
    }

    statesData.push({ state: estadoNorm, oficinas: oficinasEstado, aristasLocal: aristasLocales });
  }

  const nodosGlobal: Nodo[] = [];
  const aristasGlobal: Arista[] = [];

  const stateLocalToGlobal = new Map<string, number[]>();
  let nextGlobalId = 0;

  for (const st of statesData) {
    const mapping: number[] = [];
    for (let i = 0; i < st.oficinas.length; i++) {
      const o = st.oficinas[i];
      const newNodo: Nodo = {
        id: nextGlobalId,
        nombre: o.nombre_cuo,
        categoria: o.tipo_cuo || 'Oficina',
        pesoCategoria: 1,
        lat: o.latitud,
        lng: o.longitud,
      };
      nodosGlobal.push(newNodo);
      mapping.push(nextGlobalId);
      nextGlobalId++;
    }
    stateLocalToGlobal.set(st.state, mapping);
    for (const al of st.aristasLocal) {
      const origenGlobal = mapping[al.origenIdx];
      const destinoGlobal = mapping[al.destinoIdx];
      aristasGlobal.push({
        origen: origenGlobal,
        destino: destinoGlobal,
        distancia: al.distancia,
        peso: al.peso,
        polyline: al.polyline,
      });
    }
  }

  console.log(`🔢 Nodos globales: ${nodosGlobal.length}, Aristas iniciales: ${aristasGlobal.length}`);

  await conectarClusters(nodosGlobal, aristasGlobal);

  const grafo = { nodos: nodosGlobal, aristas: aristasGlobal };

  // Guardar grafo final
  try {
    writeFileSync(GRAFO_OUTPUT_PATH, JSON.stringify(grafo, null, 2), 'utf-8');
    console.log('✅ grafo.json generado correctamente en', GRAFO_OUTPUT_PATH);
  } catch (err) {
    console.error('Error guardando grafo final:', err);
  }

  return grafo;
}

if (require.main === module) {
  (async () => {
    const argv = minimist(process.argv.slice(2));
    const estados = Array.isArray(argv.estado) ? argv.estado : argv.estado ? [argv.estado] : [];
    try {
      await generarGrafo(estados);
    } catch (err) {
      console.error('Error generando grafo (CLI):', err);
      process.exit(1);
    }
  })();
}
