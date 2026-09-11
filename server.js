'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3847;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_PATH = path.join(__dirname, 'data', 'items.json');
const TASTE_PATH = path.join(__dirname, 'data', 'taste-lastfm.json');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function loadItems() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('items.json must be an array');
  return data;
}

function saveItems(items) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(items, null, 2) + '\n', 'utf8');
}

function loadTaste() {
  if (!fs.existsSync(TASTE_PATH)) return null;
  return JSON.parse(fs.readFileSync(TASTE_PATH, 'utf8'));
}

function norm(s) {
  if (!s) return '';
  return String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTasteIndex(taste) {
  if (!taste) {
    return {
      overall: new Map(),
      overallList: [],
      month: new Map(),
      loved: new Set(),
      recent: new Set(),
    };
  }
  const overallList = Array.isArray(taste.artists) ? taste.artists : [];
  const overall = new Map();
  overallList.forEach((a, idx) => {
    const n = norm(a.name);
    if (!n) return;
    if (!overall.has(n)) {
      overall.set(n, {
        name: a.name,
        playcount: Number(a.playcount) || 0,
        rank: idx + 1,
      });
    }
  });
  const month = new Map();
  (taste.artists_12month || []).forEach((a, idx) => {
    const n = norm(a.name);
    if (!n) return;
    if (!month.has(n)) {
      month.set(n, {
        name: a.name,
        playcount: Number(a.playcount) || 0,
        rank: idx + 1,
      });
    }
  });
  const loved = new Set();
  for (const t of taste.loved || []) {
    const n = norm(t.artist);
    if (n) loved.add(n);
  }
  const recent = new Set();
  for (const t of taste.recent || []) {
    const n = norm(t.artist);
    if (n) recent.add(n);
  }
  return { overall, overallList, month, loved, recent };
}

function candidateArtists(item) {
  const out = [];
  const pub = item.artist_or_publisher;
  if (pub) {
    out.push(String(pub));
    // split common joiners
    for (const part of String(pub).split(/\s*(?:\/|&|,|;|\+| feat\.?| ft\.?| vs\.?| with )\s*/i)) {
      if (part && part.trim()) out.push(part.trim());
    }
  }
  const title = item.title || '';
  // "Artist - Album" or "Artist – Album"
  const m = String(title).match(/^(.+?)\s+[–—-]\s+/);
  if (m) out.push(m[1].trim());
  return [...new Set(out.filter(Boolean))];
}

function bestArtistMatch(candidates, indexMap) {
  let best = null;
  for (const c of candidates) {
    const n = norm(c);
    if (!n) continue;
    if (indexMap.has(n)) {
      const hit = indexMap.get(n);
      if (!best || hit.rank < best.rank) best = { ...hit, match: 'exact', query: c };
      continue;
    }
    // contains / contained soft match (prefer shorter rank-like distance via playcount)
    for (const [key, hit] of indexMap.entries()) {
      if (n.length < 3 || key.length < 3) continue;
      if (key.includes(n) || n.includes(key)) {
        const soft = { ...hit, match: 'soft', query: c };
        if (!best || soft.rank < best.rank) best = soft;
      }
    }
  }
  return best;
}

function computeLastfmScore(item, tasteIndex) {
  const cat = (item.category || '').toLowerCase();
  if (cat === 'game') {
    return { lastfm_score: 0, lastfm_match: null };
  }
  if (cat !== 'vinyl' && cat !== 'cd') {
    return { lastfm_score: 0, lastfm_match: null };
  }

  const candidates = candidateArtists(item);
  const overallHit = bestArtistMatch(candidates, tasteIndex.overall);
  const monthHit = bestArtistMatch(candidates, tasteIndex.month);

  let score = 0;
  let matchedName = null;
  let matchType = null;

  if (overallHit) {
    const n = tasteIndex.overallList.length || 150;
    // rank 1 → ~95, last → ~35 for exact; soft slightly lower
    const rankFactor = 1 - (overallHit.rank - 1) / Math.max(n, 1);
    const base = overallHit.match === 'exact' ? 40 + rankFactor * 55 : 25 + rankFactor * 35;
    score = Math.max(score, base);
    matchedName = overallHit.name;
    matchType = overallHit.match;
  } else if (monthHit) {
    const n = 100;
    const rankFactor = 1 - (monthHit.rank - 1) / Math.max(n, 1);
    const base = monthHit.match === 'exact' ? 30 + rankFactor * 40 : 18 + rankFactor * 25;
    score = Math.max(score, base);
    matchedName = monthHit.name;
    matchType = monthHit.match;
  }

  // loved / recent bonuses via normalized candidate names
  let lovedBonus = false;
  let recentBonus = false;
  for (const c of candidates) {
    const n = norm(c);
    if (!n) continue;
    if (tasteIndex.loved.has(n)) lovedBonus = true;
    if (tasteIndex.recent.has(n)) recentBonus = true;
    for (const L of tasteIndex.loved) {
      if (L.includes(n) || n.includes(L)) lovedBonus = true;
    }
    for (const R of tasteIndex.recent) {
      if (R.includes(n) || n.includes(R)) recentBonus = true;
    }
  }
  if (lovedBonus) score += 12;
  if (recentBonus) score += 8;

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (score <= 0) {
    return { lastfm_score: 0, lastfm_match: null };
  }

  return {
    lastfm_score: score,
    lastfm_match: {
      artist: matchedName,
      type: matchType,
      loved: lovedBonus,
      recent: recentBonus,
    },
  };
}

function enrichWithLastfm(items) {
  const taste = loadTaste();
  const index = buildTasteIndex(taste);
  return items.map((item) => {
    const { lastfm_score, lastfm_match } = computeLastfmScore(item, index);
    return { ...item, lastfm_score, lastfm_match };
  });
}

function normalizeItem(input) {
  if (!input || typeof input !== 'object') return null;
  const id = input.id != null ? String(input.id).trim() : '';
  if (!id) return null;
  return {
    id,
    title: input.title ?? null,
    artist_or_publisher: input.artist_or_publisher ?? null,
    category: input.category ?? null,
    subcategory: input.subcategory ?? null,
    price_mxn: input.price_mxn ?? null,
    list_price_mxn: input.list_price_mxn ?? null,
    shipping_mxn: input.shipping_mxn ?? null,
    total_mxn: input.total_mxn ?? null,
    condition: input.condition ?? null,
    url: input.url ?? null,
    is_price_error: Boolean(input.is_price_error),
    price_error_reason: input.price_error_reason ?? null,
    found_at: input.found_at ?? null,
    source: input.source ?? 'amazon_mx',
    free_shipping: Boolean(input.free_shipping),
  };
}

function parseBool(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return undefined;
}

app.get('/api/health', (_req, res) => {
  let count = 0;
  try {
    count = loadItems().length;
  } catch (_) {
    /* ignore */
  }
  let taste = null;
  try {
    const t = loadTaste();
    if (t) {
      taste = {
        user: t.user,
        updated_at: t.updated_at,
        artists: (t.artists || []).length,
        artists_12month: (t.artists_12month || []).length,
        loved: (t.loved || []).length,
        recent: (t.recent || []).length,
      };
    }
  } catch (_) {
    /* ignore */
  }
  res.json({ ok: true, service: 'amazon-mx-deals', items: count, taste, ts: new Date().toISOString() });
});

app.get('/api/taste', (_req, res) => {
  try {
    const taste = loadTaste();
    if (!taste) return res.status(404).json({ error: 'taste-lastfm.json not found' });
    res.json(taste);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/items', (req, res) => {
  try {
    let items = enrichWithLastfm(loadItems());
    const { category, subcategory, q, sort } = req.query;
    const freeShipping = parseBool(req.query.free_shipping);
    const isPriceError = parseBool(req.query.is_price_error);
    const maxTotal =
      req.query.max_total_mxn !== undefined && req.query.max_total_mxn !== ''
        ? Number(req.query.max_total_mxn)
        : undefined;
    const minLastfm =
      req.query.min_lastfm_score !== undefined && req.query.min_lastfm_score !== ''
        ? Number(req.query.min_lastfm_score)
        : undefined;

    if (category && category !== 'all') {
      items = items.filter((i) => i.category === category);
    }
    if (subcategory) {
      items = items.filter((i) => i.subcategory === subcategory);
    }
    if (freeShipping !== undefined) {
      items = items.filter((i) => Boolean(i.free_shipping) === freeShipping);
    }
    if (isPriceError !== undefined) {
      items = items.filter((i) => Boolean(i.is_price_error) === isPriceError);
    }
    if (maxTotal !== undefined && !Number.isNaN(maxTotal)) {
      items = items.filter((i) => Number(i.total_mxn) <= maxTotal);
    }
    if (minLastfm !== undefined && !Number.isNaN(minLastfm)) {
      items = items.filter((i) => Number(i.lastfm_score || 0) >= minLastfm);
    }
    if (q && String(q).trim()) {
      const needle = String(q).trim().toLowerCase();
      items = items.filter((i) => {
        const title = (i.title || '').toLowerCase();
        const artist = (i.artist_or_publisher || '').toLowerCase();
        return title.includes(needle) || artist.includes(needle);
      });
    }

    const sortKey = sort || 'price';
    items = [...items].sort((a, b) => {
      if (sortKey === 'lastfm_match') {
        const ds = (Number(b.lastfm_score) || 0) - (Number(a.lastfm_score) || 0);
        if (ds !== 0) return ds;
        return (Number(a.price_mxn) || 0) - (Number(b.price_mxn) || 0);
      }
      if (sortKey === 'found_at') {
        return String(b.found_at || '').localeCompare(String(a.found_at || ''));
      }
      if (sortKey === 'total') {
        return (Number(a.total_mxn) || 0) - (Number(b.total_mxn) || 0);
      }
      // price (default) — by price_mxn
      return (Number(a.price_mxn) || 0) - (Number(b.price_mxn) || 0);
    });

    res.json({ count: items.length, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/items/:id', (req, res) => {
  try {
    const items = enrichWithLastfm(loadItems());
    const item = items.find((i) => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/items', (req, res) => {
  try {
    const body = req.body;
    const incoming = Array.isArray(body) ? body : body && body.items ? body.items : [body];
    const normalized = [];
    for (const raw of incoming) {
      const item = normalizeItem(raw);
      if (!item) {
        return res.status(400).json({ error: 'each item needs a non-empty id' });
      }
      normalized.push(item);
    }

    const items = loadItems();
    const byId = new Map(items.map((i) => [i.id, i]));
    let created = 0;
    let updated = 0;
    for (const item of normalized) {
      if (byId.has(item.id)) {
        byId.set(item.id, { ...byId.get(item.id), ...item });
        updated += 1;
      } else {
        byId.set(item.id, item);
        created += 1;
      }
    }
    const next = Array.from(byId.values());
    saveItems(next);
    res.json({ ok: true, created, updated, total: next.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`amazon-mx-deals listening on http://${HOST}:${PORT}`);
  console.log(`local URL: http://127.0.0.1:${PORT}`);
});
