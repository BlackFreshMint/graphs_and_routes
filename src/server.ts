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
  const publicPath = path.join(__dirname, 'public');

  fs.readdir(publicPath, { withFileTypes: true }, (err, files) => {
    if (err) {
      return res.status(500).send(`Error leyendo archivos: ${err.message}`);
    }

    const list = files.map(file => {
      const type = file.isDirectory() ? '[DIR]' : '[FILE]';
      return `${type} ${file.name}`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/plain');
    res.send(list);
  });
});

app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
