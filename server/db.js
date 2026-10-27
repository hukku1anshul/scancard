import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '.data');
const DB_FILE = path.join(DATA_DIR, 'records.json');

// In-memory cache for ultra-fast query and indexing
const recordsMap = new Map();
let saveTimeout = null;
let initialized = false;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Initialize DB from disk at startup */
export function initDB() {
  if (initialized) return;
  try {
    ensureDir(DATA_DIR);
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      if (raw.trim()) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item && item.id) recordsMap.set(item.id, item);
          }
        }
      }
    }
    initialized = true;
    console.log(`[db] Loaded ${recordsMap.size} record(s) from ${DB_FILE}`);
  } catch (err) {
    console.error('[db] Error loading database file:', err.message);
    initialized = true;
  }
}

/** Schedule an atomic write to disk */
function schedulePersist() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(flushToDisk, 500);
}

/** Write all records atomically to disk */
export function flushToDisk() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  try {
    ensureDir(DATA_DIR);
    const tmpFile = DB_FILE + '.tmp';
    const data = JSON.stringify(Array.from(recordsMap.values()), null, 2);
    fs.writeFileSync(tmpFile, data, 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('[db] Failed to persist database:', err.message);
  }
}

/** Retrieve all records with optional filtering & sorting */
export function getAllRecords(options = {}) {
  initDB();
  let list = Array.from(recordsMap.values());

  const { search, event, role, priority, scanMode, limit, offset } = options;

  if (event) {
    const evLower = String(event).toLowerCase().trim();
    list = list.filter((r) => (r.event || '').toLowerCase().trim() === evLower);
  }

  if (role) {
    const roleLower = String(role).toLowerCase().trim();
    list = list.filter((r) => (r.contactRole || '').toLowerCase().trim() === roleLower);
  }

  if (priority) {
    const prioLower = String(priority).toLowerCase().trim();
    list = list.filter((r) => (r.priority || '').toLowerCase().trim() === prioLower);
  }

  if (scanMode) {
    const modeLower = String(scanMode).toLowerCase().trim();
    list = list.filter((r) => (r.scanMode || 'card').toLowerCase().trim() === modeLower);
  }

  if (search) {
    const q = String(search).toLowerCase().trim();
    list = list.filter((r) => {
      const name = (r.card?.fullName || '').toLowerCase();
      const company = (r.card?.company || r.dossier?.company?.name || '').toLowerCase();
      const email = (r.card?.emails || []).join(' ').toLowerCase();
      const phone = (r.card?.phones || []).map((p) => p.number).join(' ').toLowerCase();
      const gstin = (r.card?.gstin || r.dossier?.company?.gstin || '').toLowerCase();
      const cin = (r.card?.cin || r.dossier?.company?.cin || '').toLowerCase();
      const tags = (r.tags || []).join(' ').toLowerCase();
      const notes = (r.meetingNotes || []).map((n) => n.text).join(' ').toLowerCase();
      return (
        name.includes(q) ||
        company.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        gstin.includes(q) ||
        cin.includes(q) ||
        tags.includes(q) ||
        notes.includes(q)
      );
    });
  }

  // Default sort: newest first
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const total = list.length;
  const start = Number(offset) || 0;
  const count = Number(limit) || list.length;
  const paginated = list.slice(start, start + count);

  return { total, records: paginated };
}

/** Get a single record by ID */
export function getRecordById(id) {
  initDB();
  return recordsMap.get(id) || null;
}

/** Upsert a record (insert or update) */
export function upsertRecord(record) {
  if (!record || !record.id) throw new Error('Missing record or record.id');
  initDB();
  const existing = recordsMap.get(record.id);
  const updated = {
    ...existing,
    ...record,
    updatedAt: record.updatedAt || Date.now(),
    createdAt: existing?.createdAt || record.createdAt || Date.now(),
  };
  recordsMap.set(record.id, updated);
  schedulePersist();
  return updated;
}

/** Update specific fields of a record */
export function patchRecord(id, patch) {
  initDB();
  const existing = recordsMap.get(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...patch,
    id, // ensure ID is immutable
    updatedAt: Date.now(),
  };
  recordsMap.set(id, updated);
  schedulePersist();
  return updated;
}

/** Delete a record by ID */
export function deleteRecord(id) {
  initDB();
  const existed = recordsMap.delete(id);
  if (existed) schedulePersist();
  return existed;
}

/** Batch sync multiple records from client (merges offline scans) */
export function syncRecords(clientRecords = []) {
  initDB();
  let createdCount = 0;
  let updatedCount = 0;

  for (const clientRec of clientRecords) {
    if (!clientRec || !clientRec.id) continue;
    const existing = recordsMap.get(clientRec.id);
    if (!existing) {
      recordsMap.set(clientRec.id, { ...clientRec, updatedAt: Date.now() });
      createdCount++;
    } else {
      // Keep newer version or merge notes & action items
      const clientTime = clientRec.updatedAt || clientRec.createdAt || 0;
      const serverTime = existing.updatedAt || existing.createdAt || 0;
      if (clientTime >= serverTime) {
        recordsMap.set(clientRec.id, {
          ...existing,
          ...clientRec,
          updatedAt: Date.now(),
        });
        updatedCount++;
      }
    }
  }

  if (createdCount > 0 || updatedCount > 0) {
    schedulePersist();
  }

  return {
    total: recordsMap.size,
    created: createdCount,
    updated: updatedCount,
    records: Array.from(recordsMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
  };
}

/** Compute real-time analytics & Event ROI */
export function getAnalytics() {
  initDB();
  const all = Array.from(recordsMap.values());

  const eventStats = {};
  const roleCounts = {};
  const priorityCounts = { hot: 0, warm: 0, cold: 0, partner: 0 };
  const kycCounts = { verified: 0, standard: 0, review: 0 };
  let totalActionItems = 0;

  for (const r of all) {
    // Event aggregation
    const ev = r.event?.trim() || 'No Event Tagged';
    if (!eventStats[ev]) {
      eventStats[ev] = { count: 0, hotLeads: 0, dealValues: [], actionItemsCount: 0 };
    }
    eventStats[ev].count++;
    if (r.priority === 'hot') eventStats[ev].hotLeads++;
    if (r.dealValue) eventStats[ev].dealValues.push(r.dealValue);
    if (r.actionItems?.length) {
      eventStats[ev].actionItemsCount += r.actionItems.length;
      totalActionItems += r.actionItems.length;
    }

    // Role breakdown
    const role = r.contactRole || 'unassigned';
    roleCounts[role] = (roleCounts[role] || 0) + 1;

    // Priority breakdown
    if (r.priority && priorityCounts[r.priority] !== undefined) {
      priorityCounts[r.priority]++;
    }

    // KYC breakdown
    const kycTier = r.dossier?.kyc?.tier;
    if (kycTier && kycCounts[kycTier] !== undefined) {
      kycCounts[kycTier]++;
    }
  }

  return {
    totalScans: all.length,
    totalActionItems,
    priorityBreakdown: priorityCounts,
    roleBreakdown: roleCounts,
    kycBreakdown: kycCounts,
    events: Object.entries(eventStats).map(([name, stat]) => ({
      name,
      ...stat,
    })),
  };
}
