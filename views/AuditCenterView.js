/**
 * @fileoverview Centro de Auditoría Operativa de IQBasket.
 * @description Timeline read-only de decisiones de gobernanza para el
 * equipo-temporada activo. No ofrece reparación ni escritura.
 */

import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { Permission } from "../security/PermissionService.js";
import { AuditCenterService, AuditEventType } from "../services/AuditCenterService.js";

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export class AuditCenterView {
  constructor(supabaseClient, authController) {
    this.auth = authController;
    this.service = new AuditCenterService(supabaseClient, DataStore);
    this.state = null;
    this.filterType = "ALL";
    this.search = "";
  }

  t(key, fallback = "") {
    return TranslationStore?.t?.(key, fallback) || fallback;
  }

  _context() {
    const teamId = DataStore.getActiveTeamId?.() || null;
    return {
      teamId,
      teamSeasonId: DataStore.getActiveTeamSeasonId?.(teamId) || null
    };
  }

  _canView() {
    return Boolean(this.auth?.canPreview?.(Permission.VIEW_AUDIT_CENTER, this._context()));
  }

  _typeMeta(type) {
    const map = {
      GAME: { icon: "🏀", label: this.t("audit.type_game", "Partidos"), cls: "audit-blue" },
      SEASON: { icon: "🗄️", label: this.t("audit.type_season", "Temporadas"), cls: "audit-red" },
      TRANSFER: { icon: "🔄", label: this.t("audit.type_transfer", "Traspasos"), cls: "audit-purple" },
      ACCESS: { icon: "🔐", label: this.t("audit.type_access", "Accesos"), cls: "audit-green" }
    };
    return map[type] || { icon: "•", label: type || "Evento", cls: "audit-neutral" };
  }

  _actionLabel(action) {
    const labels = {
      GAME_REQUESTED: ["audit.game_requested", "Cierre de partido solicitado"],
      GAME_REQUEST_APPROVED: ["audit.game_request_approved", "Solicitud de cierre aprobada"],
      GAME_REQUEST_REJECTED: ["audit.game_request_rejected", "Solicitud de cierre rechazada"],
      GAME_LOCKED: ["audit.game_locked", "Partido cerrado"],
      GAME_REOPENED: ["audit.game_reopened", "Partido reabierto"],
      SEASON_REQUESTED: ["audit.season_requested", "Cierre de temporada solicitado"],
      SEASON_REQUEST_APPROVED: ["audit.season_request_approved", "Solicitud de temporada aprobada"],
      SEASON_REQUEST_REJECTED: ["audit.season_request_rejected", "Solicitud de temporada rechazada"],
      SEASON_FROZEN: ["audit.season_frozen", "Temporada cerrada"],
      SEASON_REOPENED: ["audit.season_reopened", "Temporada reabierta"],
      TRANSFER_REQUESTED: ["audit.transfer_requested", "Traspaso solicitado"],
      TRANSFER_SOURCE_APPROVED: ["audit.transfer_source_approved", "Origen aprobó el traspaso"],
      TRANSFER_SOURCE_REJECTED: ["audit.transfer_source_rejected", "Origen rechazó el traspaso"],
      TRANSFER_DESTINATION_APPROVED: ["audit.transfer_destination_approved", "Destino aprobó el traspaso"],
      TRANSFER_DESTINATION_REJECTED: ["audit.transfer_destination_rejected", "Destino rechazó el traspaso"],
      TRANSFER_FINALIZED: ["audit.transfer_finalized", "Traspaso finalizado"],
      TRANSFER_REJECTED: ["audit.transfer_rejected", "Traspaso rechazado"],
      TRANSFER_CANCELLED: ["audit.transfer_cancelled", "Traspaso cancelado"],
      ACCESS_REQUEST_PENDING: ["audit.access_pending", "Solicitud de acceso pendiente"],
      ACCESS_REQUEST_APPROVED: ["audit.access_approved", "Solicitud de acceso aprobada"],
      ACCESS_REQUEST_REJECTED: ["audit.access_rejected", "Solicitud de acceso rechazada"],
      ACCESS_REQUEST_CANCELLED: ["audit.access_cancelled", "Solicitud de acceso cancelada"]
    };
    const entry = labels[action];
    return entry ? this.t(entry[0], entry[1]) : String(action || "Evento").replaceAll("_", " ");
  }

  _formatDate(value) {
    if (!value) return this.t("audit.unknown_date", "Fecha no disponible");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const lang = TranslationStore?.getLanguage?.() || "es";
    const locale = { es: "es-ES", ca: "ca-ES", cat: "ca-ES", en: "en-GB", fr: "fr-FR" }[lang] || "es-ES";
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  _contextHref(item) {
    if (item.type === AuditEventType.GAME && item.gameId) return "#/games/" + item.gameId;
    if (item.type === AuditEventType.ACCESS) return "#/approvals";
    if (item.type === AuditEventType.TRANSFER || item.type === AuditEventType.SEASON) return "#/settings";
    return "#/dashboard";
  }

  _contextLabel(item) {
    if (item.type === AuditEventType.GAME) return this.t("audit.open_game", "Abrir partido");
    if (item.type === AuditEventType.ACCESS) return this.t("audit.open_requests", "Ver solicitudes");
    if (item.type === AuditEventType.TRANSFER) return this.t("audit.open_transfers", "Ver traspasos");
    if (item.type === AuditEventType.SEASON) return this.t("audit.open_seasons", "Ver temporadas");
    return this.t("audit.open_context", "Abrir contexto");
  }

  _filteredEvents() {
    const query = String(this.search || "").trim().toLowerCase();
    return (this.state?.events || []).filter(item => {
      if (this.filterType !== "ALL" && item.type !== this.filterType) return false;
      if (!query) return true;
      const fields = [
        item.title,
        item.subtitle,
        item.reason,
        item.actorName,
        item.actorRole,
        this._actionLabel(item.action)
      ];
      return fields.some(value => String(value || "").toLowerCase().includes(query));
    });
  }

  _summaryHtml() {
    const events = this.state?.events || [];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = events.filter(item => {
      const time = item.occurredAt ? new Date(item.occurredAt).getTime() : 0;
      return time >= weekAgo;
    }).length;
    const closures = events.filter(item => ["GAME_LOCKED", "SEASON_FROZEN"].includes(item.action)).length;
    const reopens = events.filter(item => ["GAME_REOPENED", "SEASON_REOPENED"].includes(item.action)).length;
    const cards = [
      [this.t("audit.kpi_total", "Eventos"), events.length],
      [this.t("audit.kpi_recent", "Últimos 7 días"), recent],
      [this.t("audit.kpi_closures", "Cierres"), closures],
      [this.t("audit.kpi_reopens", "Reaperturas"), reopens]
    ];
    return '<div class="audit-kpis">' + cards.map(card =>
      '<div class="audit-kpi"><div class="audit-kpi-label">' + escapeHtml(card[0]) +
      '</div><div class="audit-kpi-value">' + Number(card[1] || 0) + '</div></div>'
    ).join("") + '</div>';
  }

  _timelineHtml() {
    const events = this._filteredEvents();
    if (events.length === 0) {
      return '<div class="audit-empty"><div class="audit-empty-icon">🧾</div><strong>' +
        escapeHtml(this.t("audit.empty", "No hay eventos para este filtro")) +
        '</strong><span>' +
        escapeHtml(this.t("audit.empty_help", "La auditoría se alimenta automáticamente de los workflows operativos.")) +
        '</span></div>';
    }

    return '<div class="audit-timeline">' + events.map(item => {
      const meta = this._typeMeta(item.type);
      const timestampNote = item.timestampSemantics === "REQUEST_CREATED"
        ? " · " + this.t("audit.request_date_note", "fecha de solicitud")
        : "";
      let reason = "";
      if (item.reason) {
        reason = '<div class="audit-reason"><span>' +
          escapeHtml(this.t("audit.reason", "Motivo / nota")) +
          '</span><p>' + escapeHtml(item.reason) + '</p></div>';
      }
      let actorMeta = '<span>👤 ' + escapeHtml(item.actorName || "Sistema") + '</span>';
      if (item.actorRole) actorMeta += '<span>🏷️ ' + escapeHtml(item.actorRole) + '</span>';
      if (item.effectiveDate) actorMeta += '<span>📅 ' + escapeHtml(item.effectiveDate) + '</span>';

      return '<article class="audit-event">' +
        '<div class="audit-event-marker ' + meta.cls + '">' + meta.icon + '</div>' +
        '<div class="audit-event-card">' +
          '<div class="audit-event-top">' +
            '<div class="audit-event-heading"><span class="audit-type ' + meta.cls + '">' +
              escapeHtml(meta.label) + '</span><strong>' + escapeHtml(this._actionLabel(item.action)) + '</strong></div>' +
            '<time>' + escapeHtml(this._formatDate(item.occurredAt) + timestampNote) + '</time>' +
          '</div>' +
          '<div class="audit-event-title">' + escapeHtml(item.title || "Evento") + '</div>' +
          (item.subtitle ? '<div class="audit-event-subtitle">' + escapeHtml(item.subtitle) + '</div>' : "") +
          '<div class="audit-event-meta">' + actorMeta + '</div>' +
          reason +
          '<div class="audit-event-footer"><span class="audit-source">' +
            escapeHtml(this.t("audit.read_only", "Registro de solo lectura")) +
            '</span><a class="audit-context-link" href="' + this._contextHref(item) + '">' +
            escapeHtml(this._contextLabel(item)) + ' →</a></div>' +
        '</div></article>';
    }).join("") + '</div>';
  }

  _markup() {
    const filters = [
      ["ALL", this.t("audit.filter_all", "Todo")],
      [AuditEventType.GAME, this.t("audit.type_game", "Partidos")],
      [AuditEventType.SEASON, this.t("audit.type_season", "Temporadas")],
      [AuditEventType.TRANSFER, this.t("audit.type_transfer", "Traspasos")],
      [AuditEventType.ACCESS, this.t("audit.type_access", "Accesos")]
    ];
    const filterHtml = filters.map(item =>
      '<button type="button" class="audit-filter ' + (this.filterType === item[0] ? "active" : "") +
      '" data-audit-type="' + item[0] + '">' + escapeHtml(item[1]) + '</button>'
    ).join("");

    const partial = this.state?.partial
      ? '<div class="audit-warning">⚠️ ' +
        escapeHtml(this.t("audit.partial", "La auditoría se ha cargado parcialmente. Alguna fuente no está disponible para este ámbito.")) +
        '</div>'
      : "";

    return '<section class="audit-center">' +
      '<header class="audit-header"><div><div class="audit-eyebrow">🛡️ ' +
      escapeHtml(this.t("audit.eyebrow", "GOBERNANZA & TRAZABILIDAD")) +
      '</div><h1>' + escapeHtml(this.t("audit.title", "Centro de Auditoría")) +
      '</h1><p>' +
      escapeHtml(this.t("audit.subtitle", "Historial operativo del equipo y temporada activos. Los registros proceden de los ledgers seguros del backend y no pueden modificarse desde esta pantalla.")) +
      '</p></div><button type="button" id="btn-audit-refresh" class="audit-refresh">↻ ' +
      escapeHtml(this.t("audit.refresh", "Actualizar")) + '</button></header>' +

      '<div class="audit-scope"><div><span>' + escapeHtml(this.t("audit.scope", "Ámbito")) +
      '</span><strong>' + escapeHtml(this.state?.teamName || "Equipo") +
      '</strong></div><div><span>' + escapeHtml(this.t("season", "Temporada")) +
      '</span><strong>' + escapeHtml(this.state?.seasonName || "—") +
      '</strong></div><div class="audit-integrity"><b>✓</b>' +
      escapeHtml(this.t("audit.integrity", "Vista read-only · RLS activo")) + '</div></div>' +

      this._summaryHtml() + partial +
      '<div class="audit-toolbar"><div class="audit-filters">' + filterHtml +
      '</div><label class="audit-search"><span>⌕</span><input id="audit-search-input" type="search" value="' +
      escapeHtml(this.search) + '" placeholder="' +
      escapeHtml(this.t("audit.search", "Buscar persona, motivo o evento...")) +
      '"></label></div><div id="audit-timeline-container">' + this._timelineHtml() + '</div></section>' +
      this._styles();
  }

  _styles() {
    return '<style>' +
      '.audit-center{max-width:1200px;margin:0 auto;padding:0 0 28px;color:#0f172a;font-family:system-ui,-apple-system,sans-serif}' +
      '.audit-header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap}' +
      '.audit-eyebrow{font-size:10px;font-weight:900;letter-spacing:.08em;color:#475569;margin-bottom:5px}.audit-header h1{font-size:26px;margin:0}.audit-header p{max-width:760px;margin:8px 0 0;font-size:12px;line-height:1.55;color:#64748b}' +
      '.audit-refresh{min-height:44px;padding:9px 14px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a;font-weight:800;cursor:pointer}' +
      '.audit-scope{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;background:#0f172a;color:#fff;padding:12px 14px;border-radius:12px;margin-bottom:14px;align-items:center}.audit-scope>div:not(.audit-integrity){display:flex;flex-direction:column;gap:2px;min-width:0}.audit-scope span{font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase}.audit-scope strong{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.audit-integrity{display:flex;gap:6px;align-items:center;font-size:10px;font-weight:800;color:#bbf7d0}.audit-integrity b{color:#22c55e;font-size:14px}' +
      '.audit-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.audit-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:11px;padding:11px 12px}.audit-kpi-label{font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase}.audit-kpi-value{font-size:22px;font-weight:950;margin-top:2px}' +
      '.audit-warning{padding:10px 12px;border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:10px;font-size:11px;margin-bottom:12px}' +
      '.audit-toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap}.audit-filters{display:flex;gap:6px;flex-wrap:wrap}.audit-filter{min-height:40px;padding:7px 11px;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#475569;font-size:11px;font-weight:800;cursor:pointer}.audit-filter.active{background:#0f172a;color:#fff;border-color:#0f172a}.audit-search{display:flex;align-items:center;gap:6px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:0 10px;min-height:42px;min-width:min(320px,100%)}.audit-search input{border:0;outline:0;background:transparent;width:100%;font-size:12px;min-height:40px}' +
      '.audit-event{display:grid;grid-template-columns:42px 1fr;gap:10px;position:relative;padding-bottom:12px}.audit-event:not(:last-child)::before{content:"";position:absolute;left:20px;top:38px;bottom:-2px;width:2px;background:#e2e8f0}.audit-event-marker{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;z-index:1;border:4px solid #f8fafc}.audit-event-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;min-width:0}.audit-event-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.audit-event-heading{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.audit-event-heading strong{font-size:12px}.audit-type{font-size:9px;font-weight:900;padding:3px 7px;border-radius:999px;text-transform:uppercase}.audit-event-top time{font-size:10px;color:#64748b;font-weight:700}.audit-event-title{font-size:14px;font-weight:900;margin-top:8px}.audit-event-subtitle{font-size:11px;color:#64748b;margin-top:2px}.audit-event-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:10px;color:#475569;font-weight:700}' +
      '.audit-blue{background:#eff6ff;color:#1d4ed8}.audit-red{background:#fff1f2;color:#9f1239}.audit-purple{background:#f5f3ff;color:#6d28d9}.audit-green{background:#f0fdf4;color:#166534}.audit-neutral{background:#f8fafc;color:#334155}' +
      '.audit-reason{margin-top:9px;padding:8px 10px;background:#f8fafc;border-radius:8px;border-left:3px solid #cbd5e1}.audit-reason span{font-size:9px;text-transform:uppercase;color:#64748b;font-weight:900}.audit-reason p{font-size:11px;color:#334155;margin:3px 0 0;line-height:1.45}.audit-event-footer{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:10px;padding-top:9px;border-top:1px solid #f1f5f9}.audit-source{font-size:9px;color:#94a3b8;font-weight:800}.audit-context-link{font-size:10px;color:#1d4ed8;font-weight:900;text-decoration:none;min-height:32px;display:inline-flex;align-items:center}' +
      '.audit-empty{padding:44px 18px;border:1px dashed #cbd5e1;border-radius:14px;text-align:center;background:#fff;display:flex;flex-direction:column;gap:5px;color:#64748b}.audit-empty strong{font-size:13px;color:#334155}.audit-empty span{font-size:11px}.audit-empty-icon{font-size:28px}' +
      '@media(max-width:640px){.audit-header h1{font-size:22px}.audit-refresh{width:100%}.audit-scope{grid-template-columns:1fr 1fr}.audit-integrity{grid-column:1/-1}.audit-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.audit-toolbar{align-items:stretch}.audit-filters{width:100%}.audit-filter{flex:1;min-width:92px;min-height:44px}.audit-search{width:100%;min-width:0}.audit-event{grid-template-columns:34px 1fr;gap:7px}.audit-event-marker{width:34px;height:34px;font-size:14px}.audit-event:not(:last-child)::before{left:16px;top:32px}.audit-event-card{padding:11px}.audit-event-footer{align-items:flex-start;flex-direction:column}.audit-context-link{min-height:40px}}' +
      '</style>';
  }

  _bind(container) {
    container.querySelector("#btn-audit-refresh")?.addEventListener("click", async event => {
      event.currentTarget.disabled = true;
      await this.render(container.id || "dashboard-content-area", true);
    });

    container.querySelectorAll(".audit-filter").forEach(button => {
      button.addEventListener("click", () => {
        this.filterType = button.dataset.auditType || "ALL";
        container.querySelectorAll(".audit-filter").forEach(item => {
          item.classList.toggle("active", item === button);
        });
        const timeline = container.querySelector("#audit-timeline-container");
        if (timeline) timeline.innerHTML = this._timelineHtml();
      });
    });

    container.querySelector("#audit-search-input")?.addEventListener("input", event => {
      this.search = event.target.value || "";
      const timeline = container.querySelector("#audit-timeline-container");
      if (timeline) timeline.innerHTML = this._timelineHtml();
    });
  }

  async render(containerId = "dashboard-content-area", force = false) {
    const container = document.getElementById(containerId)
      || document.getElementById("main-content")
      || document.body;
    if (!container) return;

    if (!this._canView()) {
      container.innerHTML = '<div class="read-only-banner" style="max-width:760px;margin:20px auto;">🔒 ' +
        escapeHtml(this.t("audit.restricted", "Tu perfil no puede consultar la auditoría operativa.")) +
        '</div>';
      return;
    }

    if (!this.state || force) {
      container.innerHTML = '<div style="padding:28px;text-align:center;color:#64748b;font-size:12px;">⏳ ' +
        escapeHtml(this.t("audit.loading", "Cargando auditoría operativa...")) + '</div>';
      this.state = await this.service.load(this._context());
    }

    container.innerHTML = this._markup();
    this._bind(container);
  }
}

export default AuditCenterView;
