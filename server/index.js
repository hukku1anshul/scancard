import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runScan } from './pipeline.js';
import { resolveConfig, capabilities } from './config.js';
import { pushHubSpot, pushSalesforce } from './crm.js';
import {
  initDB,
  getAllRecords,
  getRecordById,
  upsertRecord,
  patchRecord,
  deleteRecord,
  syncRecords,
  getAnalytics,
  flushToDisk,
} from './db.js';
import { renderExecutiveHtmlReport } from './report.js';

const app = express();
app.use(express.json({ limit: '25mb' }));

// Initialize persistent database
initDB();

/** GET /api/health */
app.get('/api/health', (req, res) => {
  res.json(capabilities(resolveConfig(req)));
});

/** GET /api/analytics */
app.get('/api/analytics', (req, res) => {
  try {
    res.json({ ok: true, ...getAnalytics() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** GET /api/records */
app.get('/api/records', (req, res) => {
  try {
    const data = getAllRecords(req.query);
    res.json({ ok: true, ...data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** GET /api/records/:id */
app.get('/api/records/:id', (req, res) => {
  const rec = getRecordById(req.params.id);
  if (!rec) return res.status(404).json({ ok: false, message: 'Record not found' });
  res.json({ ok: true, record: rec });
});

/** POST /api/records */
app.post('/api/records', (req, res) => {
  try {
    const record = req.body?.record;
    if (!record || !record.id) return res.status(400).json({ ok: false, message: 'Missing record or record.id' });
    const saved = upsertRecord(record);
    res.json({ ok: true, record: saved });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** POST /api/records/sync (batch merge offline scans) */
app.post('/api/records/sync', (req, res) => {
  try {
    const list = req.body?.records || [];
    const result = syncRecords(list);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** PATCH /api/records/:id */
app.patch('/api/records/:id', (req, res) => {
  try {
    const updated = patchRecord(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ ok: false, message: 'Record not found' });
    res.json({ ok: true, record: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** DELETE /api/records/:id */
app.delete('/api/records/:id', (req, res) => {
  const deleted = deleteRecord(req.params.id);
  res.json({ ok: true, deleted });
});

/** GET /api/export/report/:id (Printable Executive KYC & Company Dossier) */
app.get('/api/export/report/:id', (req, res) => {
  const rec = getRecordById(req.params.id);
  if (!rec) return res.status(404).send('Record not found');
  const html = renderExecutiveHtmlReport(rec);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/**
 * POST /api/scan
 * Body: { images?: [{ data: base64, mimeType }], card?: Card, scanMode?: ScanMode, refresh?: boolean }
 * Response: NDJSON stream of progress events (step / card / result / error).
 */
app.post('/api/scan', async (req, res) => {
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let closed = false;
  res.on('close', () => { closed = true; });
  const emit = (evt) => {
    if (!closed) res.write(JSON.stringify(evt) + '\n');
  };

  try {
    await runScan(req.body || {}, resolveConfig(req), emit, () => closed);
  } catch (err) {
    console.error('[scan] failed:', err);
    emit({ type: 'error', message: err?.message || 'Scan failed' });
  }
  res.end();
});

/** POST /api/crm/:provider  Body: { record: ScanRecord } */
app.post('/api/crm/:provider', async (req, res) => {
  const cfg = resolveConfig(req);
  const record = req.body?.record;
  if (!record?.card) return res.status(400).json({ ok: false, message: 'Missing record' });
  try {
    if (req.params.provider === 'hubspot') {
      if (!cfg.hubspotToken) throw new Error('HubSpot token not configured');
      const result = await pushHubSpot(record, cfg.hubspotToken);
      if (record.id) patchRecord(record.id, { crmSynced: { provider: 'hubspot', at: Date.now() } });
      return res.json(result);
    }
    if (req.params.provider === 'salesforce') {
      if (!cfg.sfInstanceUrl || !cfg.sfAccessToken) throw new Error('Salesforce instance URL / access token not configured');
      const result = await pushSalesforce(record, cfg.sfInstanceUrl, cfg.sfAccessToken);
      if (record.id) patchRecord(record.id, { crmSynced: { provider: 'salesforce', at: Date.now() } });
      return res.json(result);
    }
    res.status(404).json({ ok: false, message: 'Unknown CRM provider' });
  } catch (err) {
    console.error('[crm] failed:', err.message);
    res.status(502).json({ ok: false, message: err.message });
  }
});

// Serve built PWA in production
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
app.use(express.static(dist));
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) res.status(404).send('Frontend not built. Run "npm run build" or use "npm run dev".');
  });
});

const port = Number(process.env.PORT) || 8787;
const server = app.listen(port, () => {
  const cfg = resolveConfig();
  console.log(`CardIntel API listening on http://localhost:${port}`);
  if (cfg.geminiKey) {
    console.log(`  Live Gemini AI enabled (model: ${cfg.geminiModel}, grounding: ${cfg.grounding ? 'on' : 'off'})`);
  } else {
    console.log('  (no GEMINI_API_KEY in server environment — running in demo mode)');
  }
});

// Graceful shutdown
const shutdown = () => {
  console.log('[server] Shutting down, persisting database...');
  flushToDisk();
  server.close(() => {
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
