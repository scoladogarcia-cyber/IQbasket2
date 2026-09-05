import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PasswordRecoveryService } from "../services/security/PasswordRecoveryService.js";

let authListener = null;
const calls = [];
const auth = {
  async resetPasswordForEmail(email, options) {
    calls.push({ type: "reset", email, options });
    return { data: {}, error: null };
  },
  onAuthStateChange(callback) {
    authListener = callback;
    return { data: { subscription: { unsubscribe() {} } } };
  },
  async getSession() {
    return { data: { session: { user: { id: "user-1" } } }, error: null };
  },
  async updateUser(payload) {
    calls.push({ type: "update", payload });
    return { data: { user: { id: "user-1" } }, error: null };
  },
  async signOut() { calls.push({ type: "signout" }); }
};
global.window = {
  location: {
    href: "https://scoladogarcia-cyber.github.io/IQbasket2/?recovery=1",
    origin: "https://scoladogarcia-cyber.github.io",
    pathname: "/IQbasket2/",
    search: "?recovery=1",
    hash: ""
  },
  history: { replaceState() {} }
};

const service = new PasswordRecoveryService({ auth }, { minPasswordLength: 8 });
assert.equal(service.isValidEmail("user@example.com"), true);
assert.equal(service.isValidEmail("not-an-email"), false);
assert.equal(service.isRecoveryCallbackUrl(), true);

const requested = await service.requestReset(" USER@EXAMPLE.COM ");
assert.equal(requested.success, true);
assert.equal(calls[0].email, "user@example.com");
assert.match(calls[0].options.redirectTo, /\/IQbasket2\/\?recovery=1$/);

const context = await service.inspectRecoveryContext();
assert.deepEqual({ requested: context.requested, ready: context.ready }, { requested: true, ready: true });
let recoveryEvent = false;
service.subscribe(() => { recoveryEvent = true; });
authListener?.("PASSWORD_RECOVERY", { user: { id: "user-1" } });
assert.equal(recoveryEvent, true);

assert.equal((await service.updatePassword("short")).code, "PASSWORD_TOO_SHORT");
assert.equal((await service.updatePassword("secure-pass-123")).success, true);
assert.deepEqual(calls.find((call) => call.type === "update")?.payload, { password: "secure-pass-123" });

const view = await readFile(new URL("../views/AuthView.js", import.meta.url), "utf8");
const app = await readFile(new URL("../index.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const coordinator = await readFile(new URL("../features/auth/PasswordRecoveryCoordinator.js", import.meta.url), "utf8");
const bootstrap = await readFile(new URL("../features/auth/PasswordRecoveryBootstrap.js", import.meta.url), "utf8");

assert.match(view, /id="btn-forgot-password"/);
assert.match(app, /__IQ_PASSWORD_RECOVERY__/);
assert.doesNotMatch(app, /getElementById\("btn-forgot-password"\)/);
assert.match(app, /openRecoveryFromCallback/);
assert.match(bootstrap, /document\.addEventListener\("click"/);
assert.match(bootstrap, /closest\("#btn-forgot-password"\)/);
assert.match(bootstrap, /import\("\.\/PasswordRecoveryCoordinator\.js"\)/);
assert.match(app, /if \(window\.__IQ_PASSWORD_RECOVERY__ === true\) return false/);
assert.match(html, /PasswordRecoveryBootstrap\.js/);
assert.match(coordinator, /id="iq-recovery-request-form"/);
assert.match(coordinator, /id="iq-recovery-update-form"/);
assert.match(coordinator, /service\.requestReset/);
assert.match(coordinator, /service\.updatePassword/);
assert.match(coordinator, /Las dos contraseñas no coinciden/);
assert.doesNotMatch(coordinator, /auth\.admin\.updateUserById/);

console.log("PASSWORD_RECOVERY_CONTRACT_OK");
