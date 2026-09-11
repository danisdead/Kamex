# Deal item schema

"
"- id, title, artist_or_publisher, category, subcategory
"
"- price_mxn, list_price_mxn, shipping_mxn, total_mxn, condition, url
"
"- is_price_error, price_error_reason, found_at, source
"
"- **free_shipping** (boolean, required): true when shipping is free

"
"## Filter policy (Dan)
"
"Prefer ONLY free_shipping=true in the main feed. Deprioritize or exclude shipping_mxn > 0.
"
"Cheap items with expensive shipping must not surface as top deals.
"
