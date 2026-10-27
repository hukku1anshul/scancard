# CardIntel — Business Card Intelligence PWA

Scan any business card with your phone and get a **360° company & contact dossier**: firmographics, registry/D&B footprint, products & services, target customers, LinkedIn & social presence, news, and personalised talking points.

## Features

- **Capture anything**: phone camera (`Take photo`), live in-browser camera with a card guide, or gallery upload. Supports front and back sides, any layout or orientation, and multilingual cards.
- **Vision AI extraction**: Gemini reads the name, title, company (including logo-only names), emails, phones, website, address and socials.
- **Autonomous enrichment** (streamed live progress):
  1. **Website crawl**: homepage plus About / Products / Solutions / Customers pages, JSON-LD, and social links.
  2. **Registry & D&B**: public directory results (dnb.com, OpenCorporates, Crunchbase) and firmographics.
  3. **LinkedIn & social**: company page and person-profile search results.
  4. **Market**: customers, case studies, products and news.
  5. **AI synthesis**: a structured dossier with cited sources and caveats. It is instructed not to invent D-U-N-S numbers or revenue.
- **Actions**: save the contact (vCard, works with the iOS/Android share sheet), call, email, open the website, copy a Markdown brief, export JSON, export all contacts to CSV.
- **Edit & re-enrich**: fix OCR mistakes and run the enrichment again.
- **PWA**: installable to the home screen, works offline, history is stored on the device.
- **Demo mode**: runs without any API key using a fictional sample dossier.

## Quick start

```bash
cd cardintel-pwa
npm install
cp .env.example .env      # optional: add GEMINI_API_KEY (or enter it in the app's Settings)
npm run dev               # API on :8787, web on :5173
```

Open http://localhost:5173. On Windows PowerShell, use `npm.cmd` if script execution is disabled.

### Production

```bash
npm run build
npm start                 # serves the PWA + API on http://localhost:8787
```

### Using on your phone

- `npm run dev` binds to your LAN (`--host`), so open `http://<your-PC-IP>:5173` on the phone.
- **Take photo** (the native camera) works over plain HTTP. **Live camera** and **install as app** require HTTPS. Deploy behind HTTPS (Render, Fly.io, Cloud Run, Railway) or use a tunnel such as `cloudflared tunnel --url http://localhost:8787`.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | For live scans | Vision extraction + dossier synthesis ([get key](https://aistudio.google.com/apikey)) |
| `GEMINI_MODEL` | No | Default `gemini-2.5-flash`; use `gemini-2.5-pro` for deeper analysis |
| `TAVILY_API_KEY` | Recommended | Higher-quality web search |
| `SERPAPI_KEY` | Optional | Google results via SerpApi |

All keys can also be entered in **Settings** in the app. They're stored on the device and sent per request to your own server. Without a search key, the server uses free DuckDuckGo/Bing HTML search, which works but can be rate-limited.

## Architecture

```
src/                      React + Tailwind mobile UI
  components/ScanView     capture (camera / upload / samples)
  components/ProgressView live NDJSON progress
  components/DossierView  tabs: Overview, Contact, Offerings, Customers, Social & News, Pitch, Sources
  lib/                    api streaming, image compression, vCard/CSV/Markdown export, storage
server/
  index.js                Express: /api/health, /api/scan (NDJSON stream), static PWA
  pipeline.js             orchestration: extract → crawl ∥ search groups → synthesize
  extract.js              Gemini Vision card parser + normalisation
  crawl.js                website crawler (cheerio)
  search.js               Tavily → SerpApi → DuckDuckGo → Bing
  synthesize.js           Gemini dossier synthesis + post-processing
  demo.js                 keyless demo mode
```

## Extending: official D&B / data providers

`server/pipeline.js` runs each enrichment source as a "group". To add **D&B Direct+** (D-U-N-S match, family tree, financials), Apollo, Clearbit or a LinkedIn data API, fetch the data in a new group and add it to `evidence`. The synthesis step will use it automatically.

## Compliance note

CardIntel only uses publicly available web data and doesn't log in to or scrape LinkedIn directly. LinkedIn information comes from public search-engine snippets. When storing personal data, follow GDPR/CCPA and the relevant platform terms.
