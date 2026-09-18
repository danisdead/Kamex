'use strict';

const fs = require('fs');

const DEFAULT_PATHS = [
  process.env.BOX_SECRETS_PATH,
  '/home/box/sand-data/box-secrets.json',
].filter(Boolean);

/**
 * Copy missing process.env vars from box-secrets.json card.VAR_NAME.
 * Never logs or returns secret values.
 */
function applyBoxSecrets(names, filePath) {
  const needed = (names || []).filter((name) => !process.env[name]);
  if (!needed.length) return;
  const paths = filePath ? [filePath] : DEFAULT_PATHS;
  let card = null;
  for (const p of paths) {
    try {
      if (!p || !fs.existsSync(p)) continue;
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (data && data.card && typeof data.card === 'object') {
        card = data.card;
        break;
      }
    } catch {
      /* ignore unreadable secrets file */
    }
  }
  if (!card) return;
  for (const name of needed) {
    const value = card[name];
    if (typeof value === 'string' && value.length > 0) {
      process.env[name] = value;
    }
  }
}

function secretStatus(name) {
  const value = process.env[name] || '';
  return {
    name,
    status: value ? 'SET' : 'MISSING',
    length: value.length,
  };
}

module.exports = { applyBoxSecrets, secretStatus };
