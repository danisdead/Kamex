import { money, categoryLabel, affinityClass } from '../lib/format.js';

export default function DealCard({ item }) {
  const score = Number(item.lastfm_score) || 0;
  const showAffinity =
    score > 0 && (item.category === 'vinyl' || item.category === 'cd');

  const affinityLabel =
    item.lastfm_match && item.lastfm_match.artist
      ? `Last.fm ${score} · ${item.lastfm_match.artist}`
      : `Last.fm ${score}`;

  const affinityTitle = item.lastfm_match
    ? [
        item.lastfm_match.type ? `match: ${item.lastfm_match.type}` : null,
        item.lastfm_match.loved ? 'loved' : null,
        item.lastfm_match.recent ? 'recent' : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Last.fm affinity';

  const showCover =
    Boolean(item.cover_url) &&
    (item.category === 'vinyl' || item.category === 'cd');

  return (
    <article className="card">
      {showCover && (
        <img
          className="cover"
          src={item.cover_url}
          alt={item.title ? `Portada: ${item.title}` : 'Portada'}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.remove();
          }}
        />
      )}
      <div className="card-top">
        <div className="badges">
          <span className={`badge ${item.category || ''}`}>
            {categoryLabel(item.category)}
          </span>
          {item.free_shipping && (
            <span className="badge ship">ENVÍO GRATIS</span>
          )}
          {item.is_price_error && (
            <span className="badge error">PRICE ERROR</span>
          )}
          {showAffinity && (
            <span
              className={`badge ${affinityClass(score)}`}
              title={affinityTitle}
            >
              {affinityLabel}
            </span>
          )}
        </div>
      </div>

      <h2>{item.title || '(sin título)'}</h2>
      <p className="artist">{item.artist_or_publisher || '—'}</p>
      {item.subcategory && <p className="sub">{item.subcategory}</p>}
      {item.is_price_error && item.price_error_reason && (
        <p className="reason">{item.price_error_reason}</p>
      )}

      <div className="prices">
        <div>
          <span>Precio</span>
          <strong>{money(item.price_mxn)}</strong>
        </div>
        <div>
          <span>Envío</span>
          <strong>
            {item.free_shipping ? 'Gratis' : money(item.shipping_mxn)}
          </strong>
        </div>
        <div className="total">
          <span>Total</span>
          <strong>{money(item.total_mxn)}</strong>
        </div>
      </div>

      <a
        className="cta"
        href={item.url || '#'}
        target="_blank"
        rel="noopener noreferrer"
      >
        Ver en Amazon MX
      </a>
    </article>
  );
}
