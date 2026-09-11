(() => {
  const state = {
    category: 'all',
    free_shipping: true,
    is_price_error: false,
    max_total_mxn: '',
    min_lastfm_score: '',
    q: '',
    sort: 'price',
  };

  const els = {
    grid: document.getElementById('grid'),
    empty: document.getElementById('empty'),
    stats: document.getElementById('stats'),
    freeShipping: document.getElementById('freeShipping'),
    priceErrorOnly: document.getElementById('priceErrorOnly'),
    matchLastfm: document.getElementById('matchLastfm'),
    minLastfm: document.getElementById('minLastfm'),
    maxTotal: document.getElementById('maxTotal'),
    search: document.getElementById('search'),
    sort: document.getElementById('sort'),
  };

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

  function buildQuery() {
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
    if (state.q.trim()) params.set('q', state.q.trim());
    params.set('sort', state.sort);
    return params.toString();
  }

  function render(items, totalHint) {
    els.grid.innerHTML = '';
    if (!items.length) {
      els.empty.classList.remove('hidden');
      els.empty.textContent = 'No hay deals con estos filtros.';
      els.stats.textContent = '0 deals';
      return;
    }
    els.empty.classList.add('hidden');
    els.stats.textContent = `${items.length} deal${items.length === 1 ? '' : 's'}${totalHint ? ` · ${totalHint}` : ''}`;

    const frag = document.createDocumentFragment();
    for (const item of items) {
      const card = document.createElement('article');
      card.className = 'card';

      const top = document.createElement('div');
      top.className = 'card-top';

      const badges = document.createElement('div');
      badges.className = 'badges';
      const cat = document.createElement('span');
      cat.className = `badge ${item.category || ''}`;
      cat.textContent = categoryLabel(item.category);
      badges.appendChild(cat);
      if (item.free_shipping) {
        const ship = document.createElement('span');
        ship.className = 'badge ship';
        ship.textContent = 'Envío gratis';
        badges.appendChild(ship);
      }
      if (item.is_price_error) {
        const err = document.createElement('span');
        err.className = 'badge error';
        err.textContent = 'Price error';
        badges.appendChild(err);
      }
      const score = Number(item.lastfm_score) || 0;
      if (score > 0 && (item.category === 'vinyl' || item.category === 'cd')) {
        const aff = document.createElement('span');
        aff.className = `badge ${affinityClass(score)}`;
        const label = item.lastfm_match && item.lastfm_match.artist
          ? `Last.fm ${score} · ${item.lastfm_match.artist}`
          : `Last.fm ${score}`;
        aff.textContent = label;
        aff.title = item.lastfm_match
          ? [
              item.lastfm_match.type ? `match: ${item.lastfm_match.type}` : null,
              item.lastfm_match.loved ? 'loved' : null,
              item.lastfm_match.recent ? 'recent' : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : 'Last.fm affinity';
        badges.appendChild(aff);
      }
      top.appendChild(badges);
      card.appendChild(top);

      const h2 = document.createElement('h2');
      h2.textContent = item.title || '(sin título)';
      card.appendChild(h2);

      const artist = document.createElement('p');
      artist.className = 'artist';
      artist.textContent = item.artist_or_publisher || '—';
      card.appendChild(artist);

      if (item.subcategory) {
        const sub = document.createElement('p');
        sub.className = 'sub';
        sub.textContent = item.subcategory;
        card.appendChild(sub);
      }

      if (item.is_price_error && item.price_error_reason) {
        const reason = document.createElement('p');
        reason.className = 'reason';
        reason.textContent = item.price_error_reason;
        card.appendChild(reason);
      }

      const prices = document.createElement('div');
      prices.className = 'prices';
      prices.innerHTML = `
        <div><span>Precio</span><strong>${money(item.price_mxn)}</strong></div>
        <div><span>Envío</span><strong>${item.free_shipping ? 'Gratis' : money(item.shipping_mxn)}</strong></div>
        <div class="total"><span>Total</span><strong>${money(item.total_mxn)}</strong></div>
      `;
      card.appendChild(prices);

      const link = document.createElement('a');
      link.className = 'cta';
      link.href = item.url || '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Ver en Amazon MX';
      card.appendChild(link);

      frag.appendChild(card);
    }
    els.grid.appendChild(frag);
  }

  let debounceTimer = null;
  async function load() {
    try {
      const qs = buildQuery();
      const res = await fetch(`/api/items?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data.items || [], null);
    } catch (err) {
      els.stats.textContent = 'Error al cargar';
      els.grid.innerHTML = '';
      els.empty.classList.remove('hidden');
      els.empty.textContent = `No se pudo cargar: ${err.message}`;
    }
  }

  function scheduleLoad() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(load, 180);
  }

  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.category = btn.dataset.category;
      load();
    });
  });

  els.freeShipping.addEventListener('change', () => {
    state.free_shipping = els.freeShipping.checked;
    load();
  });
  els.priceErrorOnly.addEventListener('change', () => {
    state.is_price_error = els.priceErrorOnly.checked;
    load();
  });
  els.matchLastfm.addEventListener('change', () => {
    if (els.matchLastfm.checked) {
      state.sort = 'lastfm_match';
      els.sort.value = 'lastfm_match';
      if (state.min_lastfm_score === '') {
        state.min_lastfm_score = '1';
        els.minLastfm.value = '1';
      }
    } else if (state.sort === 'lastfm_match') {
      state.sort = 'price';
      els.sort.value = 'price';
    }
    load();
  });
  els.minLastfm.addEventListener('input', () => {
    state.min_lastfm_score = els.minLastfm.value;
    scheduleLoad();
  });
  els.maxTotal.addEventListener('input', () => {
    state.max_total_mxn = els.maxTotal.value;
    scheduleLoad();
  });
  els.search.addEventListener('input', () => {
    state.q = els.search.value;
    scheduleLoad();
  });
  els.sort.addEventListener('change', () => {
    state.sort = els.sort.value;
    els.matchLastfm.checked = state.sort === 'lastfm_match';
    load();
  });

  load();
})();
