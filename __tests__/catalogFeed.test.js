'use strict';

const {
  DEFAULT_CATALOG_FEED_URL,
  CATALOG_POLL_MS,
  extractItems,
  feedUpdatedAt,
  isUnchangedUpdatedAt,
  redactUrls,
} = require('../lib/catalogFeed');

const STAMP = '2026-09-18T07:36:54-06:00';

const WRAPPER = {
  updated_at: STAMP,
  source: 'mingus-amazon-mx-price-webhook',
  count: 2,
  items: [
    {
      id: 'B0A',
      title: 'A',
      artist_or_publisher: 'Artist',
      category: 'vinyl',
      price_mxn: 100,
      free_shipping: true,
      url: 'https://www.amazon.com.mx/dp/B0A',
    },
    {
      id: 'B0B',
      title: 'B',
      artist_or_publisher: 'Pub',
      category: 'game',
      price_mxn: 200,
      free_shipping: false,
      url: 'https://www.amazon.com.mx/dp/B0B',
    },
  ],
};

describe('extractItems', () => {
  test('returns items from the catalog wrapper', () => {
    const items = extractItems(WRAPPER);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.id)).toEqual(['B0A', 'B0B']);
    expect(items[0].title).toBe('A');
    expect(items[0].free_shipping).toBe(true);
  });

  test('returns empty list when items is missing or the wrapper is malformed', () => {
    expect(extractItems({ updated_at: STAMP, count: 0 })).toEqual([]);
    expect(extractItems({ items: null })).toEqual([]);
    expect(extractItems({ items: { id: 'nope' } })).toEqual([]);
    expect(extractItems(null)).toEqual([]);
    expect(extractItems(undefined)).toEqual([]);
    expect(extractItems('nope')).toEqual([]);
    expect(extractItems([{ id: 'bare' }])).toEqual([]);
  });

  test('returns an empty items array as-is', () => {
    expect(extractItems({ updated_at: STAMP, items: [] })).toEqual([]);
  });
});

describe('isUnchangedUpdatedAt', () => {
  test('detects an unchanged updated_at stamp', () => {
    expect(isUnchangedUpdatedAt(STAMP, STAMP)).toBe(true);
    expect(isUnchangedUpdatedAt(`  ${STAMP}  `, STAMP)).toBe(true);
    expect(isUnchangedUpdatedAt(feedUpdatedAt(WRAPPER), WRAPPER.updated_at)).toBe(true);
  });

  test('treats a different or missing stamp as changed', () => {
    expect(isUnchangedUpdatedAt(STAMP, '2026-09-18T08:00:00-06:00')).toBe(false);
    expect(isUnchangedUpdatedAt(null, STAMP)).toBe(false);
    expect(isUnchangedUpdatedAt(undefined, STAMP)).toBe(false);
    expect(isUnchangedUpdatedAt('', STAMP)).toBe(false);
    expect(isUnchangedUpdatedAt(STAMP, null)).toBe(false);
    expect(isUnchangedUpdatedAt(STAMP, '')).toBe(false);
    expect(isUnchangedUpdatedAt(STAMP, '   ')).toBe(false);
  });

  test('feedUpdatedAt reads the wrapper stamp and ignores junk', () => {
    expect(feedUpdatedAt(WRAPPER)).toBe(STAMP);
    expect(feedUpdatedAt({ updated_at: '  x  ' })).toBe('x');
    expect(feedUpdatedAt({})).toBeNull();
    expect(feedUpdatedAt({ updated_at: '' })).toBeNull();
    expect(feedUpdatedAt(null)).toBeNull();
    expect(feedUpdatedAt([])).toBeNull();
  });
});

describe('catalog feed constants', () => {
  test('default URL is the public Mingus gist and poll is 30 minutes', () => {
    expect(DEFAULT_CATALOG_FEED_URL).toBe(
      'https://gist.githubusercontent.com/danisdead/96dd3cdc607cf3b12247e2ffbfcf0c1b/raw/catalog.json'
    );
    expect(CATALOG_POLL_MS).toBe(30 * 60 * 1000);
  });

  test('redactUrls strips http(s) urls from log text', () => {
    expect(redactUrls('fetch failed https://example.com/raw/catalog.json?token=secret')).toBe(
      'fetch failed [url]'
    );
    expect(redactUrls('no url here')).toBe('no url here');
  });
});
