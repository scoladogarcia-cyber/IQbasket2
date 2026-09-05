/**
 * @fileoverview Password recovery boundary for Supabase Auth.
 * Keeps recovery email, callback detection and password update out of the UI.
 */
export class PasswordRecoveryService {
  constructor(supabaseClient, { minPasswordLength = 8 } = {}) {
    this.supabase = supabaseClient;
    this.minPasswordLength = minPasswordLength;
    this.subscription = null;
  }

  _assertConfigured() {
    if (!this.supabase?.auth) throw new Error("AUTH_RECOVERY_UNAVAILABLE");
  }

  normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  isValidEmail(email) {
    const value = this.normalizeEmail(email);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  getRecoveryRedirectUrl() {
    if (typeof window === "undefined") return null;
    const url = new URL(window.location.href);
    url.hash = "";
    url.search = "";
    url.searchParams.set("recovery", "1");
    return url.toString();
  }

  isRecoveryCallbackUrl() {
    if (typeof window === "undefined") return false;
    const url = new URL(window.location.href);
    return url.searchParams.get("recovery") === "1"
      || /(?:^|[&#])type=recovery(?:&|$)/i.test(window.location.hash || "");
  }

  async requestReset(email) {
    this._assertConfigured();
    const normalizedEmail = this.normalizeEmail(email);
    if (!this.isValidEmail(normalizedEmail)) {
      return { success: false, code: "INVALID_EMAIL" };
    }

    const redirectTo = this.getRecoveryRedirectUrl();
    const { error } = await this.supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      redirectTo ? { redirectTo } : undefined
    );

    if (error) {
      return {
        success: false,
        code: error.status === 429 ? "RATE_LIMITED" : "RESET_REQUEST_FAILED",
        error
      };
    }

    // Generic success: do not reveal whether an account exists for this email.
    return { success: true };
  }

  subscribe(onRecovery) {
    this._assertConfigured();
    this.subscription?.unsubscribe?.();
    const { data } = this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") onRecovery?.(session);
    });
    this.subscription = data?.subscription || null;
    return this.subscription;
  }

  async inspectRecoveryContext() {
    this._assertConfigured();
    const requested = this.isRecoveryCallbackUrl();
    if (!requested) return { requested: false, ready: false };

    const { data, error } = await this.supabase.auth.getSession();
    return {
      requested: true,
      ready: Boolean(data?.session?.user),
      error: error || null
    };
  }

  async updatePassword(password) {
    this._assertConfigured();
    const value = String(password || "");
    if (value.length < this.minPasswordLength) {
      return { success: false, code: "PASSWORD_TOO_SHORT" };
    }

    const { data, error } = await this.supabase.auth.updateUser({ password: value });
    if (error || !data?.user) {
      return { success: false, code: "PASSWORD_UPDATE_FAILED", error };
    }
    return { success: true };
  }

  async finishRecovery() {
    this._assertConfigured();
    try {
      await this.supabase.auth.signOut();
    } catch (_) {
      // The password update has already succeeded; local cleanup still continues.
    }

    if (typeof window !== "undefined") {
      const cleanUrl = `${window.location.origin}${window.location.pathname}#/login`;
      window.history.replaceState(null, "", cleanUrl);
    }
  }

  destroy() {
    this.subscription?.unsubscribe?.();
    this.subscription = null;
  }
}

export default PasswordRecoveryService;
