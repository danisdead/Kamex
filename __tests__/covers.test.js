'use strict';

const {
  USER_AGENT,
  wantsCover,
  buildSearchQuery,
  buildSearchUrl,
  buildAuthHeader,
  pickThumb,
  attachCovers,
} = require('../lib/covers');

describe('buildSearchQuery', () => {
  test('joins artist_or_publisher and title', () => {
    expect(
      buildSearchQuery({ artist_or_publisher: 'Radiohead', title: 'OK Computer' })
    ).toBe('Radiohead OK Computer');
  });

  test('strips marketplace format notes but keeps the artist and title', () => {
    expect(
      buildSearchQuery({
        artist_or_publisher: 'Deftones',
        title: 'Adrenaline (Vinyl) [Importado]',
      })
    ).toBe('Deftones Adrenaline');
    expect(
      buildSearchQuery({
        artist_or_publisher: 'Radiohead',
        title: 'Radiohead - En arcoiris (vinilo)',
      })
    ).toBe('Radiohead En arcoiris');
  });

  test('trims and skips empty parts', () => {
    expect(buildSearchQuery({ artist_or_publisher: '  ', title: ' MUEVENSE CD ' })).toBe(
      'MUEVENSE CD'
    );
    expect(buildSearchQuery({ artist_or_publisher: 'Boards of Canada', title: null })).toBe(
      'Boards of Canada'
    );
    expect(buildSearchQuery({})).toBe('');
  });

  test('builds the Discogs search URL', () => {
    const u = new URL(buildSearchUrl('Radiohead OK Computer'));
    expect(u.origin + u.pathname).toBe('https://api.discogs.com/database/search');
    expect(u.searchParams.get('q')).toBe('Radiohead OK Computer');
    expect(u.searchParams.get('type')).toBe('release');
    expect(u.searchParams.get('per_page')).toBe('5');
  });
});

describe('pickThumb', () => {
  test('prefers thumb over cover_image from the first result', () => {
    const picked = pickThumb({
      results: [
        { id: 11, thumb: 'https://i.discogs.com/a.jpg', cover_image: 'https://i.discogs.com/b.jpg' },
        { id: 22, thumb: 'https://i.discogs.com/other.jpg' },
      ],
    });
    expect(picked).toEqual({ cover_url: 'https://i.discogs.com/a.jpg', discogs_id: 11 });
  });

  test('falls back to cover_image when thumb is missing or a spacer', () => {
    expect(
      pickThumb([{ id: 3, thumb: '', cover_image: 'https://i.discogs.com/c.jpg' }])
    ).toEqual({ cover_url: 'https://i.discogs.com/c.jpg', discogs_id: 3 });
    expect(
      pickThumb([
        {
          id: 4,
          thumb: 'https://img.discogs.com/images/spacer.gif',
          cover_image: 'https://i.discogs.com/real.jpg',
        },
      ])
    ).toEqual({ cover_url: 'https://i.discogs.com/real.jpg', discogs_id: 4 });
  });

  test('returns null cover when there is no usable image', () => {
    expect(pickThumb({ results: [] })).toEqual({ cover_url: null, discogs_id: null });
    expect(
      pickThumb([
        {
          id: 9,
          thumb: 'https://st.discogs.com/spacer.gif',
          cover_image: 'https://img.discogs.com/images/spacer.gif',
        },
      ])
    ).toEqual({ cover_url: null, discogs_id: 9 });
  });
});

describe('skip games', () => {
  test('only vinyl and cd want covers', () => {
    expect(wantsCover({ category: 'vinyl' })).toBe(true);
    expect(wantsCover({ category: 'CD' })).toBe(true);
    expect(wantsCover({ category: 'game' })).toBe(false);
    expect(wantsCover({ category: 'games' })).toBe(false);
    expect(wantsCover(null)).toBe(false);
  });

  test('attachCovers omits games even if the cache has a url', () => {
    const items = attachCovers(
      [
        { id: 'g1', category: 'game', title: 'Zelda', cover_url: 'https://evil.example/x.jpg' },
        { id: 'v1', category: 'vinyl', title: 'OK Computer', artist_or_publisher: 'Radiohead' },
        { id: 'c1', category: 'cd', title: 'Unknown' },
      ],
      {
        g1: { cover_url: 'https://i.discogs.com/game.jpg', discogs_id: 1, queried_at: 't' },
        v1: { cover_url: 'https://i.discogs.com/ok.jpg', discogs_id: 2, queried_at: 't' },
        c1: { cover_url: null, discogs_id: null, queried_at: 't' },
      }
    );
    expect(items[0].cover_url).toBeUndefined();
    expect(items[1].cover_url).toBe('https://i.discogs.com/ok.jpg');
    expect(items[2].cover_url).toBeNull();
  });
});

describe('discogs request shape', () => {
  test('auth header and user agent', () => {
    expect(buildAuthHeader('abc', 'def')).toBe('Discogs key=abc, secret=def');
    expect(USER_AGENT).toContain('Kamex/1.0');
    expect(USER_AGENT).toContain('danisdead@users.noreply.github.com');
  });
});
