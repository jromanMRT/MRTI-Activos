import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { moduleAccessRequired, portalSessionRequired } from './auth.js';
import { activosRouter } from './routes/activos.js';
import { activosSelfRouter } from './routes/activosSelf.js';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/activos', moduleAccessRequired, activosRouter);
app.use('/api/activos-self', portalSessionRequired, activosSelfRouter);

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno' });
});

const port = Number(process.env.PORT || 3003);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`MRTI Activos API escuchando en http://localhost:${port}`);
});
