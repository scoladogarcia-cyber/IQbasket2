/**
 * @fileoverview Non-blocking connectivity/sync status for live game capture.
 * @description Listens to the offline outbox event contract; it never changes
 * persistence or permissions.
 */

const BADGE_ATTR = "data-game-sync-badge";
let hideTimer = null;
let lastDetail = null;

function label(detail = {}) {
  switch (detail.status) {
    case "OFFLINE": return { icon:"●", text:"Sin conexión · guardado local", tone:"offline" };
    case "PENDING": return { icon:"↻", text:"Pendiente de sincronizar", tone:"pending" };
    case "SYNCING": return { icon:"↻", text:"Sincronizando…", tone:"syncing" };
    case "FAILED": return { icon:"!", text:"Revisa la sincronización", tone:"failed" };
    case "SYNCED": return { icon:"✓", text:"Sincronizado", tone:"synced" };
    default: return { icon:"", text:"", tone:"" };
  }
}

function ensureBadge(root) {
  let badge = root.querySelector(`[${BADGE_ATTR}]`);
  if (badge) return badge;
  badge = document.createElement("div");
  badge.setAttribute(BADGE_ATTR, "true");
  badge.className = "game-sync-badge";
  badge.setAttribute("role", "status");
  badge.setAttribute("aria-live", "polite");
  const header = root.querySelector("header");
  if (header) header.appendChild(badge);
  else root.prepend(badge);
  return badge;
}

function render(detail = lastDetail) {
  if (!detail) return;
  document.querySelectorAll(".easy-entry-wrapper").forEach(root => {
    const badge = ensureBadge(root);
    const state = label(detail);
    badge.dataset.tone = state.tone;
    badge.innerHTML = `<span aria-hidden="true">${state.icon}</span><strong>${state.text}</strong>`;
    badge.hidden = !state.text;
  });

  clearTimeout(hideTimer);
  if (detail.status === "SYNCED") {
    hideTimer = setTimeout(() => {
      document.querySelectorAll(`[${BADGE_ATTR}]`).forEach(badge => { badge.hidden = true; });
    }, 2200);
  }
}

function connectivityDetail() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { status:"OFFLINE", pending:true };
  }
  return lastDetail;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("iqbasket:game-sync-status", event => {
    lastDetail = event.detail || null;
    render(lastDetail);
  });
  window.addEventListener("offline", () => {
    lastDetail = { status:"OFFLINE", pending:true };
    render(lastDetail);
  });
  window.addEventListener("online", () => render(lastDetail || { status:"PENDING", pending:true }));

  const start = () => {
    if (connectivityDetail()) render(connectivityDetail());
    const observer = new MutationObserver(() => {
      if (connectivityDetail()) render(connectivityDetail());
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
}

export { render as renderOfflineSyncStatus };
