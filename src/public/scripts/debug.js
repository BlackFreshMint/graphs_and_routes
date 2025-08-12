document.addEventListener('DOMContentLoaded', () => {
  // Dark mode toggle button (floating)
  const floatingThemeBtn = document.getElementById('darkModeToggle');
  const bodyEl = document.body;

  if (!floatingThemeBtn) {
    console.error('Dark mode toggle button not found (id="darkModeToggle").');
  } else {
    function applyTheme(isDark) {
      if (isDark) {
        bodyEl.classList.add('dark-mode');
        floatingThemeBtn.textContent = 'Modo Claro';
        floatingThemeBtn.setAttribute('aria-pressed', 'true');
        try { localStorage.setItem('debug_theme', 'dark-mode'); } catch { }
      } else {
        bodyEl.classList.remove('dark-mode');
        floatingThemeBtn.textContent = 'Modo Oscuro';
        floatingThemeBtn.setAttribute('aria-pressed', 'false');
        try { localStorage.setItem('debug_theme', 'light'); } catch { }
      }
    }

    function initTheme() {
      let savedTheme = null;
      try {
        savedTheme = localStorage.getItem('debug_theme');
      } catch { }

      if (savedTheme === 'dark-mode') {
        applyTheme(true);
      } else if (savedTheme === 'light') {
        applyTheme(false);
      } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark);
      }
    }

    floatingThemeBtn.addEventListener('click', () => {
      const isDark = bodyEl.classList.contains('dark-mode');
      applyTheme(!isDark);
    });

    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) {
        mq.addEventListener('change', e => {
          try {
            if (!localStorage.getItem('debug_theme')) {
              applyTheme(e.matches);
            }
          } catch { }
        });
      } else if (mq.addListener) {
        mq.addListener(e => {
          try {
            if (!localStorage.getItem('debug_theme')) {
              applyTheme(e.matches);
            }
          } catch { }
        });
      }
    }

    initTheme();
  }

  // simulateProgress helper function
  function simulateProgress(progressBarId) {
    const progressBar = document.getElementById(progressBarId);
    if (!progressBar) return null;

    let width = 0;
    const interval = setInterval(() => {
      if (width >= 90) {
        clearInterval(interval);
        return;
      }
      width += 1;
      progressBar.style.width = width + '%';
    }, 50);

    return interval;
  }

  // cargarArchivos fetch + progress
  async function cargarArchivos() {
    const btn = document.getElementById('btnCargarArchivos');
    btn.disabled = true;
    const progressInterval = simulateProgress('progressArchivos');
    const status = document.getElementById('statusArchivos');
    status.textContent = 'Cargando...';
    try {
      const res = await fetch('/debug-files');
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const text = await res.text();
      document.getElementById('fileTree').textContent = text;
      document.getElementById('progressArchivos').style.width = '100%';
      status.textContent = 'Completado';
    } catch (err) {
      status.textContent = 'Error';
      document.getElementById('fileTree').textContent = 'Error: ' + (err.message || err);
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setTimeout(() => {
        document.getElementById('progressArchivos').style.width = '0%';
        btn.disabled = false;
      }, 700);
    }
  }
  document.getElementById('btnCargarArchivos').addEventListener('click', cargarArchivos);

  // Copy file tree text to clipboard
  document.getElementById('btnCopyFiles').addEventListener('click', async () => {
    const txt = document.getElementById('fileTree').textContent || '';
    try {
      await navigator.clipboard.writeText(txt);
      alert('Árbol copiado al portapapeles');
    } catch (e) {
      alert('No se pudo copiar: ' + e);
    }
  });

  // Download file tree text as file
  document.getElementById('btnDownloadFiles').addEventListener('click', () => {
    const txt = document.getElementById('fileTree').textContent || '';
    const blob = new Blob([txt], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'debug-files.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  /* ================= GRAFO & RUTA fetch helpers ================= */
  async function cargarJSON(inputId, outputId, progressId, statusId) {
    const url = document.getElementById(inputId).value;
    const output = document.getElementById(outputId);
    const status = document.getElementById(statusId);
    const progressInterval = simulateProgress(progressId);
    status.textContent = 'Cargando...';

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        output.value = JSON.stringify(data, null, 2);
      } catch (e) {
        output.value = text;
      }
      document.getElementById(progressId).style.width = '100%';
      status.textContent = 'Completado';
    } catch (err) {
      status.textContent = 'Error';
      output.value = 'Error: ' + (err.message || err);
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setTimeout(() => document.getElementById(progressId).style.width = '0%', 600);
    }
  }

  async function descargarJSON(inputId) {
    const url = document.getElementById(inputId).value;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const text = await res.text();
      const filename = sanitizeFilename(url) + '.json';
      const blob = new Blob([text], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert('Error al descargar: ' + (err.message || err));
    }
  }

  function sanitizeFilename(s) {
    return (s || 'download').replace(/[^a-z0-9\-_\.]/gi, '_').slice(0, 200);
  }

  // botones grafo & ruta
  document.getElementById('btnCargarGrafo').addEventListener('click', () => cargarJSON('grafoUrl', 'grafoOutput', 'progressGrafo', 'statusGrafo'));
  document.getElementById('btnDescargarGrafo').addEventListener('click', () => descargarJSON('grafoUrl'));

  document.getElementById('btnCargarRuta').addEventListener('click', () => cargarJSON('rutaUrl', 'rutaOutput', 'progressRuta', 'statusRuta'));
  document.getElementById('btnDescargarRuta').addEventListener('click', () => descargarJSON('rutaUrl'));

  // accesos rápidos (Enter en inputs)
  document.getElementById('grafoUrl').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { cargarJSON('grafoUrl', 'grafoOutput', 'progressGrafo', 'statusGrafo'); }
  });
  document.getElementById('rutaUrl').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { cargarJSON('rutaUrl', 'rutaOutput', 'progressRuta', 'statusRuta'); }
  });

  // Map variables
  let map;
  let markers = [];
  let baseLines = [];
  let rutasVisibles = [];

  async function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
      center: { lat: 23.6345, lng: -102.5528 },
      zoom: 5,
    });

    try {
      const response = await fetch("src/data/grafo.json");
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const grafo = await response.json();

      const nodos = grafo.nodos || [];
      const aristas = grafo.aristas || [];
      markers.forEach(m => m.setMap(null));
      baseLines.forEach(l => l.setMap(null));
      rutasVisibles.forEach(r => r.setMap(null));
      markers = [];
      baseLines = [];
      rutasVisibles = [];

      // Dibujar nodos
      nodos.forEach(nodo => {
        const marker = new google.maps.Marker({
          position: { lat: nodo.lat, lng: nodo.lng },
          map,
          title: `${nodo.nombre || 'Nodo'} (${nodo.id})`,
        });

        marker.addListener("click", () => {
          limpiarRutas();
          mostrarRutasNodo(nodo, aristas);
        });

        markers.push(marker);
      });

      // Dibujar aristas básicas (líneas grises)
      aristas.forEach(arista => {
        const origen = nodos.find(n => n.id === arista.origen);
        const destino = nodos.find(n => n.id === arista.destino);
        if (!origen || !destino) return;

        const line = new google.maps.Polyline({
          path: [
            { lat: origen.lat, lng: origen.lng },
            { lat: destino.lat, lng: destino.lng }
          ],
          geodesic: true,
          strokeColor: "#888",
          strokeOpacity: 0.6,
          strokeWeight: 2,
          map,
        });

        line.addListener("click", () => {
          limpiarRutas();
          mostrarRutaPolyline(arista);
        });

        baseLines.push(line);
      });
    } catch (err) {
      console.error('Error al inicializar mapa:', err);
      alert('No se pudo cargar el grafo para el mapa: ' + (err.message || err));
    }
  }

  function mostrarRutaPolyline(arista) {
    if (!arista) return;
    if (!arista.polyline) {
      // fallback simple sin polyline codificada
      if (!arista.origen || !arista.destino) return;
      rutasVisibles.push(new google.maps.Polyline({
        path: [
          // Aquí podrías agregar lat/lng si los tienes
        ],
        geodesic: true,
        strokeColor: "#FF0000",
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map,
      }));
      return;
    }
    try {
      const path = google.maps.geometry.encoding.decodePath(arista.polyline);
      const ruta = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#FF0000",
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map,
      });
      rutasVisibles.push(ruta);
      map.fitBounds(getBoundsFromPath(path));
    } catch (err) {
      console.error('Error decoding polyline:', err);
    }
  }

  function mostrarRutasNodo(nodo, aristas) {
    const rutasNodo = aristas.filter(a => a.origen === nodo.id || a.destino === nodo.id);
    rutasNodo.forEach(a => mostrarRutaPolyline(a));
  }

  function limpiarRutas() {
    rutasVisibles.forEach(r => r.setMap(null));
    rutasVisibles = [];
  }

  function getBoundsFromPath(path) {
    const bounds = new google.maps.LatLngBounds();
    path.forEach(p => bounds.extend(p));
    return bounds;
  }

  function toggleMap() {
    const mapDiv = document.getElementById('map');
    if (mapDiv.style.display === 'none' || mapDiv.style.display === '') {
      mapDiv.style.display = 'block';
      if (!map) initMap();
    } else {
      mapDiv.style.display = 'none';
      limpiarRutas();
    }
  }

  document.getElementById('toggleMapBtn').addEventListener('click', toggleMap);
});
