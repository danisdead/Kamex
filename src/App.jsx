import { useCallback, useEffect, useRef, useState } from 'react';
import Filters from './components/Filters.jsx';
import DealCard from './components/DealCard.jsx';
import { buildQuery } from './lib/format.js';

const INITIAL = {
  category: 'all',
  free_shipping: true,
  is_price_error: false,
  max_total_mxn: '',
  min_lastfm_score: '',
  q: '',
  sort: 'price',
};

export default function App() {
  const [state, setState] = useState(INITIAL);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState('Cargando…');
  const [emptyMsg, setEmptyMsg] = useState('No hay deals con estos filtros.');
  const [showEmpty, setShowEmpty] = useState(false);
  const debounceRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = useCallback(async (nextState) => {
    const s = nextState || stateRef.current;
    try {
      const qs = buildQuery(s);
      const res = await fetch(`/api/items?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = data.items || [];
      setItems(list);
      if (!list.length) {
        setShowEmpty(true);
        setEmptyMsg('No hay deals con estos filtros.');
        setStats('0 deals');
      } else {
        setShowEmpty(false);
        setStats(`${list.length} deal${list.length === 1 ? '' : 's'}`);
      }
    } catch (err) {
      setItems([]);
      setShowEmpty(true);
      setEmptyMsg(`No se pudo cargar: ${err.message}`);
      setStats('Error al cargar');
    }
  }, []);

  const scheduleLoad = useCallback(
    (nextState) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => load(nextState), 180);
    },
    [load]
  );

  useEffect(() => {
    load(INITIAL);
    return () => clearTimeout(debounceRef.current);
  }, [load]);

  function patch(partial, { debounce = false } = {}) {
    setState((prev) => {
      const next = { ...prev, ...partial };
      if (debounce) scheduleLoad(next);
      else load(next);
      return next;
    });
  }

  function onMatchLastfm(checked) {
    setState((prev) => {
      let next = { ...prev };
      if (checked) {
        next.sort = 'lastfm_match';
        if (next.min_lastfm_score === '') next.min_lastfm_score = '1';
      } else if (next.sort === 'lastfm_match') {
        next.sort = 'price';
      }
      load(next);
      return next;
    });
  }

  function onSort(sort) {
    setState((prev) => {
      const next = { ...prev, sort };
      load(next);
      return next;
    });
  }

  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="logo">MX</span>
          <div>
            <h1>Amazon México · Deals</h1>
            <p className="tagline">Vinyl · CD · Games — rastreador local · Last.fm</p>
          </div>
        </div>
        <div className="stats">{stats}</div>
      </header>

      <Filters
        state={state}
        onCategory={(category) => patch({ category })}
        onFreeShipping={(free_shipping) => patch({ free_shipping })}
        onPriceError={(is_price_error) => patch({ is_price_error })}
        onMatchLastfm={onMatchLastfm}
        onMinLastfm={(min_lastfm_score) =>
          patch({ min_lastfm_score }, { debounce: true })
        }
        onMaxTotal={(max_total_mxn) =>
          patch({ max_total_mxn }, { debounce: true })
        }
        onSearch={(q) => patch({ q }, { debounce: true })}
        onSort={onSort}
      />

      <main>
        <div className="grid">
          {items.map((item) => (
            <DealCard key={item.id} item={item} />
          ))}
        </div>
        {showEmpty && <p className="empty">{emptyMsg}</p>}
      </main>

      <footer>
        <span>
          API: <code>/api/items</code> · <code>/api/taste</code> · Melanio puede
          hacer POST upsert
        </span>
      </footer>
    </>
  );
}
