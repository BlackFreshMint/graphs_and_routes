import fs from 'fs';
import path from 'path';
import express from 'express';

const app = express();
const publicPath = path.join(__dirname, 'public');

app.get('/debug-files', (req, res) => {
  fs.readdir(publicPath, (err, files) => {
    if (err) {
      res.status(500).send('Error leyendo archivos');
    } else {
      res.send(`<pre>${files.join('\n')}</pre>`);
    }
  });
});
