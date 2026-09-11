'use strict';

const { parseBool, filterItems, sortItems } = require('../lib/filters');
const { buildQuery, categoryLabel, affinityClass, money } = require('../lib/format');

const SAMPLE = [
  {
    id: 'a',
    title: 'OK Computer',
    artist_or_publisher: 'Radiohead',
    category: 'vinyl',
    free_shipping: true,
    is_price_error: true,
    price_mxn: 300,
    total_mxn: 300,
    lastfm_score: 90,
    found_at: '2026-09-10T12:00:00Z',
  },
  {
    id: 'b',
    title: 'Doolittle',
    artist_or_publisher: 'Pixies',
    category: 'cd',
    free_shipping: false,
    is_price_error: false,
    price_mxn: 150,
    total_mxn: 200,
    lastfm_score: 40,
    found_at: '2026-09-11T12:00:00Z',
  },
  {
    id: 'c',
    title: 'Zelda',
    artist_or_publisher: 'Nintendo',
    category: 'game',
    free_shipping: true,
    is_price_error: false,
    price_mxn: 500,
    total_mxn: 500,
    lastfm_score: 0,
    found_at: '2026-09-09T12:00:00Z',
  },
];

describe('parseBool', () => {
  test('parses common truthy/falsy strings', () => {
    expect(parseBool('true')).toBe(true);
    expect(parseBool('1')).toBe(true);
    expect(parseBool('false')).toBe(false);
    expect(parseBool('0')).toBe(false);
    expect(parseBool('')).toBeUndefined();
    expect(parseBool(undefined)).toBeUndefined();
  });
});

describe('filterItems', () => {
  test('filters free_shipping', () => {
    const out = filterItems(SAMPLE, { free_shipping: true });
    expect(out.map((i) => i.id)).toEqual(['a', 'c']);
  });

  test('filters category', () => {
    const out = filterItems(SAMPLE, { category: 'vinyl' });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a');
  });

  test('category all keeps everything', () => {
    expect(filterItems(SAMPLE, { category: 'all' })).toHaveLength(3);
  });

  test('filters by search q on title and artist', () => {
    expect(filterItems(SAMPLE, { q: 'radio' }).map((i) => i.id)).toEqual(['a']);
    expect(filterItems(SAMPLE, { q: 'pixies' }).map((i) => i.id)).toEqual(['b']);
  });

  test('filters min_lastfm_score', () => {
    const out = filterItems(SAMPLE, { min_lastfm_score: 50 });
    expect(out.map((i) => i.id)).toEqual(['a']);
  });

  test('filters is_price_error and max_total_mxn', () => {
    expect(filterItems(SAMPLE, { is_price_error: true })).toHaveLength(1);
    expect(filterItems(SAMPLE, { max_total_mxn: 350 }).map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('sortItems', () => {
  test('sorts by price ascending by default', () => {
    expect(sortItems(SAMPLE).map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  test('sorts by lastfm_match descending then price', () => {
    expect(sortItems(SAMPLE, 'lastfm_match').map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  test('sorts by total', () => {
    expect(sortItems(SAMPLE, 'total').map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  test('sorts by found_at newest first', () => {
    expect(sortItems(SAMPLE, 'found_at').map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('format helpers', () => {
  test('buildQuery includes free_shipping and sort', () => {
    const qs = buildQuery({
      category: 'vinyl',
      free_shipping: true,
      is_price_error: false,
      max_total_mxn: '',
      min_lastfm_score: '1',
      q: 'radio',
      sort: 'lastfm_match',
    });
    const params = new URLSearchParams(qs);
    expect(params.get('category')).toBe('vinyl');
    expect(params.get('free_shipping')).toBe('true');
    expect(params.get('min_lastfm_score')).toBe('1');
    expect(params.get('q')).toBe('radio');
    expect(params.get('sort')).toBe('lastfm_match');
    expect(params.has('is_price_error')).toBe(false);
  });

  test('categoryLabel and affinityClass', () => {
    expect(categoryLabel('vinyl')).toBe('Vinyl');
    expect(affinityClass(90)).toBe('affinity high');
    expect(affinityClass(55)).toBe('affinity mid');
    expect(affinityClass(10)).toBe('affinity low');
    expect(affinityClass(0)).toBe('affinity none');
  });

  test('money formats MXN or dash', () => {
    expect(money(null)).toBe('—');
    expect(money(199.5)).toMatch(/199/);
  });
});
