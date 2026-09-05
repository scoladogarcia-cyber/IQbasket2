/**
 * @fileoverview Bootstrap resiliente del flujo de recuperación de contraseña.
 * @description Usa delegación global de eventos para sobrevivir a cualquier
 * rerender del login y mantener el módulo pesado en carga diferida.
 */

const BOOTSTRAP_KEY = Symbol.for("iqbasket.passwordRecoveryBootstrap");

if (!globalThis[BOOTSTRAP_KEY]) {
  globalThis[BOOTSTRAP_KEY] = true;

  document.addEventListener("click", async (event) => {
    const origin = event.target;
    const button = origin instanceof Element
      ? origin.closest("#btn-forgot-password")
      : null;
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    if (button.dataset.loading === "true") return;

    button.dataset.loading = "true";
    button.setAttribute("aria-busy", "true");
    const email = document.getElementById("login-email")?.value?.trim() || "";

    try {
      const { PasswordRecoveryCoordinator } = await import("./PasswordRecoveryCoordinator.js");
      await new PasswordRecoveryCoordinator().openRequest({ email });
    } catch (error) {
      console.error("[AUTH] No se pudo abrir la recuperación de contraseña:", error);
      alert("No se pudo abrir la recuperación de contraseña. Actualiza la página e inténtalo de nuevo.");
    } finally {
      if (button.isConnected) {
        delete button.dataset.loading;
        button.removeAttribute("aria-busy");
      }
    }
  });
}
