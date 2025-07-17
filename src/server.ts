import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import graphRoutes from './routes/graphRoutes';
import rutaRoutes from './routes/rutaRoutes';
import visualizadorRoutes from './routes/visualizadorRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', graphRoutes);
app.use('/api', rutaRoutes);
app.use('/api', visualizadorRoutes);
app.use('/debug-files', express.static(path.join(__dirname, '../public/debug.ts')));
app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
