'use strict';

const {
  norm,
  buildTasteIndex,
  candidateArtists,
  bestArtistMatch,
  computeLastfmScore,
  enrichWithLastfm,
} = require('../lib/lastfm');

describe('norm', () => {
  test('lowercases and strips accents', () => {
    expect(norm('Café Tacvba')).toBe('cafe tacvba');
  });
  test('replaces & with and', () => {
    expect(norm('AC/DC & Friends')).toContain('and');
  });
  test('empty input', () => {
    expect(norm('')).toBe('');
    expect(norm(null)).toBe('');
  });
});

describe('candidateArtists', () => {
  test('uses artist_or_publisher and splits joiners', () => {
    const c = candidateArtists({
      artist_or_publisher: 'Radiohead / Thom Yorke',
      title: 'OK Computer',
    });
    expect(c).toEqual(expect.arrayContaining(['Radiohead / Thom Yorke', 'Radiohead', 'Thom Yorke']));
  });
  test('parses Artist - Album title', () => {
    const c = candidateArtists({ title: 'Pink Floyd - The Wall', artist_or_publisher: null });
    expect(c).toContain('Pink Floyd');
  });
});

describe('computeLastfmScore', () => {
  const taste = {
    artists: [
      { name: 'Radiohead', playcount: 5000 },
      { name: 'Pixies', playcount: 2000 },
      { name: 'Unknown Minor', playcount: 10 },
    ],
    artists_12month: [{ name: 'Pixies', playcount: 100 }],
    loved: [{ artist: 'Radiohead', title: 'Karma Police' }],
    recent: [{ artist: 'Pixies', title: 'Where Is My Mind?' }],
  };
  const index = buildTasteIndex(taste);

  test('games score 0', () => {
    const r = computeLastfmScore(
      { category: 'game', title: 'Radiohead Game', artist_or_publisher: 'Radiohead' },
      index
    );
    expect(r.lastfm_score).toBe(0);
    expect(r.lastfm_match).toBeNull();
  });

  test('exact overall match scores high and may include loved bonus', () => {
    const r = computeLastfmScore(
      { category: 'vinyl', title: 'OK Computer', artist_or_publisher: 'Radiohead' },
      index
    );
    expect(r.lastfm_score).toBeGreaterThanOrEqual(80);
    expect(r.lastfm_match.artist).toBe('Radiohead');
    expect(r.lastfm_match.type).toBe('exact');
    expect(r.lastfm_match.loved).toBe(true);
  });

  test('no match returns 0', () => {
    const r = computeLastfmScore(
      { category: 'cd', title: 'Random Album', artist_or_publisher: 'Nobody Ever' },
      index
    );
    expect(r.lastfm_score).toBe(0);
    expect(r.lastfm_match).toBeNull();
  });

  test('soft match via containment', () => {
    const softIndex = buildTasteIndex({
      artists: [{ name: 'The Beatles', playcount: 1000 }],
      artists_12month: [],
      loved: [],
      recent: [],
    });
    const r = computeLastfmScore(
      { category: 'vinyl', title: 'Abbey Road', artist_or_publisher: 'Beatles' },
      softIndex
    );
    expect(r.lastfm_score).toBeGreaterThan(0);
    expect(r.lastfm_match.type).toBe('soft');
  });

  test('enrichWithLastfm attaches scores', () => {
    const items = enrichWithLastfm(
      [
        { id: '1', category: 'vinyl', artist_or_publisher: 'Radiohead', title: 'Kid A' },
        { id: '2', category: 'game', artist_or_publisher: 'Radiohead', title: 'X' },
      ],
      taste
    );
    expect(items[0].lastfm_score).toBeGreaterThan(0);
    expect(items[1].lastfm_score).toBe(0);
  });
});

describe('bestArtistMatch', () => {
  test('prefers higher-ranked exact match', () => {
    const map = new Map([
      ['radiohead', { name: 'Radiohead', playcount: 1, rank: 1 }],
      ['pixies', { name: 'Pixies', playcount: 1, rank: 2 }],
    ]);
    const best = bestArtistMatch(['Pixies', 'Radiohead'], map);
    expect(best.name).toBe('Radiohead');
    expect(best.match).toBe('exact');
  });
});
