import { readFileSync } from 'fs';
import fs from 'fs';

interface Nodo {
  id: number;
  nombre: string;
  categoria: string;
  pesoCategoria: number;
  lat: number;
  lng: number;
}

interface Arista {
  origen: number;
  destino: number;
  distancia: number;
  peso: number;
  polyline?: string;
}

export function cargarGrafo(path = 'src/data/grafo.json'): { nodos: Nodo[]; aristas: Arista[] } {
  const rawData = readFileSync(path, 'utf-8');
  return JSON.parse(rawData);
}

export function cargarRuta(rutaArchivo: string): { ruta: number[]; distanciaTotal: number } {
  const data = fs.readFileSync(rutaArchivo, 'utf-8');
  const json = JSON.parse(data);

  if (!Array.isArray(json.ruta) || typeof json.distanciaTotal !== 'number') {
    throw new Error('Archivo de ruta inválido');
  }

  return {
    ruta: json.ruta,
    distanciaTotal: json.distanciaTotal
  };
}

export function generarHTMLVisualizador(nodos: Nodo[], aristas: Arista[], apiKey: string): string {
  if (nodos.length === 0) throw new Error("No hay nodos para mostrar");
  const centerLat = nodos[0].lat;
  const centerLng = nodos[0].lng;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Grafo en Google Maps</title>
  <style>
    #map { height: 100vh; width: 100%; margin: 0; padding: 0; }
    html, body { margin: 0; padding: 0; height: 100%; }
  </style>
  <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}"></script>
  <script>
    function decodePolyline(encoded) {
      let points = [];
      let index = 0, lat = 0, lng = 0;
      while (index < encoded.length) {
        let b, shift = 0, result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        shift = 0;
        result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        points.push({ lat: lat / 1e5, lng: lng / 1e5 });
      }
      return points;
    }

    function initMap() {
      const map = new google.maps.Map(document.getElementById("map"), {
        zoom: 6,
        center: { lat: ${centerLat}, lng: ${centerLng} },
      });

      const nodos = ${JSON.stringify(nodos)};
      const aristas = ${JSON.stringify(aristas)};

      for (const nodo of nodos) {
        new google.maps.Marker({
          position: { lat: nodo.lat, lng: nodo.lng },
          map,
          label: nodo.id.toString(),
          title: nodo.nombre
        });
      }

      for (const arista of aristas) {
        if (arista.polyline) {
          const path = decodePolyline(arista.polyline);
          new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: "#0000FF",
            strokeOpacity: 0.8,
            strokeWeight: 3,
            map: map
          });
        } else {
          const origen = nodos.find(n => n.id === arista.origen);
          const destino = nodos.find(n => n.id === arista.destino);
          if (origen && destino) {
            new google.maps.Polyline({
              path: [
                { lat: origen.lat, lng: origen.lng },
                { lat: destino.lat, lng: destino.lng }
              ],
              geodesic: true,
              strokeColor: "#FF0000",
              strokeOpacity: 0.6,
              strokeWeight: 2,
              map: map
            });
          }
        }
      }
    }
    window.onload = initMap;
  </script>
</head>
<body>
  <div id="map"></div>
</body>
</html>`;
}

export function generarHTMLVisualizadorRuta(nodosRuta: Nodo[], aristasRuta: Arista[], apiKey: string): string {
  if (nodosRuta.length === 0) throw new Error("La ruta está vacía");
  const centerLat = nodosRuta[0].lat;
  const centerLng = nodosRuta[0].lng;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ruta entre nodos</title>
  <style>
    #map { height: 100vh; width: 100%; margin: 0; padding: 0; }
    html, body { margin: 0; padding: 0; height: 100%; }
  </style>
  <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}"></script>
  <script>
    function decodePolyline(encoded) {
      let points = [];
      let index = 0, lat = 0, lng = 0;
      while (index < encoded.length) {
        let b, shift = 0, result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        shift = 0;
        result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        points.push({ lat: lat / 1e5, lng: lng / 1e5 });
      }
      return points;
    }

    function initMap() {
      const map = new google.maps.Map(document.getElementById("map"), {
        zoom: 7,
        center: { lat: ${centerLat}, lng: ${centerLng} },
      });

      const nodos = ${JSON.stringify(nodosRuta)};
      const aristas = ${JSON.stringify(aristasRuta)};

      for (const nodo of nodos) {
        new google.maps.Marker({
          position: { lat: nodo.lat, lng: nodo.lng },
          map,
          label: nodo.id.toString(),
          title: nodo.nombre
        });
      }

      for (const arista of aristas) {
        if (arista.polyline) {
          const path = decodePolyline(arista.polyline);
          new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: "#00AA00",
            strokeOpacity: 0.9,
            strokeWeight: 4,
            map: map
          });
        }
      }
    }

    window.onload = initMap;
  </script>
</head>
<body>
  <div id="map"></div>
</body>
</html>`;
}
