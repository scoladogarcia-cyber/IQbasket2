const RELEASE_URL = './release.json';
const CHECK_INTERVAL_MS = 60_000;
let loadedRelease = null;
let stale = false;

async function fetchRelease() {
  const response = await fetch(`${RELEASE_URL}?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!response.ok) throw new Error(`release_${response.status}`);
  return response.json();
}

function renderStaleOverlay(nextRelease) {
  if (document.getElementById('iq-release-stale-overlay')) return;
  stale = true;
  window.__IQBASKET_RELEASE_STALE__ = true;
  const overlay = document.createElement('div');
  overlay.id = 'iq-release-stale-overlay';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.dataset.release = String(nextRelease || 'new');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(15,23,42,.88);backdrop-filter:blur(6px);';
  overlay.innerHTML = `
    <div class="iq-release-stale-card" style="max-width:420px;width:100%;background:white;color:#0f172a;border-radius:18px;padding:24px;box-shadow:0 24px 64px rgba(0,0,0,.35);">
      <strong>Nueva versión disponible</strong>
      <p style="line-height:1.45;margin:0 0 18px;">IQBasket se ha actualizado. Recarga antes de seguir editando para evitar mezclar versiones.</p>
      <button type="button" id="iq-release-reload" style="width:100%;min-height:48px;border:0;border-radius:12px;background:#f97316;color:white;font-weight:800;font-size:16px;">Actualizar ahora</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('iq-release-reload')?.addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('release', String(nextRelease || Date.now()));
    window.location.replace(url.toString());
  });
}

async function checkRelease() {
  if (stale) return;
  try {
    const current = await fetchRelease();
    const release = String(current?.release || '').trim();
    if (!release) return;
    if (!loadedRelease) {
      loadedRelease = release;
      window.__IQBASKET_RELEASE__ = release;
      return;
    }
    if (release !== loadedRelease) renderStaleOverlay(release);
  } catch (error) {
    console.debug('Release check skipped:', error?.message || error);
  }
}

window.__IQBASKET_ASSERT_CURRENT_RELEASE__ = async () => {
  await checkRelease();
  return !window.__IQBASKET_RELEASE_STALE__;
};

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void checkRelease();
});
window.addEventListener('focus', () => void checkRelease());
window.addEventListener('online', () => void checkRelease());
setInterval(() => void checkRelease(), CHECK_INTERVAL_MS);
void checkRelease();
