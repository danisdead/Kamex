'use strict';

function money(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(Number(n));
}

function categoryLabel(c) {
  if (c === 'vinyl') return 'Vinyl';
  if (c === 'cd') return 'CD';
  if (c === 'game') return 'Game';
  return c || '—';
}

function affinityClass(score) {
  if (score >= 80) return 'affinity high';
  if (score >= 50) return 'affinity mid';
  if (score > 0) return 'affinity low';
  return 'affinity none';
}

function buildQuery(state) {
  const params = new URLSearchParams();
  if (state.category && state.category !== 'all') params.set('category', state.category);
  params.set('free_shipping', String(state.free_shipping));
  if (state.is_price_error) params.set('is_price_error', 'true');
  if (state.max_total_mxn !== '' && state.max_total_mxn != null) {
    params.set('max_total_mxn', String(state.max_total_mxn));
  }
  if (state.min_lastfm_score !== '' && state.min_lastfm_score != null) {
    params.set('min_lastfm_score', String(state.min_lastfm_score));
  }
  if (state.q && String(state.q).trim()) params.set('q', String(state.q).trim());
  params.set('sort', state.sort || 'price');
  return params.toString();
}

module.exports = {
  money,
  categoryLabel,
  affinityClass,
  buildQuery,
};
