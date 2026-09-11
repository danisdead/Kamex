'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3847;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_PATH = path.join(__dirname, 'data', 'items.json');

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
  res.json({ ok: true, service: 'amazon-mx-deals', items: count, ts: new Date().toISOString() });
});

app.get('/api/items', (req, res) => {
  try {
    let items = loadItems();
    const { category, subcategory, q, sort } = req.query;
    const freeShipping = parseBool(req.query.free_shipping);
    const isPriceError = parseBool(req.query.is_price_error);
    const maxTotal =
      req.query.max_total_mxn !== undefined && req.query.max_total_mxn !== ''
        ? Number(req.query.max_total_mxn)
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
    const items = loadItems();
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
