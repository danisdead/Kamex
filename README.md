# Amazon MX Deals

Local fullstack microsite to browse Amazon México deal finds (vinyl, CD, games).

## Run

```bash
cd /workspace/amazon-mx-deals
npm install
npm start
```

- Listens on `0.0.0.0:3847`
- Open: **http://127.0.0.1:3847**

Optional env:

```bash
PORT=3847 HOST=0.0.0.0 npm start
```

## Seed data

Items live in `data/items.json` (copied from `/workspace/amazon-mx-deals-data/seed-all.json` at setup). The app does not depend on paths outside this project.

## API

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/health` | Health + item count |
| GET | `/api/taste` | Last.fm taste snapshot (`data/taste-lastfm.json`) |
| GET | `/api/items` | Filter/sort list (includes `lastfm_score`) |
| GET | `/api/items/:id` | One item |
| POST | `/api/items` | Upsert one object or array (idempotent by `id`) |

### Query params for `GET /api/items`

- `category` — `vinyl` \| `cd` \| `game`
- `subcategory` — exact match
- `free_shipping` — `true` \| `false` (UI defaults to `true`)
- `is_price_error` — `true` \| `false`
- `max_total_mxn` — number
- `q` — search title / artist_or_publisher
- `sort` — `price` (default) \| `total` \| `found_at` \| `lastfm_match`
- `min_lastfm_score` — number 0–100 (vinyl/cd affinity filter)

### Melanio — POST `/api/items` contract

Upsert one item or many. Matching `id` replaces/merges; new `id` creates.

**Single:**

```bash
curl -sS -X POST http://127.0.0.1:3847/api/items \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "B0EXAMPLE01",
    "title": "Example Album",
    "artist_or_publisher": "Some Artist",
    "category": "vinyl",
    "subcategory": "rock",
    "price_mxn": 199.99,
    "list_price_mxn": 399.00,
    "shipping_mxn": 0,
    "total_mxn": 199.99,
    "condition": "Nuevo",
    "url": "https://www.amazon.com.mx/dp/B0EXAMPLE01",
    "is_price_error": true,
    "price_error_reason": "price down to 199.99",
    "found_at": "2026-09-11T08:00:00-06:00",
    "source": "melanio",
    "free_shipping": true
  }'
```

**Array:**

```bash
curl -sS -X POST http://127.0.0.1:3847/api/items \
  -H 'Content-Type: application/json' \
  -d '[
    { "id": "B0A", "title": "A", "category": "cd", "price_mxn": 100, "shipping_mxn": 0, "total_mxn": 100, "url": "https://www.amazon.com.mx/dp/B0A", "free_shipping": true, "is_price_error": false, "found_at": "2026-09-11T08:00:00-06:00", "source": "melanio" },
    { "id": "B0B", "title": "B", "category": "game", "price_mxn": 299, "shipping_mxn": 0, "total_mxn": 299, "url": "https://www.amazon.com.mx/dp/B0B", "free_shipping": true, "is_price_error": false, "found_at": "2026-09-11T08:00:00-06:00", "source": "melanio" }
  ]'
```

Response shape:

```json
{ "ok": true, "created": 1, "updated": 0, "total": 41 }
```

## Item schema

`id`, `title`, `artist_or_publisher`, `category` (`vinyl`\|`cd`\|`game`), `subcategory`, `price_mxn`, `list_price_mxn`, `shipping_mxn`, `total_mxn`, `condition`, `url`, `is_price_error`, `price_error_reason`, `found_at`, `source`, `free_shipping` (boolean).

## UI defaults

- Free shipping filter **ON**
- Sort by price
- Category tabs: Todos / Vinyl / CD / Games
