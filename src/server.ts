import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

import graphRoutes from './routes/graphRoutes';
import rutaRoutes from './routes/rutaRoutes';
import visualizadorRoutes from './routes/visualizadorRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Prevent depoly fail by no API key in env / deplou will stay on event without the key
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
if (!GOOGLE_API_KEY) {
  console.warn("Advertencia: GOOGLE_API_KEY no está definida. Funciones dependientes de Google Maps estarán deshabilitadas o usarán datos de prueba.");
}

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

//index
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


//Middleware to block anything what needs the API if it doesnt exist
function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!GOOGLE_API_KEY) {
    return res.status(503).json({
      error: "Funcionalidad no disponible: falta GOOGLE_API_KEY",
      mockData: { example: true, routes: [{ from: "A", to: "B", distance: 12 }] }
    });
  }
  next();
}

// Endpoints
app.use('/api', graphRoutes);
app.use('/api', rutaRoutes);
app.use('/api', visualizadorRoutes);

// app.use('/api/grafo', requireApiKey, graphRoutes);
// app.use('/api/ruta', requireApiKey, rutaRoutes);

app.get('/debug-files', (req, res) => {
  const basePath = path.join(__dirname);

  function listarRecursivo(dir: string, nivel = 0): string {
    let resultado = '';
    const indent = '  '.repeat(nivel);
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const type = entry.isDirectory() ? '[DIR] ' : '[FILE]';
        resultado += `${indent}${type}${entry.name}\n`;
        if (entry.isDirectory()) {
          resultado += listarRecursivo(fullPath, nivel + 1);
        }
      }
    } catch (err) {
      resultado += `${indent}Error leyendo ${dir}: ${(err as Error).message}\n`;
    }
    return resultado;
  }

  try {
    const listado = listarRecursivo(basePath);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(listado);
  } catch (err) {
    res.status(500).send(`Error leyendo archivos: ${(err as Error).message}`);
  }
});

app.get('/debug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'debug.html'));
});

app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

app.get('/logs', (req, res) => {
  setTimeout(() => {
    res.json({ logs: ['Log 1', 'Log 2', 'Log 3'] });
  }, 2000);
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
