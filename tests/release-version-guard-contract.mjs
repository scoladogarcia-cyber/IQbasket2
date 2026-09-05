import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, release, users] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../release.json', import.meta.url), 'utf8'),
  readFile(new URL('../views/TranslationsView.js', import.meta.url), 'utf8')
]);

const releaseData = JSON.parse(release);
assert.ok(String(releaseData.release || '').trim(), 'release id is required');
assert.ok(html.indexOf('release.json?t=') < html.indexOf('./index.js'));
assert.match(html, /cache:\s*'no-store'/);
assert.match(html, /visibilitychange/);
assert.match(html, /addEventListener\('focus'/);
assert.match(html, /__IQBASKET_RELEASE_STALE__/);
assert.match(html, /Nueva versi&oacute;n disponible/);
assert.match(users, /PLAYER_LINK_REQUIRED/);
assert.match(users, /seleccionar primero el jugador vinculado/i);

console.log('RELEASE_VERSION_GUARD_CONTRACT_OK');
