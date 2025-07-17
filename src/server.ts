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

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', graphRoutes);
app.use('/api', rutaRoutes);
app.use('/api', visualizadorRoutes);

app.get('/debug-files', (req, res) => {
  const basePath = path.join(__dirname); // __dirname en dist ya ES la raíz de dist

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



app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
