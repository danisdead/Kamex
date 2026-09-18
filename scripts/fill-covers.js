'use strict';

const { applyBoxSecrets, secretStatus } = require('../lib/secrets');
const { fillMissingCovers } = require('../lib/covers');

applyBoxSecrets(['DISCOGS_CONSUMER_KEY', 'DISCOGS_CONSUMER_SECRET']);
for (const name of ['DISCOGS_CONSUMER_KEY', 'DISCOGS_CONSUMER_SECRET']) {
  const s = secretStatus(name);
  console.log(`${name} ${s.status} len=${s.length}`);
}

fillMissingCovers()
  .then((result) => {
    console.log(`covers summary ${JSON.stringify(result)}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`covers fill failed: ${err && err.message ? err.message : 'error'}`);
    process.exit(1);
  });
