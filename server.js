'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const { enrichWithLastfm } = require('./lib/lastfm');
const { filterItems, sortItems } = require('./lib/filters');
const { attachCovers, loadCovers, fillMissingCovers } = require('./lib/covers');
const { applyBoxSecrets, secretStatus } = require('./lib/secrets');
const {
  DEFAULT_CATALOG_FEED_URL,
  CATALOG_POLL_MS,
  extractItems,
  feedUpdatedAt,
  isUnchangedUpdatedAt,
  redactUrls,
} = require('./lib/catalogFeed');

applyBoxSecrets(['DISCOGS_CONSUMER_KEY', 'DISCOGS_CONSUMER_SECRET']);
for (const secretName of ['DISCOGS_CONSUMER_KEY', 'DISCOGS_CONSUMER_SECRET']) {
  const s = secretStatus(secretName);
  console.log(`${secretName} ${s.status} len=${s.length}`);
}

const PORT = Number(process.env.PORT) || 3847;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_PATH = path.join(__dirname, 'data', 'items.json');
const TASTE_PATH = path.join(__dirname, 'data', 'taste-lastfm.json');
const DIST_PATH = path.join(__dirname, 'dist');
const CATALOG_FEED_URL = process.env.CATALOG_FEED_URL || DEFAULT_CATALOG_FEED_URL;
const CATALOG_STAMP_PATH = path.join(__dirname, 'data', 'catalog-feed-stamp.json');

const app = express();
app.use(express.json({ limit: '2mb' }));

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

function upsertNormalized(normalized) {
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
  return { created, updated, total: next.length };
}

function loadCatalogStamp() {
  try {
    if (!fs.existsSync(CATALOG_STAMP_PATH)) return null;
    const data = JSON.parse(fs.readFileSync(CATALOG_STAMP_PATH, 'utf8'));
    if (!data || data.updated_at == null) return null;
    const stamp = String(data.updated_at).trim();
    return stamp || null;
  } catch {
    return null;
  }
}

function saveCatalogStamp(updatedAt) {
  if (updatedAt == null || String(updatedAt).trim() === '') return;
  try {
    const payload = JSON.stringify({ updated_at: String(updatedAt).trim() }) + '\n';
    fs.writeFileSync(CATALOG_STAMP_PATH, payload, 'utf8');
  } catch (err) {
    console.error(`catalog stamp write failed: ${redactUrls(err && err.message ? err.message : 'error')}`);
  }
}

let lastCatalogUpdatedAt = loadCatalogStamp();

async function syncCatalogFeed() {
  let response;
  try {
    response = await fetch(CATALOG_FEED_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    console.error(`catalog feed fetch failed: ${redactUrls(err && err.message ? err.message : 'error')}`);
    return;
  }

  if (!response.ok) {
    console.error(`catalog feed HTTP ${response.status}`);
    return;
  }

  let feed;
  try {
    feed = await response.json();
  } catch (err) {
    console.error(`catalog feed parse failed: ${redactUrls(err && err.message ? err.message : 'error')}`);
    return;
  }

  if (!feed || typeof feed !== 'object' || Array.isArray(feed) || !Array.isArray(feed.items)) {
    console.error('catalog feed missing items array; skip upsert');
    return;
  }

  const updatedAt = feedUpdatedAt(feed);
  if (isUnchangedUpdatedAt(lastCatalogUpdatedAt, updatedAt)) {
    console.log(`catalog feed unchanged updated_at=${updatedAt}; skip upsert`);
    return;
  }

  const normalized = [];
  let skipped = 0;
  for (const raw of extractItems(feed)) {
    const item = normalizeItem(raw);
    if (!item) {
      skipped += 1;
      continue;
    }
    normalized.push(item);
  }

  if (!normalized.length) {
    console.error(`catalog feed had no valid items (skipped=${skipped}); not updating stamp`);
    return;
  }

  try {
    const result = upsertNormalized(normalized);
    lastCatalogUpdatedAt = updatedAt;
    if (updatedAt) saveCatalogStamp(updatedAt);
    console.log(
      `catalog feed upserted created=${result.created} updated=${result.updated} total=${result.total} skipped=${skipped} updated_at=${updatedAt || 'none'}`
    );
  } catch (err) {
    console.error(`catalog feed upsert failed: ${redactUrls(err && err.message ? err.message : 'error')}`);
  }
}

function startCatalogFeedLoop() {
  const run = () => {
    syncCatalogFeed().catch((err) => {
      console.error(`catalog feed sync failed: ${redactUrls(err && err.message ? err.message : 'error')}`);
    });
  };
  run();
  const timer = setInterval(run, CATALOG_POLL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  console.log('catalog feed poll every 30m');
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
    let items = enrichWithLastfm(loadItems(), loadTaste());
    items = attachCovers(items, loadCovers());
    items = filterItems(items, {
      category: req.query.category,
      subcategory: req.query.subcategory,
      free_shipping: req.query.free_shipping,
      is_price_error: req.query.is_price_error,
      max_total_mxn: req.query.max_total_mxn,
      min_lastfm_score: req.query.min_lastfm_score,
      q: req.query.q,
    });
    items = sortItems(items, req.query.sort || 'price');
    res.json({ count: items.length, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/items/:id', (req, res) => {
  try {
    const items = attachCovers(enrichWithLastfm(loadItems(), loadTaste()), loadCovers());
    const item = items.find((i) => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/covers/:id', (req, res) => {
  try {
    const cache = loadCovers();
    const id = req.params.id;
    if (!Object.prototype.hasOwnProperty.call(cache, id)) {
      return res.status(404).json({ error: 'not cached', id, cover_url: null });
    }
    const entry = cache[id] || {};
    res.json({
      id,
      cover_url: entry.cover_url || null,
      discogs_id: entry.discogs_id ?? null,
      queried_at: entry.queried_at || null,
    });
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

    const result = upsertNormalized(normalized);
    res.json({ ok: true, created: result.created, updated: result.updated, total: result.total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve built React app (Vite output in dist/)
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.status(503).send('Frontend not built. Run: npm run build');
  });
}

app.listen(PORT, HOST, () => {
  console.log(`amazon-mx-deals listening on http://${HOST}:${PORT}`);
  console.log(`local URL: http://127.0.0.1:${PORT}`);
  startCatalogFeedLoop();
  if (process.env.DISCOGS_FILL === '0') return;
  fillMissingCovers()
    .then((result) => {
      console.log(`covers summary ${JSON.stringify(result)}`);
    })
    .catch((err) => {
      console.error(`covers fill failed: ${err && err.message ? err.message : 'error'}`);
    });
});
