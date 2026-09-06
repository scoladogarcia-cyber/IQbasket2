/**
 * @fileoverview Bandeja central de solicitudes y aprobaciones.
 * @description UI responsive que consume ApprovalCenterService y mantiene
 * las escrituras en los servicios de dominio existentes.
 */

import { DataStore } from "../services/DataStore.js";
import { ApprovalCenterService, RequestType } from "../services/ApprovalCenterService.js";
import { Permission } from "../security/PermissionService.js";
import { TranslationStore } from "../services/TranslationStore.js";

export class ApprovalCenterView {
  constructor(supabase, authController) {
    this.supabase = supabase || null;
    this.auth = authController || null;
    this.service = new ApprovalCenterService(this.supabase, this.auth, DataStore);
    this.state = {
      items: [],
      errors: [],
      pendingCount: 0,
      resolvedCount: 0
    };
    this.filter = "PENDING";
    this.container = null;
    this.isLoading = false;
  }

  t(key, fallback = "", params = {}) {
    let text = TranslationStore?.t?.(key, fallback) || fallback || key;
    Object.entries(params || {}).forEach(([name, value]) => {
      text = String(text).replaceAll(`{${name}}`, String(value ?? ""));
    });
    return text;
  }

  _escape(value = "") {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _statusMeta(status = "") {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "PENDING") {
      return { label: this.t("approvals.status_pending", "Pendiente"), icon: "⏳", bg: "#fef3c7", fg: "#92400e", border: "#fde68a" };
    }
    if (normalized === "APPROVED") {
      return { label: this.t("approvals.status_approved", "Aprobada"), icon: "✓", bg: "#dcfce7", fg: "#166534", border: "#86efac" };
    }
    if (normalized === "RETURNED") {
      return { label: "Necesita cambios", icon: "↩", bg: "#ffedd5", fg: "#9a3412", border: "#fdba74" };
    }
    if (normalized === "REJECTED") {
      return { label: this.t("approvals.status_rejected", "Rechazada"), icon: "×", bg: "#fee2e2", fg: "#991b1b", border: "#fca5a5" };
    }
    if (normalized === "CANCELLED") {
      return { label: this.t("approvals.status_cancelled", "Cancelada"), icon: "—", bg: "#f1f5f9", fg: "#475569", border: "#cbd5e1" };
    }
    return { label: normalized || "Estado", icon: "•", bg: "#f1f5f9", fg: "#475569", border: "#cbd5e1" };
  }

  _typeMeta(type) {
    if (type === RequestType.GAME_LOCK) {
      return { label: this.t("approvals.type_game_lock", "Cierre de partido"), icon: "🔒", bg: "#fff7ed", fg: "#9a3412" };
    }
    if (type === RequestType.TRANSFER) {
      return { label: this.t("approvals.type_transfer", "Traspaso"), icon: "🔄", bg: "#f5f3ff", fg: "#6d28d9" };
    }
    if (type === RequestType.PLAYER_DATA_SUBMISSION) {
      return { label: "Aportación del jugador", icon: "📝", bg: "#eff6ff", fg: "#1d4ed8" };
    }
    if (type === RequestType.TEAM_SEASON_FREEZE) {
      return { label: this.t("approvals.type_season_freeze", "Cierre de temporada"), icon: "🗄️", bg: "#fff1f2", fg: "#9f1239" };
    }
    return { label: this.t("approvals.type_team_access", "Acceso a equipo"), icon: "👥", bg: "#eff6ff", fg: "#1d4ed8" };
  }

  _itemTitle(item) {
    if (item.type === RequestType.TRANSFER) {
      return this.t("approvals.transfer_title", "Traspaso · {player}", {
        player: item.playerName || item.title || "Jugador"
      });
    }
    if (item.type === RequestType.GAME_LOCK) {
      return this.t("approvals.game_title", "Cerrar partido vs {opponent}", {
        opponent: item.opponent || item.title || "Rival"
      });
    }
    if (item.type === RequestType.PLAYER_DATA_SUBMISSION) return item.title || "Aportación del jugador";
    if (item.type === RequestType.TEAM_SEASON_FREEZE) {
      return this.t("approvals.season_freeze_title", "Cerrar temporada · {team}", {
        team: item.teamName || item.title || "Equipo"
      });
    }
    return item.title || item.actor || this.t("approvals.type_team_access", "Acceso a equipo");
  }

  _itemSubtitle(item) {
    if (item.type === RequestType.TRANSFER) {
      return this.t("approvals.transfer_route", "{origin} → {destination}", {
        origin: item.originTeamName || "Equipo origen",
        destination: item.targetTeamName || "Equipo destino"
      });
    }
    if (item.type === RequestType.GAME_LOCK) {
      return [item.gameDate || "", item.requestedRole || ""].filter(Boolean).join(" · ");
    }
    if (item.type === RequestType.PLAYER_DATA_SUBMISSION) return item.subtitle || "";
    if (item.type === RequestType.TEAM_SEASON_FREEZE) {
      return [item.seasonName || "", item.requestedRole || ""].filter(Boolean).join(" · ");
    }
    return this.t("approvals.access_subtitle", "Acceso a {team} como {role}", {
      team: item.teamName || "equipo",
      role: item.requestedRole || "VISOR"
    });
  }

  _shiftIsoDate(value, days = 0) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return "";
    const [year, month, day] = String(value).split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return date.toISOString().slice(0, 10);
  }

  _transferReviewMeta(decision = "PENDING") {
    const normalized = String(decision || "PENDING").toUpperCase();
    if (normalized === "APPROVED") {
      return { icon: "✓", label: this.t("approvals.transfer_approved", "Aprobado"), bg: "#dcfce7", fg: "#166534" };
    }
    if (normalized === "REJECTED") {
      return { icon: "×", label: this.t("approvals.transfer_rejected", "Rechazado"), bg: "#fee2e2", fg: "#991b1b" };
    }
    return { icon: "⏳", label: this.t("approvals.transfer_pending", "Pendiente"), bg: "#fef3c7", fg: "#92400e" };
  }

  _formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  _visibleItems() {
    if (this.filter === "ALL") return this.state.items || [];
    if (this.filter === "RESOLVED") {
      return (this.state.items || []).filter(item => item.status !== "PENDING");
    }
    return (this.state.items || []).filter(item => item.status === "PENDING");
  }

  async render(containerId = "dashboard-content-area") {
    const container = typeof containerId === "string"
      ? document.getElementById(containerId)
      : containerId;
    if (!container) return;

    this.container = container;

    if (!this.auth?.canPreview?.(Permission.VIEW_APPROVAL_CENTER)) {
      container.innerHTML = `
        <div style="padding:24px;background:#ffffff;border:1px solid #fecaca;border-radius:12px;color:#991b1b;">
          <h2 style="margin:0 0 8px;font-size:18px;">🔒 ${this.t("approvals.restricted", "Acceso restringido")}</h2>
          <p style="margin:0;">${this.t("approvals.restricted_body", "Tu perfil no puede consultar la Bandeja de Solicitudes.")}</p>
        </div>
      `;
      return;
    }

    await this._loadAndRender();
  }

  async _loadAndRender() {
    if (!this.container || this.isLoading) return;
    this.isLoading = true;
    this.container.innerHTML = `
      <div style="max-width:1180px;margin:0 auto;padding:4px 0 80px;">
        <div style="padding:28px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;text-align:center;color:#475569;">
          <div style="font-size:28px;margin-bottom:8px;">⏳</div>
          <strong>${this.t("approvals.loading", "Cargando solicitudes...")}</strong>
        </div>
      </div>
    `;

    try {
      this.state = await this.service.load();
    } catch (error) {
      console.error("[ApprovalCenterView] Error cargando bandeja:", error);
      this.state = {
        items: [],
        errors: [{ source: "CENTER", message: error?.message || String(error) }],
        pendingCount: 0,
        resolvedCount: 0
      };
    } finally {
      this.isLoading = false;
    }

    this._renderState();
  }

  _renderState() {
    if (!this.container) return;
    const visibleItems = this._visibleItems();
    const total = (this.state.items || []).length;
    const pending = Number(this.state.pendingCount || 0);
    const resolved = Number(this.state.resolvedCount || 0);

    const warningMarkup = (this.state.errors || []).length > 0
      ? `
        <div style="margin-bottom:14px;padding:12px 14px;border-radius:10px;background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-size:12px;">
          ⚠️ ${this.t("approvals.partial", "La bandeja se ha cargado parcialmente.")} ${this._escape((this.state.errors || []).map(error => error.message).join(" · "))}
        </div>
      `
      : "";

    const cardsMarkup = visibleItems.length > 0
      ? visibleItems.map(item => this._renderItem(item)).join("")
      : this._renderEmptyState();

    this.container.innerHTML = `
      <section style="max-width:1180px;margin:0 auto;padding:4px 0 90px;font-family:system-ui,-apple-system,sans-serif;">
        <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px;">
          <div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <h1 style="margin:0;color:#0f172a;font-size:24px;font-weight:900;">📥 ${this.t("approvals.title", "Bandeja de Solicitudes")}</h1>
              ${pending > 0 ? `<span style="padding:4px 9px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:900;">${pending} ${this.t("approvals.pending", "Pendientes").toLowerCase()}</span>` : ""}
            </div>
            <p style="margin:6px 0 0;color:#64748b;font-size:13px;line-height:1.45;max-width:720px;">
${this.t("approvals.subtitle", "Centraliza accesos, cierres y traspasos, mostrando sólo las acciones permitidas por tu rol y contexto.")}
            </p>
          </div>
          <button type="button" id="btn-refresh-approval-center"
                  style="min-height:44px;padding:9px 14px;border-radius:9px;border:1px solid #cbd5e1;background:#ffffff;color:#0f172a;font-weight:800;cursor:pointer;">
            ↻ ${this.t("approvals.refresh", "Actualizar")}
          </button>
        </header>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px;">
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:13px;">
            <div style="font-size:11px;color:#64748b;font-weight:800;text-transform:uppercase;">${this.t("approvals.total", "Total")}</div>
            <div style="font-size:24px;color:#0f172a;font-weight:900;margin-top:3px;">${total}</div>
          </div>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:13px;">
            <div style="font-size:11px;color:#92400e;font-weight:800;text-transform:uppercase;">${this.t("approvals.pending", "Pendientes")}</div>
            <div style="font-size:24px;color:#78350f;font-weight:900;margin-top:3px;">${pending}</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:13px;">
            <div style="font-size:11px;color:#64748b;font-weight:800;text-transform:uppercase;">${this.t("approvals.resolved", "Resueltas")}</div>
            <div style="font-size:24px;color:#334155;font-weight:900;margin-top:3px;">${resolved}</div>
          </div>
        </div>

        ${warningMarkup}

        <div role="tablist" aria-label="Filtrar solicitudes" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
          ${this._renderFilterButton("PENDING", `${this.t("approvals.pending", "Pendientes")} (${pending})`)}
          ${this._renderFilterButton("RESOLVED", `${this.t("approvals.history", "Historial")} (${resolved})`)}
          ${this._renderFilterButton("ALL", `${this.t("approvals.all", "Todas")} (${total})`)}
        </div>

        <div id="approval-center-list" style="display:grid;gap:10px;">
          ${cardsMarkup}
        </div>
      </section>
    `;

    this._bindEvents();
  }

  _renderFilterButton(filter, label) {
    const active = this.filter === filter;
    return `
      <button type="button" class="approval-filter" data-filter="${filter}"
              role="tab" aria-selected="${active}"
              style="min-height:44px;padding:8px 14px;border-radius:999px;border:1px solid ${active ? "#1e3a8a" : "#cbd5e1"};background:${active ? "#1e3a8a" : "#ffffff"};color:${active ? "#ffffff" : "#334155"};font-weight:800;cursor:pointer;">
        ${label}
      </button>
    `;
  }

  _renderTransferSide(item, side) {
    const isSource = side === "SOURCE";
    const decision = isSource ? item.sourceDecision : item.destinationDecision;
    const approvedDate = isSource ? item.sourceDate : item.destinationDate;
    const canReview = isSource ? item.canSourceReview : item.canDestinationReview;
    const meta = this._transferReviewMeta(decision);
    const label = isSource
      ? this.t("approvals.transfer_source", "Origen")
      : this.t("approvals.transfer_destination", "Destino");
    const dateLabel = isSource
      ? this.t("approvals.transfer_last_day_source", "Último día en origen")
      : this.t("approvals.transfer_first_day_destination", "Primer día en destino");
    const defaultDate = approvedDate
      || (isSource
        ? this._shiftIsoDate(item.destinationDate || item.requestedFirstDateTo, -1)
        : item.requestedFirstDateTo)
      || "";

    return `
      <div style="padding:12px;border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <strong style="font-size:12px;color:#0f172a;">${label}</strong>
          <span style="padding:3px 8px;border-radius:999px;background:${meta.bg};color:${meta.fg};font-size:10px;font-weight:900;">${meta.icon} ${meta.label}</span>
        </div>
        ${approvedDate ? `<div style="margin-top:7px;font-size:11px;color:#475569;">${dateLabel}: <strong>${this._escape(approvedDate)}</strong></div>` : ""}
        ${canReview ? `
          <div style="margin-top:10px;display:grid;gap:8px;">
            <label style="display:grid;gap:4px;font-size:11px;color:#475569;font-weight:700;">
              ${dateLabel}
              <input type="date"
                     class="transfer-review-date"
                     data-side="${side}"
                     value="${this._escape(defaultDate)}"
                     style="width:100%;min-height:44px;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;color:#0f172a;font:inherit;">
            </label>
            <label style="display:grid;gap:4px;font-size:11px;color:#475569;font-weight:700;">
              ${this.t("approvals.transfer_reason_optional", "Motivo / nota (opcional)")}
              <input type="text"
                     class="transfer-review-reason"
                     data-side="${side}"
                     maxlength="240"
                     placeholder="${this._escape(this.t("approvals.transfer_reason_placeholder", "Añade contexto si es necesario"))}"
                     style="width:100%;min-height:44px;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;color:#0f172a;font:inherit;">
            </label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button"
                      class="btn-transfer-review"
                      data-request-id="${this._escape(item.id)}"
                      data-side="${side}"
                      data-decision="APPROVED"
                      style="min-height:44px;flex:1 1 130px;padding:8px 12px;border:0;border-radius:8px;background:#166534;color:#ffffff;font-size:12px;font-weight:900;cursor:pointer;">
                ✓ ${this.t("approvals.transfer_approve_side", "Aprobar")}
              </button>
              <button type="button"
                      class="btn-transfer-review"
                      data-request-id="${this._escape(item.id)}"
                      data-side="${side}"
                      data-decision="REJECTED"
                      style="min-height:44px;flex:1 1 130px;padding:8px 12px;border:1px solid #fca5a5;border-radius:8px;background:#fff1f2;color:#be123c;font-size:12px;font-weight:900;cursor:pointer;">
                ${this.t("approvals.reject", "Rechazar")}
              </button>
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }

  _renderTransferItem(item, status, type, created, detail) {
    const finalReady = item.readyForFinalization && item.status === "PENDING";
    return `
      <article class="approval-card transfer-approval-card" data-request-id="${this._escape(item.id)}"
               style="background:#ffffff;border:1px solid #ddd6fe;border-radius:14px;padding:15px;box-shadow:0 1px 3px rgba(15,23,42,.04);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div style="min-width:0;flex:1 1 300px;">
            <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:7px;">
              <span style="padding:3px 8px;border-radius:999px;background:${type.bg};color:${type.fg};font-size:11px;font-weight:900;">${type.icon} ${type.label}</span>
              <span style="padding:3px 8px;border-radius:999px;background:${status.bg};color:${status.fg};border:1px solid ${status.border};font-size:11px;font-weight:900;">${status.icon} ${status.label}</span>
              ${finalReady ? `<span style="padding:3px 8px;border-radius:999px;background:#ede9fe;color:#5b21b6;font-size:10px;font-weight:900;">${this.t("approvals.transfer_ready", "Lista para finalizar")}</span>` : ""}
            </div>
            <h2 style="margin:0;color:#0f172a;font-size:15px;font-weight:900;overflow-wrap:anywhere;">${this._escape(this._itemTitle(item))}</h2>
            <div style="margin-top:4px;color:#475569;font-size:12px;line-height:1.45;overflow-wrap:anywhere;">${this._escape(this._itemSubtitle(item))}</div>
            ${item.requestedFirstDateTo ? `<div style="margin-top:7px;color:#64748b;font-size:11px;">${this.t("approvals.transfer_requested_start", "Alta solicitada")}: <strong>${this._escape(item.requestedFirstDateTo)}</strong></div>` : ""}
            ${detail ? `<div style="margin-top:7px;padding:8px 10px;border-radius:8px;background:#fff1f2;color:#9f1239;font-size:12px;line-height:1.45;overflow-wrap:anywhere;">${detail}</div>` : ""}
            ${created ? `<div style="margin-top:7px;color:#94a3b8;font-size:11px;">${created}</div>` : ""}
          </div>
          <a href="#/settings" style="min-height:44px;display:inline-flex;align-items:center;padding:8px 12px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;text-decoration:none;font-size:12px;font-weight:800;">${this.t("approvals.view_context", "Ver contexto")}</a>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-top:12px;">
          ${this._renderTransferSide(item, "SOURCE")}
          ${this._renderTransferSide(item, "DESTINATION")}
        </div>

        ${item.canFinalize ? `
          <div style="margin-top:12px;padding:12px;border-radius:11px;background:#f5f3ff;border:1px solid #c4b5fd;">
            <div style="font-size:11px;color:#5b21b6;line-height:1.45;margin-bottom:8px;">
              ${this.t("approvals.transfer_finalize_help", "Origen y destino están aprobados. La finalización aplicará el cambio temporal de plantilla con las fechas acordadas.")}
            </div>
            <button type="button"
                    class="btn-transfer-finalize"
                    data-request-id="${this._escape(item.id)}"
                    style="width:100%;min-height:46px;padding:9px 14px;border:0;border-radius:9px;background:#6d28d9;color:#ffffff;font-size:12px;font-weight:900;cursor:pointer;">
              ⚡ ${this.t("approvals.transfer_finalize", "Finalizar traspaso")}
            </button>
          </div>
        ` : ""}
      </article>
    `;
  }

  _renderItem(item) {
    const status = this._statusMeta(item.status);
    const type = this._typeMeta(item.type);
    const created = this._formatDate(item.createdAt);
    const detail = item.detail ? this._escape(item.detail) : "";
    const actions = item.status === "PENDING" && (item.canApprove || item.canReturn || item.canReject);

    const targetLink = item.type === RequestType.GAME_LOCK
      ? `#/games`
      : item.type === RequestType.PLAYER_DATA_SUBMISSION
        ? `#/player/${item.playerId || ""}`
        : `#/settings`;

    if (item.type === RequestType.TRANSFER) {
      return this._renderTransferItem(item, status, type, created, detail);
    }

    return `
      <article class="approval-card" data-request-id="${this._escape(item.id)}"
               style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:15px;box-shadow:0 1px 3px rgba(15,23,42,.04);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div style="min-width:0;flex:1 1 280px;">
            <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:7px;">
              <span style="padding:3px 8px;border-radius:999px;background:${type.bg};color:${type.fg};font-size:11px;font-weight:900;">${type.icon} ${type.label}</span>
              <span style="padding:3px 8px;border-radius:999px;background:${status.bg};color:${status.fg};border:1px solid ${status.border};font-size:11px;font-weight:900;">${status.icon} ${status.label}</span>
            </div>
            <h2 style="margin:0;color:#0f172a;font-size:15px;font-weight:900;overflow-wrap:anywhere;">${this._escape(this._itemTitle(item))}</h2>
            <div style="margin-top:4px;color:#475569;font-size:12px;line-height:1.45;overflow-wrap:anywhere;">${this._escape(this._itemSubtitle(item))}</div>
            ${detail ? `<div style="margin-top:7px;padding:8px 10px;border-radius:8px;background:#f8fafc;color:#334155;font-size:12px;line-height:1.45;overflow-wrap:anywhere;">${detail}</div>` : ""}
            ${created ? `<div style="margin-top:7px;color:#94a3b8;font-size:11px;">${created}</div>` : ""}
          </div>

          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
            <a href="${targetLink}" style="min-height:44px;display:inline-flex;align-items:center;padding:8px 12px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;text-decoration:none;font-size:12px;font-weight:800;">${this.t("approvals.view_context", "Ver contexto")}</a>
            ${actions && item.canApprove ? `<button type="button" class="btn-approval-approve" data-request-id="${this._escape(item.id)}" style="min-height:44px;padding:8px 12px;border:0;border-radius:8px;background:#166534;color:#ffffff;font-size:12px;font-weight:900;cursor:pointer;">✓ ${this.t("approvals.approve", "Aprobar")}</button>` : ""}
            ${actions && item.canReturn ? `<button type="button" class="btn-approval-return" data-request-id="${this._escape(item.id)}" style="min-height:44px;padding:8px 12px;border:1px solid #fdba74;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:12px;font-weight:900;cursor:pointer;">↩ Devolver</button>` : ""}
            ${actions && item.canReject ? `<button type="button" class="btn-approval-reject" data-request-id="${this._escape(item.id)}" style="min-height:44px;padding:8px 12px;border:1px solid #fca5a5;border-radius:8px;background:#fff1f2;color:#be123c;font-size:12px;font-weight:900;cursor:pointer;">${this.t("approvals.reject", "Rechazar")}</button>` : ""}
          </div>
        </div>
        ${actions && [RequestType.GAME_LOCK, RequestType.TEAM_SEASON_FREEZE, RequestType.PLAYER_DATA_SUBMISSION].includes(item.type) ? `
          <label style="display:grid;gap:4px;margin-top:12px;font-size:11px;font-weight:800;color:#475569;">
            ${item.type === RequestType.PLAYER_DATA_SUBMISSION ? "Comentario para el jugador" : this.t("approvals.resolution_note", "Nota de resolución (opcional)")}
            <input type="text"
                   class="approval-resolution-note"
                   data-request-id="${this._escape(item.id)}"
                   maxlength="240"
                   placeholder="${this._escape(this.t("approvals.resolution_note_placeholder", "Añade contexto para la auditoría"))}"
                   style="width:100%;min-height:44px;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;color:#0f172a;font:inherit;">
          </label>
        ` : ""}
      </article>
    `;
  }

  _renderEmptyState() {
    const isPending = this.filter === "PENDING";
    return `
      <div style="padding:34px 20px;text-align:center;background:#ffffff;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b;">
        <div style="font-size:28px;margin-bottom:8px;">${isPending ? "✅" : "📭"}</div>
        <strong style="display:block;color:#334155;margin-bottom:4px;">${isPending ? this.t("approvals.empty_pending", "No tienes solicitudes pendientes") : this.t("approvals.empty_filter", "No hay solicitudes en este filtro")}</strong>
        <span style="font-size:12px;">${this.t("approvals.empty_help", "La bandeja se actualizará al entrar de nuevo o al pulsar Actualizar.")}</span>
      </div>
    `;
  }

  _findItem(id) {
    return (this.state.items || []).find(item => String(item.id) === String(id)) || null;
  }

  _bindEvents() {
    this.container?.querySelector("#btn-refresh-approval-center")?.addEventListener("click", () => {
      this._loadAndRender();
    });

    this.container?.querySelectorAll(".approval-filter").forEach(button => {
      button.addEventListener("click", () => {
        this.filter = button.dataset.filter || "PENDING";
        this._renderState();
      });
    });

    this.container?.querySelectorAll(".btn-transfer-review").forEach(button => {
      button.addEventListener("click", async event => {
        const requestId = event.currentTarget.dataset.requestId;
        const side = String(event.currentTarget.dataset.side || "").toUpperCase();
        const decision = String(event.currentTarget.dataset.decision || "").toUpperCase();
        const item = this._findItem(requestId);
        if (!item || item.type !== RequestType.TRANSFER) return;

        const card = event.currentTarget.closest(".transfer-approval-card");
        const dateInput = card?.querySelector(`.transfer-review-date[data-side="${side}"]`);
        const reasonInput = card?.querySelector(`.transfer-review-reason[data-side="${side}"]`);
        const effectiveDate = decision === "APPROVED" ? String(dateInput?.value || "") : null;
        const reason = String(reasonInput?.value || "").trim() || null;

        if (decision === "APPROVED" && !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate || "")) {
          alert(this.t("approvals.transfer_date_required", "Selecciona una fecha válida antes de aprobar."));
          dateInput?.focus();
          return;
        }

        await this._runAction(event.currentTarget, () =>
          this.service.reviewTransfer(item, side, decision, effectiveDate, reason)
        );
      });
    });

    this.container?.querySelectorAll(".btn-transfer-finalize").forEach(button => {
      button.addEventListener("click", async event => {
        const item = this._findItem(event.currentTarget.dataset.requestId);
        if (!item || item.type !== RequestType.TRANSFER) return;

        if (!confirm(this.t(
          "approvals.transfer_finalize_confirm",
          "¿Finalizar el traspaso con las fechas aprobadas por origen y destino? Esta acción actualizará la elegibilidad histórica del jugador."
        ))) return;

        await this._runAction(event.currentTarget, async () => {
          await this.service.finalizeTransfer(item);
          DataStore.isLoaded = false;
          await DataStore.init(DataStore.getActiveTeamId?.() || null, true);
        });
      });
    });

    this.container?.querySelectorAll(".btn-approval-approve").forEach(button => {
      button.addEventListener("click", async event => {
        const item = this._findItem(event.currentTarget.dataset.requestId);
        if (!item) return;
        const confirmation = item.type === RequestType.PLAYER_DATA_SUBMISSION
          ? "¿Validar esta aportación e incorporarla al histórico oficial del jugador?"
          : item.type === RequestType.GAME_LOCK
          ? this.t("approvals.approve_lock_confirm", "¿Aprobar y cerrar este partido? Quedará bloqueado hasta que un Admin/Superadmin lo reabra.")
          : item.type === RequestType.TEAM_SEASON_FREEZE
            ? this.t(
                "approvals.approve_season_freeze_confirm",
                "¿Aprobar el cierre de esta temporada? Sus partidos abiertos y la plantilla quedarán congelados en modo histórico."
              )
            : this.t("approvals.approve_access_confirm", "¿Aprobar esta solicitud de acceso?");
        if (!confirm(confirmation)) return;

        const note = String(
          this.container?.querySelector(
            `.approval-resolution-note[data-request-id="${item.id}"]`
          )?.value || ""
        ).trim() || null;

        await this._runAction(event.currentTarget, async () => {
          await this.service.approve(item, note);
          if ([RequestType.GAME_LOCK, RequestType.TEAM_SEASON_FREEZE].includes(item.type)) {
            DataStore.isLoaded = false;
            await DataStore.init(DataStore.getActiveTeamId?.() || null, true);
          }
        });
      });
    });

    this.container?.querySelectorAll(".btn-approval-return").forEach(button => {
      button.addEventListener("click", async event => {
        const item = this._findItem(event.currentTarget.dataset.requestId);
        if (!item || item.type !== RequestType.PLAYER_DATA_SUBMISSION) return;
        const note = String(
          this.container?.querySelector(`.approval-resolution-note[data-request-id="${item.id}"]`)?.value || ""
        ).trim();
        if (!note) {
          alert("Indica qué debe corregir el jugador antes de devolver la aportación.");
          return;
        }
        await this._runAction(event.currentTarget, () => this.service.returnSubmission(item, note));
      });
    });

    this.container?.querySelectorAll(".btn-approval-reject").forEach(button => {
      button.addEventListener("click", async event => {
        const item = this._findItem(event.currentTarget.dataset.requestId);
        if (!item) return;
        const note = String(
          this.container?.querySelector(
            `.approval-resolution-note[data-request-id="${item.id}"]`
          )?.value || ""
        ).trim() || null;
        if (item.type === RequestType.PLAYER_DATA_SUBMISSION && !note) {
          alert("Indica el motivo del rechazo para que el jugador pueda entenderlo.");
          return;
        }

        await this._runAction(event.currentTarget, () => this.service.reject(item, note));
      });
    });
  }

  async _runAction(button, action) {
    try {
      button.disabled = true;
      button.style.opacity = "0.65";
      await action();
      await this._loadAndRender();
    } catch (error) {
      console.error("[ApprovalCenterView] Error resolviendo solicitud:", error);
      alert(`❌ ${this.t("approvals.action_error", "No se pudo completar la acción.")} ${error?.message || error}`);
      button.disabled = false;
      button.style.opacity = "1";
    }
  }
}

export default ApprovalCenterView;
