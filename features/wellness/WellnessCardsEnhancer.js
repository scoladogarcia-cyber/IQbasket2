/**
 * @fileoverview Progressive tactile cards for Player360 Wellness check-ins.
 * @description Enhances the existing WellnessSupportPanel DOM without owning
 * authorization, persistence, metric definitions or recommendation logic.
 * WellnessService + backend ABAC remain authoritative.
 */

const EDITOR_SELECTOR = ".p360w-editor";
const METRIC_SELECTOR = ".p360w-metric";
const INPUT_SELECTOR = ".p360w-input";
const ENHANCED_ATTR = "data-wellness-cards-enhanced";

function safeVibrate(pattern = 10) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    // Haptics are optional and must never block a check-in.
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

function metricCode(input) {
  return String(input?.dataset?.metricCode || "").trim().toUpperCase();
}

function isCompactScale(input) {
  if (!(input instanceof HTMLSelectElement)) return false;
  if (String(input.dataset.valueType || "").toUpperCase() !== "SCALE") return false;
  const values = [...input.options]
    .map(option => option.value)
    .filter(value => value !== "")
    .map(Number)
    .filter(Number.isFinite);
  return values.length >= 2 && values.length <= 7;
}

function optionLabel(input, option) {
  const type = String(input.dataset.valueType || "").toUpperCase();
  if (type === "BOOLEAN") {
    if (option.value === "true") return "Sí";
    if (option.value === "false") return "No";
  }
  return String(option.textContent || option.value).trim();
}

function dispatchValueChange(input) {
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function syncOptionButtons(metric, input) {
  const selected = String(input.value ?? "");
  metric.querySelectorAll("[data-wellness-card-value]").forEach(button => {
    const active = String(button.dataset.wellnessCardValue ?? "") === selected;
    button.classList.toggle("wellness-card-option-selected", active);
    button.setAttribute("aria-checked", String(active));
    button.setAttribute("aria-pressed", String(active));
  });
}

function addOptionCards(metric, input) {
  if (!(input instanceof HTMLSelectElement)) return false;
  const type = String(input.dataset.valueType || "").toUpperCase();
  if (!["BOOLEAN", "CHOICE", "SCALE"].includes(type)) return false;
  if (type === "SCALE" && !isCompactScale(input)) return false;

  const options = [...input.options].filter(option => option.value !== "");
  if (!options.length) return false;

  const group = document.createElement("div");
  group.className = `wellness-card-options wellness-card-options-${type.toLowerCase()}`;
  group.setAttribute("role", "radiogroup");
  group.setAttribute(
    "aria-label",
    metric.querySelector(".p360w-metric-name")?.textContent?.trim() || "Selecciona un valor"
  );

  options.forEach(option => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wellness-card-option";
    button.dataset.wellnessCardValue = option.value;
    button.setAttribute("role", "radio");
    button.innerHTML = `<strong>${escapeHtml(optionLabel(input, option))}</strong>`;
    button.addEventListener("click", () => {
      input.value = option.value;
      safeVibrate(10);
      syncOptionButtons(metric, input);
      dispatchValueChange(input);
      updateProgress(metric.closest(EDITOR_SELECTOR));
    });
    group.appendChild(button);
  });

  input.classList.add("wellness-card-source");
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;
  input.insertAdjacentElement("afterend", group);
  syncOptionButtons(metric, input);
  return true;
}

function addSleepQuickChoices(metric, input) {
  if (!(input instanceof HTMLInputElement)) return false;
  if (metricCode(input) !== "SLEEP_DURATION_HOURS") return false;

  const group = document.createElement("div");
  group.className = "wellness-card-quick-values";
  group.setAttribute("aria-label", "Horas de sueño rápidas");

  [6, 7, 8, 9].forEach(value => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wellness-card-quick-value";
    button.dataset.wellnessQuickValue = String(value);
    button.textContent = `${value} h`;
    button.addEventListener("click", () => {
      input.value = String(value);
      safeVibrate(8);
      dispatchValueChange(input);
      syncQuickChoices(metric, input);
      updateProgress(metric.closest(EDITOR_SELECTOR));
    });
    group.appendChild(button);
  });

  input.insertAdjacentElement("afterend", group);
  input.addEventListener("input", () => {
    syncQuickChoices(metric, input);
    updateProgress(metric.closest(EDITOR_SELECTOR));
  });
  syncQuickChoices(metric, input);
  return true;
}

function syncQuickChoices(metric, input) {
  const current = Number(input.value);
  metric.querySelectorAll("[data-wellness-quick-value]").forEach(button => {
    const active = Number(button.dataset.wellnessQuickValue) === current;
    button.classList.toggle("wellness-card-option-selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function ensureProgress(editor) {
  if (!editor) return null;
  let progress = editor.querySelector("[data-wellness-checkin-progress]");
  if (progress) return progress;

  progress = document.createElement("div");
  progress.className = "wellness-checkin-progress";
  progress.dataset.wellnessCheckinProgress = "true";
  progress.setAttribute("role", "status");
  progress.setAttribute("aria-live", "polite");

  const head = editor.querySelector(".p360w-head");
  if (head) head.insertAdjacentElement("afterend", progress);
  else editor.prepend(progress);
  return progress;
}

function updateProgress(editor) {
  if (!editor) return;
  const inputs = [...editor.querySelectorAll(INPUT_SELECTOR)];
  if (!inputs.length) return;
  const answered = inputs.filter(input => String(input.value ?? "").trim() !== "").length;
  const progress = ensureProgress(editor);
  if (!progress) return;
  progress.innerHTML = `
    <span><strong>Check-in express</strong> · ${answered}/${inputs.length} respondidas</span>
    <span class="wellness-checkin-time">≈ 30 s · puedes dejar métricas sin responder</span>
  `;
  progress.dataset.complete = String(answered === inputs.length);
}

function enhanceMetric(metric) {
  if (!metric || metric.getAttribute(ENHANCED_ATTR) === "true") return;
  const input = metric.querySelector(INPUT_SELECTOR);
  if (!input) return;

  metric.setAttribute(ENHANCED_ATTR, "true");
  metric.classList.add("wellness-card-metric");

  const cardsAdded = addOptionCards(metric, input);
  if (!cardsAdded) addSleepQuickChoices(metric, input);

  input.addEventListener("change", () => {
    syncOptionButtons(metric, input);
    syncQuickChoices(metric, input);
    updateProgress(metric.closest(EDITOR_SELECTOR));
  });
}

function enhanceEditor(editor) {
  if (!editor?.isConnected) return;
  editor.classList.add("wellness-cards-v1");
  editor.querySelectorAll(METRIC_SELECTOR).forEach(enhanceMetric);
  updateProgress(editor);
}

function enhanceAllWellnessEditors() {
  document.querySelectorAll(EDITOR_SELECTOR).forEach(enhanceEditor);
}

if (typeof document !== "undefined") {
  const start = () => {
    enhanceAllWellnessEditors();
    const observer = new MutationObserver(() => enhanceAllWellnessEditors());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}

export { enhanceEditor, enhanceAllWellnessEditors };
