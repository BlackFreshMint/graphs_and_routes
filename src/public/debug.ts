import fs from 'fs';
import path from 'path';
import express from 'express';

const app = express();
const publicPath = path.join(__dirname); // o path.join(__dirname, 'public') en caso de querer limitar

function listarArchivosRecursivo(dir: string, basePath = dir, nivel = 0): string {
  let resultado = '';
  const indent = '  '.repeat(nivel);

  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      resultado += `${indent}${item.name}${item.isDirectory() ? '/' : ''}\n`;
      if (item.isDirectory()) {
        resultado += listarArchivosRecursivo(fullPath, basePath, nivel + 1);
      }
    }
  } catch (err) {
    resultado += `${indent}Error leyendo ${dir}: ${(err as Error).message}\n`;
  }

  return resultado;
}

app.get('/debug-files', (_req, res) => {
  const listado = listarArchivosRecursivo(publicPath);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(listado);
});

// ⚠️ Solo si este archivo es independiente (no parte de server.ts principal)
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`🛠️ Servidor de debug corriendo en http://localhost:${PORT}`);
// });
