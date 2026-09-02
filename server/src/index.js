import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cron from 'node-cron';
import { moduleAccessRequired, portalSessionRequired } from './auth.js';
import { activosRouter } from './routes/activos.js';
import { activosSelfRouter } from './routes/activosSelf.js';
import { tercerosRouter } from './routes/terceros.js';
import { auditMutations, auditRouter } from './audit.js';
import { isSapConfigured } from './integrations/sapClient.js';
import { syncAllSap } from './integrations/sapSync.js';
import { assetSuiteRouter } from './routes/assetSuite.js';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '5mb' }));
app.use(auditMutations());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/activos', moduleAccessRequired, auditRouter, activosRouter);
app.use('/api/activos-suite', moduleAccessRequired, assetSuiteRouter);
app.use('/api/activos-self', portalSessionRequired, activosSelfRouter);
app.use('/api', moduleAccessRequired, tercerosRouter);

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno' });
});

// Copia local + escritura en ambos lados con SAP (ActivosTI): cada
// POST/PATCH de /api/activos ya empuja en vivo (ver routes/activos.js);
// este job periódico reintenta lo que haya fallado y hala lo que haya
// cambiado del lado de SAP. Corre también una vez al iniciar, mismo patrón
// que el sync de CONTPAQi en MRTI-RH.
const SAP_SYNC_CRON = process.env.SAP_SYNC_CRON || '*/15 * * * *';
if (isSapConfigured()) {
  const runSapSync = () => {
    syncAllSap()
      .then((result) => console.log('[sap] sync OK', result))
      .catch((error) => console.error('[sap] sync falló:', error.message));
  };
  runSapSync();
  cron.schedule(SAP_SYNC_CRON, runSapSync);
} else {
  // eslint-disable-next-line no-console
  console.warn('[sap] SAP_DB_* no configurado; la integración con SAP queda desactivada.');
}

const port = Number(process.env.PORT || 3003);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`MRTI Activos API escuchando en http://localhost:${port}`);
});
