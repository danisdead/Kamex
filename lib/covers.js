'use strict';

const fs = require('fs');
const path = require('path');

const COVERS_PATH = path.join(__dirname, '..', 'data', 'covers.json');
const ITEMS_PATH = path.join(__dirname, '..', 'data', 'items.json');
const USER_AGENT = 'Kamex/1.0 + danisdead@users.noreply.github.com';
const SEARCH_ENDPOINT = 'https://api.discogs.com/database/search';
const DEFAULT_SLEEP_MS = 1200;

function wantsCover(item) {
  if (!item || typeof item !== 'object') return false;
  const cat = String(item.category || '').trim().toLowerCase();
  return cat === 'vinyl' || cat === 'cd';
}

function stripMarketplaceNoise(value) {
  let t = value == null ? '' : String(value);
  t = t.replace(/\[[^\]]*\]/g, ' ');
  t = t.replace(/(^|\s)\([^)]*\)/g, ' ');
  t = t.replace(/_\d+\b/g, ' ');
  t = t.replace(/['’"][^'’"]*['’"]/g, ' ');
  t = t.replace(/\bbonus\s+tracks?\b/gi, ' ');
  t = t.replace(/\b(vinyl|vinilo|importado|imported|grabaciones|lp|xl|periwinkle|colou?r|limited|edition|records?|deluxe|digipak)\b/gi, ' ');
  t = t.replace(/\s*,\s*/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/^[\-–—:,\s]+|[\-–—:,\s]+$/g, '').trim();
  return t;
}

function withoutLeadingThe(artist) {
  return String(artist || '').replace(/^the\s+/i, '').trim();
}

function dedupeLeadingArtist(title, artist) {
  let t = String(title || '').trim();
  const a = String(artist || '').trim();
  if (!t || !a) return t;
  const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^' + escaped + '\\s*[\-–—:]?\\s*', 'i');
  if (re.test(t)) t = t.replace(re, '').trim();
  return t;
}

function joinQuery(artist, title) {
  return [artist, title].map((part) => (part == null ? '' : String(part).trim())).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function buildSearchQuery(item) {
  const queries = buildSearchQueries(item);
  return queries[0] || '';
}

/** Primary query is artist + title. Later entries drop marketplace noise leftovers. */
function buildSearchQueries(item) {
  if (!item || typeof item !== 'object') return [];
  const artist = stripMarketplaceNoise(item.artist_or_publisher);
  const title = dedupeLeadingArtist(stripMarketplaceNoise(item.title), artist);
  const bareArtist = withoutLeadingThe(artist);
  const head = title.split(/\s*\/\s*/)[0].trim();
  const queries = [];
  const add = (q) => {
    const s = String(q || '').replace(/\s+/g, ' ').trim();
    if (!s) return;
    if (queries.some((existing) => existing.toLowerCase() === s.toLowerCase())) return;
    queries.push(s);
  };
  add(joinQuery(artist, title));
  if (bareArtist && bareArtist.toLowerCase() !== artist.toLowerCase()) add(joinQuery(bareArtist, title));
  if (head && head.toLowerCase() !== title.toLowerCase()) {
    add(joinQuery(artist, head));
    if (bareArtist && bareArtist.toLowerCase() !== artist.toLowerCase()) add(joinQuery(bareArtist, head));
  }
  return queries;
}

function isUsableImageUrl(url) {
  if (typeof url !== 'string') return false;
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) return false;
  if (/spacer\.gif/i.test(u)) return false;
  return true;
}

function resultList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
}

/** Best result is the first Discogs hit (relevance order). Prefer thumb, else cover_image. */
function pickThumb(payload) {
  const list = resultList(payload);
  const best = list[0];
  if (!best || typeof best !== 'object') {
    return { cover_url: null, discogs_id: null };
  }
  const discogs_id = best.id == null ? null : best.id;
  let cover_url = null;
  if (isUsableImageUrl(best.thumb)) cover_url = best.thumb.trim();
  else if (isUsableImageUrl(best.cover_image)) cover_url = best.cover_image.trim();
  return { cover_url, discogs_id };
}

function buildSearchUrl(query) {
  const u = new URL(SEARCH_ENDPOINT);
  u.searchParams.set('q', query == null ? '' : String(query));
  u.searchParams.set('type', 'release');
  u.searchParams.set('per_page', '5');
  return u.toString();
}

function buildAuthHeader(key, secret) {
  return `Discogs key=${key}, secret=${secret}`;
}

function attachCovers(items, cache) {
  const c = cache && typeof cache === 'object' ? cache : {};
  return (items || []).map((item) => {
    if (!wantsCover(item)) {
      if (item && Object.prototype.hasOwnProperty.call(item, 'cover_url')) {
        const copy = { ...item };
        delete copy.cover_url;
        return copy;
      }
      return item;
    }
    const id = item && item.id != null ? String(item.id) : '';
    const entry = id ? c[id] : null;
    const cover_url = entry && isUsableImageUrl(entry.cover_url) ? entry.cover_url.trim() : null;
    return { ...item, cover_url };
  });
}

function loadCovers(file = COVERS_PATH) {
  try {
    if (!fs.existsSync(file)) return {};
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return data;
  } catch {
    return {};
  }
}

function saveCovers(cache, file = COVERS_PATH) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeCovers(items, cache) {
  const c = cache && typeof cache === 'object' ? cache : {};
  let vinylCd = 0;
  let covered = 0;
  let missed = 0;
  let uncached = 0;
  for (const item of items || []) {
    if (!wantsCover(item)) continue;
    vinylCd += 1;
    const entry = c[String(item.id)];
    if (!entry) {
      uncached += 1;
      continue;
    }
    if (isUsableImageUrl(entry.cover_url)) covered += 1;
    else missed += 1;
  }
  return { vinylCd, covered, missed, uncached };
}

function acquireLock(lockPath) {
  try {
    if (fs.existsSync(lockPath)) {
      const age = Date.now() - fs.statSync(lockPath).mtimeMs;
      if (age > 30 * 60 * 1000) fs.rmSync(lockPath, { recursive: true, force: true });
    }
    fs.mkdirSync(lockPath);
    return true;
  } catch {
    return false;
  }
}

function releaseLock(lockPath) {
  try {
    fs.rmSync(lockPath, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

async function searchDiscogs(query, { key, secret, fetchImpl } = {}) {
  const f = fetchImpl || global.fetch;
  return f(buildSearchUrl(query), {
    headers: {
      Authorization: buildAuthHeader(key, secret),
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });
}

async function searchWithRetry(query, key, secret, fetchImpl) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await searchDiscogs(query, { key, secret, fetchImpl });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 20000;
        await res.text().catch(() => '');
        await sleep(Math.min(wait, 60000));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      await sleep(2000 * (attempt + 1));
    }
  }
  if (lastError) throw lastError;
  const err = new Error('Discogs rate limit');
  err.status = 429;
  throw err;
}

let fillChain = Promise.resolve();

function fillMissingCovers(opts) {
  const run = fillChain.then(() => doFill(opts || {}));
  fillChain = run.then(
    () => {},
    () => {}
  );
  return run;
}

async function doFill(opts) {
  const { applyBoxSecrets } = require('./secrets');
  applyBoxSecrets(['DISCOGS_CONSUMER_KEY', 'DISCOGS_CONSUMER_SECRET']);
  const key = opts.key || process.env.DISCOGS_CONSUMER_KEY || '';
  const secret = opts.secret || process.env.DISCOGS_CONSUMER_SECRET || '';
  const sleepMs = opts.sleepMs == null ? DEFAULT_SLEEP_MS : opts.sleepMs;
  const file = opts.cachePath || COVERS_PATH;
  const itemsPath = opts.itemsPath || ITEMS_PATH;
  const fetchImpl = opts.fetchImpl;

  if (!key || !secret) {
    const err = new Error('Discogs credentials missing');
    err.code = 'MISSING_SECRETS';
    throw err;
  }

  const items = opts.items || JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
  const lockPath = `${file}.lock`;
  const useLock = !opts.skipLock;
  if (useLock && !acquireLock(lockPath)) {
    return { skippedRun: true, reason: 'lock', ...summarizeCovers(items, loadCovers(file)) };
  }

  const cache = loadCovers(file);
  let queried = 0;
  let hits = 0;
  let misses = 0;
  let skipped = 0;

  try {
    const targets = items.filter((item) => wantsCover(item) && item && item.id != null);
    for (const item of targets) {
      const id = String(item.id);
      if (Object.prototype.hasOwnProperty.call(cache, id)) {
        skipped += 1;
        continue;
      }
      const queries = buildSearchQueries(item);
      const queriedAt = new Date().toISOString();
      if (!queries.length) {
        cache[id] = { cover_url: null, discogs_id: null, queried_at: queriedAt };
        saveCovers(cache, file);
        misses += 1;
        continue;
      }
      let picked = null;
      let sawOk = false;
      let failed = false;
      for (let qi = 0; qi < queries.length; qi += 1) {
        if (queried > 0 && sleepMs > 0) await sleep(sleepMs);
        const res = await searchWithRetry(queries[qi], key, secret, fetchImpl);
        queried += 1;
        const remaining = res.headers && typeof res.headers.get === 'function'
          ? res.headers.get('x-discogs-ratelimit-remaining')
          : null;
        if (!res.ok) {
          console.log(`discogs status=${res.status} id=${id} remaining=${remaining == null ? 'n/a' : remaining} (not cached)`);
          if (res.status === 401 || res.status === 403) {
            const err = new Error(`Discogs auth failed status ${res.status}`);
            err.status = res.status;
            throw err;
          }
          failed = true;
          break;
        }
        let body;
        try {
          body = await res.json();
        } catch {
          console.log(`discogs bad json id=${id} (not cached)`);
          failed = true;
          break;
        }
        sawOk = true;
        const list = resultList(body);
        if (list.length || qi === queries.length - 1) {
          picked = pickThumb(body);
          const remNum = Number(remaining);
          cache[id] = {
            cover_url: picked.cover_url,
            discogs_id: picked.discogs_id,
            queried_at: queriedAt,
          };
          saveCovers(cache, file);
          if (picked.cover_url) hits += 1;
          else misses += 1;
          console.log(`discogs id=${id} ${picked.cover_url ? 'hit' : 'miss'} remaining=${remaining == null ? 'n/a' : remaining}`);
          if (Number.isFinite(remNum) && remNum <= 2) await sleep(15000);
          break;
        }
      }
      if (!picked && failed && !sawOk) continue;
    }
  } finally {
    if (useLock) releaseLock(lockPath);
  }

  return {
    queried,
    hits,
    misses,
    skipped,
    ...summarizeCovers(items, cache),
  };
}

module.exports = {
  USER_AGENT,
  wantsCover,
  buildSearchQuery,
  buildSearchQueries,
  buildSearchUrl,
  buildAuthHeader,
  isUsableImageUrl,
  pickThumb,
  attachCovers,
  loadCovers,
  saveCovers,
  summarizeCovers,
  fillMissingCovers,
  COVERS_PATH,
};
