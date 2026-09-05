import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, guard, release, users] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../features/release/ReleaseVersionGuard.js', import.meta.url), 'utf8'),
  readFile(new URL('../release.json', import.meta.url), 'utf8'),
  readFile(new URL('../views/TranslationsView.js', import.meta.url), 'utf8')
]);

const releaseData = JSON.parse(release);
assert.ok(String(releaseData.release || '').trim(), 'release id is required');
assert.ok(html.includes('./features/release/ReleaseVersionGuard.js'));
assert.ok(html.indexOf('ReleaseVersionGuard.js') < html.indexOf('./index.js'));
assert.match(guard, /cache:\s*'no-store'/);
assert.match(guard, /visibilitychange/);
assert.match(guard, /window\.addEventListener\('focus'/);
assert.match(guard, /__IQBASKET_RELEASE_STALE__/);
assert.match(guard, /Nueva versión disponible/);
assert.match(users, /PLAYER_LINK_REQUIRED/);
assert.match(users, /seleccionar primero el jugador vinculado/i);

console.log('RELEASE_VERSION_GUARD_CONTRACT_OK');
