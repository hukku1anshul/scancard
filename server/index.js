import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runScan } from './pipeline.js';
import { resolveConfig, capabilities } from './config.js';
import { pushHubSpot, pushSalesforce } from './crm.js';

const app = express();
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (req, res) => {
  res.json(capabilities(resolveConfig(req)));
});

/**
 * POST /api/scan
 * Body: { images?: [{ data: base64, mimeType }], card?: Card, refresh?: boolean }
 * Response: NDJSON stream of progress events (step / card / result / error).
 */
app.post('/api/scan', async (req, res) => {
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let closed = false;
  res.on('close', () => { closed = true; });
  const emit = (evt) => { if (!closed) res.write(JSON.stringify(evt) + '\n'); };

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
      return res.json(await pushHubSpot(record, cfg.hubspotToken));
    }
    if (req.params.provider === 'salesforce') {
      if (!cfg.sfInstanceUrl || !cfg.sfAccessToken) throw new Error('Salesforce instance URL / access token not configured');
      return res.json(await pushSalesforce(record, cfg.sfInstanceUrl, cfg.sfAccessToken));
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
app.listen(port, () => {
  const cfg = resolveConfig();
  console.log(`CardIntel API listening on http://localhost:${port}`);
  if (cfg.geminiKey) {
    console.log(`  Live Gemini AI enabled (model: ${cfg.geminiModel}, grounding: ${cfg.grounding ? 'on' : 'off'})`);
  } else {
    console.log('  (no GEMINI_API_KEY in server environment — running in demo mode)');
  }
});
