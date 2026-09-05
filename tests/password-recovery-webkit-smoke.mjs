import { webkit } from "@playwright/test";

const BASE_URL = process.env.PASSWORD_RECOVERY_BASE_URL
  || "http://127.0.0.1:4173/";

const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true
});
const page = await context.newPage();

const pageErrors = [];
const recoveryRequestFailures = [];
page.on("pageerror", error => pageErrors.push(error.message));
page.on("requestfailed", request => {
  if (/PasswordRecovery(Bootstrap|Coordinator|Service)/.test(request.url())) {
    recoveryRequestFailures.push(`${request.url()} :: ${request.failure()?.errorText || "failed"}`);
  }
});

await page.goto(BASE_URL, { waitUntil: "networkidle" });
await page.locator("#btn-forgot-password").tap();
await page.locator("#iq-password-recovery-overlay").waitFor({ state: "visible" });
await page.locator("#iq-recovery-close").tap();
await page.locator("#tab-btn-register").tap();
await page.locator("#tab-btn-login").tap();

await page.locator("#btn-forgot-password").tap();
await page.locator("#iq-password-recovery-overlay").waitFor({ state: "visible" });

const overflow = await page.evaluate(() => (
  document.documentElement.scrollWidth > window.innerWidth + 1
));

if (pageErrors.length) {
  throw new Error(`PASSWORD_RECOVERY_WEBKIT_PAGE_ERRORS:${JSON.stringify(pageErrors)}`);
}
if (recoveryRequestFailures.length) {
  throw new Error(`PASSWORD_RECOVERY_WEBKIT_LOAD_ERRORS:${JSON.stringify(recoveryRequestFailures)}`);
}
if (overflow) {
  throw new Error("PASSWORD_RECOVERY_WEBKIT_OVERFLOW");
}

await browser.close();
console.log("PASSWORD_RECOVERY_WEBKIT_SMOKE_OK");
