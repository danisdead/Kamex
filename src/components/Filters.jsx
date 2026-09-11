const CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'vinyl', label: 'Vinyl' },
  { id: 'cd', label: 'CD' },
  { id: 'game', label: 'Games' },
];

export default function Filters({
  state,
  onCategory,
  onFreeShipping,
  onPriceError,
  onMatchLastfm,
  onMinLastfm,
  onMaxTotal,
  onSearch,
  onSort,
}) {
  return (
    <section className="filters" aria-label="Filtros">
      <div className="tabs" role="tablist">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`tab${state.category === c.id ? ' active' : ''}`}
            data-category={c.id}
            type="button"
            onClick={() => onCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="controls">
        <label className="toggle">
          <input
            type="checkbox"
            checked={state.free_shipping}
            onChange={(e) => onFreeShipping(e.target.checked)}
          />
          <span>Envío gratis</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={state.is_price_error}
            onChange={(e) => onPriceError(e.target.checked)}
          />
          <span>Solo price error</span>
        </label>
        <label className="toggle" title="Ordenar por afinidad Last.fm">
          <input
            type="checkbox"
            checked={state.sort === 'lastfm_match'}
            onChange={(e) => onMatchLastfm(e.target.checked)}
          />
          <span>Match Last.fm</span>
        </label>
        <label className="field">
          <span>Mín. Last.fm</span>
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            placeholder="0"
            value={state.min_lastfm_score}
            onChange={(e) => onMinLastfm(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Máx. total MXN</span>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="ej. 500"
            value={state.max_total_mxn}
            onChange={(e) => onMaxTotal(e.target.value)}
          />
        </label>
        <label className="field grow">
          <span>Buscar</span>
          <input
            type="search"
            placeholder="título o artista…"
            value={state.q}
            onChange={(e) => onSearch(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Orden</span>
          <select value={state.sort} onChange={(e) => onSort(e.target.value)}>
            <option value="price">Precio</option>
            <option value="total">Total</option>
            <option value="found_at">Más reciente</option>
            <option value="lastfm_match">Match Last.fm</option>
          </select>
        </label>
      </div>
    </section>
  );
}
