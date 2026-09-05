/**
 * @fileoverview Progressive Match Capture UX V2 enhancer.
 * @description Improves the existing EasyStatsEntryView without owning game
 * persistence, permissions or statistical calculations. The underlying view
 * remains the single source of truth for data and authorization.
 */

const ROOT_SELECTOR = ".easy-entry-wrapper";
const STATUS_SELECTOR = "[data-match-capture-status]";
const FLOATING_UNDO_SELECTOR = "[data-match-capture-floating-undo]";
const MODE_PREFERENCE_KEY = "iqbasket.matchCapture.mode";

function canVibrate() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

function vibrate(pattern = 12) {
  try {
    if (canVibrate()) navigator.vibrate(pattern);
  } catch {
    // Haptics are an optional enhancement and must never block capture.
  }
}

function selectedPlayerButton(root) {
  return [...root.querySelectorAll(".player-card-btn")]
    .find(button => button.classList.contains("active-player") || button.getAttribute("aria-pressed") === "true") || null;
}

function selectedPlayerName(root) {
  const selected = selectedPlayerButton(root);
  if (!selected) return "";
  return String(selected.getAttribute("data-player-name") || selected.textContent || "").trim();
}

function isFastMode(root) {
  return Boolean(root.querySelector('.mode-selector-btn[data-mode="rapido"].active-mode'));
}

function currentMode(root) {
  const active = root.querySelector(".mode-selector-btn.active-mode");
  return active?.getAttribute("data-mode") || "";
}

function ensureSemanticClasses(root) {
  root.classList.add("match-capture-v2");

  const playerCards = root.querySelectorAll(".player-card-btn");
  if (playerCards.length) {
    const playerGrid = playerCards[0].parentElement;
    playerGrid?.classList.add("match-capture-player-grid");
    playerGrid?.parentElement?.classList.add("match-capture-player-panel");
  }

  root.querySelectorAll(".action-btn").forEach(button => {
    const grid = button.parentElement;
    if (!grid) return;
    grid.classList.add("match-capture-action-grid");
    const count = grid.querySelectorAll(":scope > .action-btn").length;
    grid.dataset.actionCount = String(count);
    grid.parentElement?.classList.add("match-capture-action-group");
  });

  const modeButtons = root.querySelectorAll(".mode-selector-btn");
  if (modeButtons.length) modeButtons[0].parentElement?.classList.add("match-capture-mode-switcher");

  const actionButtons = root.querySelectorAll(".action-btn");
  if (actionButtons.length) {
    let node = actionButtons[0].parentElement;
    while (node && node !== root) {
      if (node.tagName === "SECTION") {
        node.classList.add("match-capture-action-panel");
        break;
      }
      node = node.parentElement;
    }
  }
}

function ensureStatus(root) {
  let status = root.querySelector(STATUS_SELECTOR);
  if (status) return status;

  status = document.createElement("div");
  status.className = "match-capture-status";
  status.dataset.matchCaptureStatus = "true";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const main = root.querySelector("#entry-main-content");
  if (main?.parentElement) main.parentElement.insertBefore(status, main);
  else root.prepend(status);

  return status;
}

function ensureFloatingUndo(root) {
  let button = root.querySelector(FLOATING_UNDO_SELECTOR);
  if (button) return button;

  button = document.createElement("button");
  button.type = "button";
  button.className = "match-capture-floating-undo";
  button.dataset.matchCaptureFloatingUndo = "true";
  button.setAttribute("aria-label", "Deshacer última acción");
  button.innerHTML = '<span aria-hidden="true">↩</span><span>Deshacer</span>';
  button.addEventListener("click", () => {
    const source = root.querySelector("#btn-undo");
    if (!source || source.disabled) return;
    vibrate([10, 20, 10]);
    source.click();
  });
  root.appendChild(button);
  return button;
}

function syncUndoState(root) {
  const floating = ensureFloatingUndo(root);
  const source = root.querySelector("#btn-undo");
  const count = Number(root.querySelector("#action-count")?.textContent || 0);
  const disabled = !source || source.disabled || count <= 0;
  floating.disabled = disabled;
  floating.setAttribute("aria-disabled", String(disabled));
}

function syncPlayerSelection(root) {
  const selected = selectedPlayerButton(root);
  root.querySelectorAll(".player-card-btn").forEach(button => {
    const active = button === selected;
    button.setAttribute("aria-pressed", String(active));
    if (active) button.classList.add("match-capture-player-selected");
    else button.classList.remove("match-capture-player-selected");
  });

  const name = selectedPlayerName(root);
  root.querySelectorAll(".action-btn").forEach(button => {
    if (isFastMode(root)) {
      button.disabled = !name;
      button.setAttribute("aria-disabled", String(!name));
    } else {
      button.disabled = false;
      button.removeAttribute("aria-disabled");
    }
    const actionLabel = String(button.textContent || "Acción").trim();
    button.setAttribute("aria-label", name ? `${actionLabel} · ${name}` : `${actionLabel} · selecciona primero un jugador`);
  });

  const status = ensureStatus(root);
  if (!isFastMode(root)) {
    status.innerHTML = '<strong>Captura de partido</strong><span>Elige el modo que mejor encaje con la tarea.</span>';
    status.dataset.step = "mode";
    return;
  }

  if (!name) {
    status.innerHTML = '<strong>1 · Elige jugador</strong><span>Después podrás registrar la acción con un solo toque.</span>';
    status.dataset.step = "player";
  } else {
    status.innerHTML = `<strong>2 · Registra acción</strong><span>${escapeHtml(name)} seleccionado.</span>`;
    status.dataset.step = "action";
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function storeModePreference(mode) {
  if (!mode) return;
  try {
    sessionStorage.setItem(MODE_PREFERENCE_KEY, mode);
  } catch {
    // Session persistence is helpful but never required for capture.
  }
}

function readModePreference() {
  try {
    return sessionStorage.getItem(MODE_PREFERENCE_KEY) || "";
  } catch {
    return "";
  }
}

function applyMobileModePreference(root) {
  if (typeof matchMedia !== "function") return;
  if (!matchMedia("(max-width: 768px)").matches) return;

  const preference = readModePreference();
  if (!preference) return;
  const active = currentMode(root);
  if (active === preference) return;
  const target = root.querySelector(`.mode-selector-btn[data-mode="${CSS.escape(preference)}"]`);
  target?.click();
}

function bindInteractions(root) {
  if (root.dataset.matchCaptureBound === "true") return;
  root.dataset.matchCaptureBound = "true";

  root.addEventListener("click", event => {
    const player = event.target.closest?.(".player-card-btn");
    if (player && root.contains(player)) {
      vibrate(10);
      queueMicrotask(() => syncPlayerSelection(root));
      return;
    }

    const action = event.target.closest?.(".action-btn");
    if (action && root.contains(action) && !action.disabled) {
      vibrate(14);
      queueMicrotask(() => {
        syncUndoState(root);
        syncPlayerSelection(root);
      });
      return;
    }

    const mode = event.target.closest?.(".mode-selector-btn");
    if (mode && root.contains(mode)) {
      storeModePreference(mode.getAttribute("data-mode"));
      queueMicrotask(() => enhanceRoot(root));
    }
  });
}

function enhanceRoot(root) {
  if (!root?.isConnected) return;
  ensureSemanticClasses(root);
  ensureStatus(root);
  ensureFloatingUndo(root);
  bindInteractions(root);
  syncPlayerSelection(root);
  syncUndoState(root);
  applyMobileModePreference(root);
}

function enhanceAll() {
  document.querySelectorAll(ROOT_SELECTOR).forEach(enhanceRoot);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhanceAll, { once: true });
  } else {
    enhanceAll();
  }

  const observer = new MutationObserver(() => enhanceAll());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

export { enhanceRoot, enhanceAll, MODE_PREFERENCE_KEY };
