const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const RETRYABLE = [429, 500, 502, 503, 504];

// Latest Gemini models ordered by preference; automatically falls back if a model ID is deprecated or unavailable
export const LATEST_GEMINI_MODELS = [
  'gemini-3-flash-preview',
  'gemini-flash-latest',
  'gemini-3.1-pro-preview',
  'gemini-2.5-flash',
];

function buildModelCandidates(requestedModel) {
  const list = [];
  if (requestedModel && typeof requestedModel === 'string') {
    list.push(requestedModel.trim());
  }
  for (const m of LATEST_GEMINI_MODELS) {
    if (!list.includes(m)) list.push(m);
  }
  return list;
}

async function callGemini({ apiKey, model, body }) {
  const candidates = buildModelCandidates(model);
  let lastErr;

  for (const candidateModel of candidates) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(`${BASE}/${encodeURIComponent(candidateModel)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) return data;

      const msg = data?.error?.message || r.statusText || '';
      lastErr = new Error(`Gemini API ${r.status} (${candidateModel}): ${msg}`);

      // If model is not found / deprecated / unsupported (404 or 400 model error), immediately try next model in fallback chain
      if (r.status === 404 || (r.status === 400 && /model|not found|not supported|deprecated/i.test(msg))) {
        console.warn(`[gemini] Model "${candidateModel}" unavailable (${r.status}: ${msg}), trying next latest model…`);
        break;
      }

      if (!RETRYABLE.includes(r.status)) break;
      await new Promise((res) => setTimeout(res, 1200 * (attempt + 1)));
    }
  }
  throw lastErr;
}

const textOf = (data) => (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');

/**
 * Calls Gemini generateContent and returns parsed JSON output.
 * @param {{ apiKey: string, model: string, parts: any[], system?: string, temperature?: number }} opts
 */
export async function geminiJSON({ apiKey, model, parts, system, temperature = 0.2 }) {
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', temperature },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const data = await callGemini({ apiKey, model, body });
  const text = textOf(data);
  if (!text) throw new Error('Gemini returned an empty response' + (data?.promptFeedback?.blockReason ? ` (${data.promptFeedback.blockReason})` : ''));
  return parseJSON(text);
}

/**
 * Gemini with Google Search grounding. Returns research text plus the web
 * sources and search queries Gemini used.
 * @returns {Promise<{ text: string, sources: {title:string,url:string}[], queries: string[] }>}
 */
export async function geminiGrounded({ apiKey, model, prompt, temperature = 0.2 }) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature },
  };
  const data = await callGemini({ apiKey, model, body });
  const meta = data?.candidates?.[0]?.groundingMetadata || {};
  const sources = [];
  const seen = new Set();
  for (const c of meta.groundingChunks || []) {
    const url = c?.web?.uri;
    if (url && !seen.has(url)) {
      seen.add(url);
      sources.push({ title: c.web.title || url, url });
    }
  }
  return { text: textOf(data), sources, queries: meta.webSearchQueries || [] };
}

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Model returned invalid JSON');
  }
}
