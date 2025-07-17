import fs from 'fs';
import path from 'path';
import express from 'express';

const app = express();
const publicPath = path.join(__dirname, 'src');

function listarArchivosRecursivo(dir: string, basePath = dir, nivel = 0): string {
  let resultado = '';
  const indent = '  '.repeat(nivel);

  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      const relativePath = path.relative(basePath, fullPath);
      resultado += `${indent}${item.name}${item.isDirectory() ? '/' : ''}\n`;
      if (item.isDirectory()) {
        resultado += listarArchivosRecursivo(fullPath, basePath, nivel + 1);
      }
    }
  } catch (err) {
    resultado += `${indent}Error leyendo ${dir}: ${err}\n`;
  }

  return resultado;
}

app.get('/debug-files', (req, res) => {
  const listado = listarArchivosRecursivo(publicPath);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(listado);
});

// Aquí deberías añadir app.listen si este es todo el archivo
// Por ejemplo:
// const PORT = 3000;
// app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
