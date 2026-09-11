'use strict';

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
    for (const part of String(pub).split(/\s*(?:\/|&|,|;|\+| feat\.?| ft\.?| vs\.?| with )\s*/i)) {
      if (part && part.trim()) out.push(part.trim());
    }
  }
  const title = item.title || '';
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

function enrichWithLastfm(items, taste) {
  const index = buildTasteIndex(taste);
  return items.map((item) => {
    const { lastfm_score, lastfm_match } = computeLastfmScore(item, index);
    return { ...item, lastfm_score, lastfm_match };
  });
}

module.exports = {
  norm,
  buildTasteIndex,
  candidateArtists,
  bestArtistMatch,
  computeLastfmScore,
  enrichWithLastfm,
};
