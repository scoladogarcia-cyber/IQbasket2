import { chromium } from '@playwright/test';
import { installBrowserNetworkStubs } from './browser-test-support.mjs';

const BASE_URL = process.env.QA_BASE_URL || 'http://127.0.0.1:4173/';

function assert(condition, message, detail = null) {
  if (!condition) {
    throw new Error(`${message}${detail ? ` · ${JSON.stringify(detail)}` : ''}`);
  }
}

async function runViewport(name, viewport) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await installBrowserNetworkStubs(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  await page.evaluate(async () => {
    const { FeedbackView } = await import('/views/FeedbackView.js');
    const calls = [];
    const supabase = {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: 'feedback-smoke-id', error: null };
      }
    };
    document.body.innerHTML = '<main id="feedback-smoke-root"></main>';
    localStorage.setItem('iq_user_role', 'INVITADO');
    window.location.hash = '#/feedback';
    const view = new FeedbackView(supabase, null);
    await view.render('feedback-smoke-root');
    window.__feedbackSmoke = { calls };
  });

  await page.selectOption('select[name="category"]', 'BUG');
  await page.selectOption('select[name="severity"]', 'BLOCKER');
  await page.fill('textarea[name="message"]', 'El botón de prueba no responde');
  await page.click('#early-feedback-form button[type="submit"]');
  await page.waitForFunction(() => window.__feedbackSmoke?.calls?.length === 1);
  await page.waitForFunction(() => document.querySelector('#feedback-status')?.textContent?.trim().length > 0);

  const result = await page.evaluate(() => {
    const call = window.__feedbackSmoke.calls[0];
    const root = document.querySelector('#feedback-smoke-root');
    return {
      call,
      status: document.querySelector('#feedback-status')?.textContent?.trim() || '',
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      rootWidth: root?.getBoundingClientRect().width || 0,
      viewportWidth: window.innerWidth
    };
  });
  assert(result.call?.name === 'iq_v19_submit_product_feedback', `${name}: RPC incorrecta`, result.call);
  assert(result.call?.args?.p_category === 'BUG', `${name}: categoría incorrecta`, result.call);
  assert(result.call?.args?.p_severity === 'BLOCKER', `${name}: severidad incorrecta`, result.call);
  assert(result.call?.args?.p_message?.includes('botón de prueba'), `${name}: mensaje perdido`, result.call);
  assert(result.call?.args?.p_route === '#/feedback', `${name}: ruta no trazada`, result.call);
  assert(String(result.call?.args?.p_release_code || '').includes('early-adopters'), `${name}: release no trazada`, result.call);
  assert(result.call?.args?.p_client_context?.role_hint === 'INVITADO', `${name}: rol de contexto no trazado`, result.call);
  assert(result.status.length > 0, `${name}: no hay confirmación de envío`);
  assert(!result.overflow, `${name}: overflow horizontal`);
  assert(result.rootWidth <= result.viewportWidth + 1, `${name}: vista fuera del viewport`, result);
  assert(pageErrors.length === 0, `${name}: pageerror`, pageErrors);

  console.log(JSON.stringify({ name, result: 'PASS' }));
  await browser.close();
}

await runViewport('feedback-desktop', { width: 1440, height: 900 });
await runViewport('feedback-iphone', { width: 390, height: 844 });
await runViewport('feedback-compact', { width: 320, height: 568 });
console.log('EARLY_ADOPTER_FEEDBACK_V1_UI_OK');
