'use strict';

function parseBool(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return undefined;
}

/**
 * Filter items by API query-style options.
 * @param {Array} items
 * @param {object} opts
 */
function filterItems(items, opts = {}) {
  let out = Array.isArray(items) ? [...items] : [];
  const {
    category,
    subcategory,
    free_shipping: freeShippingRaw,
    is_price_error: isPriceErrorRaw,
    max_total_mxn: maxTotalRaw,
    min_lastfm_score: minLastfmRaw,
    q,
  } = opts;

  const freeShipping = parseBool(freeShippingRaw);
  const isPriceError = parseBool(isPriceErrorRaw);
  const maxTotal =
    maxTotalRaw !== undefined && maxTotalRaw !== '' && maxTotalRaw != null
      ? Number(maxTotalRaw)
      : undefined;
  const minLastfm =
    minLastfmRaw !== undefined && minLastfmRaw !== '' && minLastfmRaw != null
      ? Number(minLastfmRaw)
      : undefined;

  if (category && category !== 'all') {
    out = out.filter((i) => i.category === category);
  }
  if (subcategory) {
    out = out.filter((i) => i.subcategory === subcategory);
  }
  if (freeShipping !== undefined) {
    out = out.filter((i) => Boolean(i.free_shipping) === freeShipping);
  }
  if (isPriceError !== undefined) {
    out = out.filter((i) => Boolean(i.is_price_error) === isPriceError);
  }
  if (maxTotal !== undefined && !Number.isNaN(maxTotal)) {
    out = out.filter((i) => Number(i.total_mxn) <= maxTotal);
  }
  if (minLastfm !== undefined && !Number.isNaN(minLastfm)) {
    out = out.filter((i) => Number(i.lastfm_score || 0) >= minLastfm);
  }
  if (q && String(q).trim()) {
    const needle = String(q).trim().toLowerCase();
    out = out.filter((i) => {
      const title = (i.title || '').toLowerCase();
      const artist = (i.artist_or_publisher || '').toLowerCase();
      return title.includes(needle) || artist.includes(needle);
    });
  }
  return out;
}

/**
 * Sort items by sort key: price | total | found_at | lastfm_match
 */
function sortItems(items, sortKey = 'price') {
  const key = sortKey || 'price';
  return [...items].sort((a, b) => {
    if (key === 'lastfm_match') {
      const ds = (Number(b.lastfm_score) || 0) - (Number(a.lastfm_score) || 0);
      if (ds !== 0) return ds;
      return (Number(a.price_mxn) || 0) - (Number(b.price_mxn) || 0);
    }
    if (key === 'found_at') {
      return String(b.found_at || '').localeCompare(String(a.found_at || ''));
    }
    if (key === 'total') {
      return (Number(a.total_mxn) || 0) - (Number(b.total_mxn) || 0);
    }
    return (Number(a.price_mxn) || 0) - (Number(b.price_mxn) || 0);
  });
}

module.exports = {
  parseBool,
  filterItems,
  sortItems,
};
