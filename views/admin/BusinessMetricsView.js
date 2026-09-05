/**
 * @fileoverview Internal business/product metrics and controlled pilot dashboard.
 * @description Aggregate decision support plus SUPERADMIN-only cohort operations.
 * UI permissions are defense-in-depth; backend RPCs independently authorize every
 * pilot action and commercial tables remain unreachable from the browser.
 */
import { BusinessMetricsService } from "../../services/analytics/BusinessMetricsService.js";
import { FamilyPilotService } from "../../services/family/FamilyPilotService.js";
import { evaluateFamilyCommercialReadiness } from "../../domain/family/FamilyCommercialReadinessPolicy.js";
import { FAMILY_PILOT_CONFIG } from "../../config/family-pilot.config.js";
import { Permission } from "../../security/permissions.js";

const esc = (value = "") => String(value)
  .replaceAll("&","&amp;").replaceAll("<","&lt;")
  .replaceAll(">","&gt;").replaceAll('"',"&quot;");
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const dateLabel = value => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("es-ES");
};

export class BusinessMetricsView {
  constructor(supabaseClient = null, authController = null) {
    this.service = new BusinessMetricsService(supabaseClient);
    this.pilotService = new FamilyPilotService(supabaseClient);
    this.auth = authController;
    this.days = 30;
    this.container = null;
    this.pilot = null;
    this.pilotError = null;
  }

  _can(permission) {
    if (typeof this.auth?.canPreview === "function") return Boolean(this.auth.canPreview(permission));
    if (typeof this.auth?.can === "function") return Boolean(this.auth.can(permission));
    return false;
  }

  async render(containerId = "dashboard-content-area") {
    this.container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
    if (!this.container) return;
    this._styles();
    this.container.innerHTML = `<div class="biz-loading">Cargando métricas de producto…</div>`;
    try {
      const canViewPilot = this._can(Permission.VIEW_FAMILY_PILOT);
      const [metrics, pilotResult] = await Promise.all([
        this.service.getMetrics(this.days),
        canViewPilot
          ? this.pilotService.getSnapshot()
              .then(data => ({ data, error: null }))
              .catch(error => ({ data: null, error }))
          : Promise.resolve({ data: null, error: null })
      ]);
      this.pilot = pilotResult.data;
      this.pilotError = pilotResult.error;
      this.container.innerHTML = this._content(metrics);
      this._bind();
    } catch (error) {
      this.container.innerHTML = `<section class="biz-shell"><div class="biz-error"><h1>Panel de negocio no disponible</h1><p>${esc(error?.message || error)}</p></div></section>`;
    }
  }

  _content(metrics = {}) {
    const events = metrics.events || {};
    const plans = metrics.family_plans || {};
    const readiness = evaluateFamilyCommercialReadiness();
    const eventRows = Object.entries(events)
      .sort((a,b) => num(b[1]) - num(a[1]))
      .slice(0,12)
      .map(([code,total]) => `<tr><td>${esc(code)}</td><td>${num(total)}</td></tr>`).join("");
    const planRows = Object.entries(plans)
      .map(([code,status]) => `<span class="biz-plan"><b>${esc(code)}</b><i>${esc(status)}</i></span>`).join("");

    return `<section class="biz-shell">
      <header class="biz-hero"><div><p>IQBasket · Growth</p><h1>Producto y monetización</h1>
        <span>Métricas first-party agregadas. Interés no equivale a compra.</span></div>
        <label>Ventana<select data-biz-days>
          <option value="7" ${this.days===7?"selected":""}>7 días</option>
          <option value="30" ${this.days===30?"selected":""}>30 días</option>
          <option value="90" ${this.days===90?"selected":""}>90 días</option>
        </select></label>
      </header>
      <div class="biz-kpis">
        ${this._kpi("Familias activas",num(metrics.unique_users),"usuarios con evento")}
        ${this._kpi("Jugadores",num(metrics.unique_players),"con interacción familiar")}
        ${this._kpi("Ofertas vistas",num(metrics.offer_views),"contextuales")}
        ${this._kpi("Interés",`${num(metrics.interest_rate)}%`,`${num(metrics.interest_clicks)} acciones`)}
      </div>
      ${this._readinessCard(readiness)}
      ${this._pilotCard()}
      <div class="biz-grid">
        <article class="biz-card"><div><p>Planes Family</p><h2>Estado comercial</h2></div>
          <div class="biz-plan-list">${planRows || "Sin planes"}</div>
          <small>Los planes DRAFT no conceden acceso ni pueden consumirse como suscripción efectiva.</small>
        </article>
        <article class="biz-card"><div><p>Funnel</p><h2>Eventos principales</h2></div>
          <div class="biz-table-wrap"><table><thead><tr><th>Evento</th><th>Total</th></tr></thead>
          <tbody>${eventRows || '<tr><td colspan="2">Aún no hay eventos.</td></tr>'}</tbody></table></div>
        </article>
      </div>
      <article class="biz-note"><strong>Lectura correcta:</strong> primero medimos activación y valor. No calcularemos MRR, churn o LTV hasta que exista facturación real y eventos de compra/cancelación verificables.</article>
    </section>`;
  }

  _pilotCard() {
    if (!this._can(Permission.VIEW_FAMILY_PILOT)) return "";
    if (this.pilotError) {
      return `<article class="biz-pilot" data-family-pilot><div><p>Piloto Family</p><h2>Cohorte no disponible</h2>
        <span>El backend del piloto aún no está disponible o ha rechazado la consulta. No se ha modificado ningún acceso.</span></div>
        <code>${esc(this.pilotError?.message || "FAMILY_PILOT_UNAVAILABLE")}</code></article>`;
    }

    const pilot = this.pilot || {};
    const candidates = Array.isArray(pilot.candidates) ? pilot.candidates : [];
    const enrollments = Array.isArray(pilot.enrollments) ? pilot.enrollments : [];
    const canEnroll = this._can(Permission.ENROLL_FAMILY_PILOT);
    const canRevoke = this._can(Permission.REVOKE_FAMILY_PILOT);
    const availableCandidates = candidates.filter(row => row?.eligible && !row?.active_enrollment_id);
    const candidateOptions = availableCandidates.map((row,index) =>
      `<option value="${index}">${esc(row.owner_name || row.owner_email || "Familia")} · ${esc(row.player_name || "Jugador")}</option>`
    ).join("");
    const dayOptions = FAMILY_PILOT_CONFIG.allowedTrialDays.map(days =>
      `<option value="${days}" ${days===FAMILY_PILOT_CONFIG.defaultTrialDays?"selected":""}>${days} días</option>`
    ).join("");
    const rows = enrollments.slice(0,12).map(row => {
      const effectiveStatus = String(row?.status || "").toUpperCase();
      const revoke = canRevoke && effectiveStatus === "ACTIVE"
        ? `<button type="button" class="biz-pilot-danger" data-pilot-revoke="${esc(row.id)}">Revocar</button>` : "";
      return `<tr>
        <td><b>${esc(row.owner_name || row.owner_email || "Familia")}</b><small>${esc(row.player_name || "Jugador")}</small></td>
        <td><span class="biz-pilot-status is-${esc(effectiveStatus.toLowerCase())}">${esc(effectiveStatus || "—")}</span></td>
        <td>${esc(dateLabel(row.ends_at))}</td>
        <td>${revoke}</td>
      </tr>`;
    }).join("");

    return `<article class="biz-pilot" data-family-pilot>
      <div class="biz-pilot-head">
        <div><p>Piloto Family</p><h2>Validación de valor sin cobro</h2>
          <span>Player 360, desarrollo, tecnificación e insights durante una ventana temporal. Sin IA, Wellness ni Nutrición.</span></div>
        <div class="biz-pilot-counts">
          ${this._pilotCount("Activos",pilot.activeCount)}
          ${this._pilotCount("Expirados",pilot.expiredCount)}
          ${this._pilotCount("Revocados",pilot.revokedCount)}
        </div>
      </div>
      <div class="biz-pilot-guardrail"><strong>Regla:</strong> sólo se puede incluir una familia con vínculo tutor-jugador ya verificado. El piloto no crea relaciones, no cobra y vuelve automáticamente a Family Free al caducar.</div>
      ${canEnroll ? `<div class="biz-pilot-enroll">
        <label>Familia y jugador<select data-pilot-candidate ${availableCandidates.length?"":"disabled"}>
          ${candidateOptions || '<option value="">Sin candidatos verificados disponibles</option>'}
        </select></label>
        <label>Duración<select data-pilot-days>${dayOptions}</select></label>
        <button type="button" data-pilot-enroll ${availableCandidates.length?"":"disabled"}>Incluir en piloto</button>
      </div>` : ""}
      <div class="biz-table-wrap"><table class="biz-pilot-table">
        <thead><tr><th>Familia / jugador</th><th>Estado</th><th>Hasta</th><th>Acción</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">Todavía no hay altas en el piloto.</td></tr>'}</tbody>
      </table></div>
    </article>`;
  }

  _pilotCount(label,value) {
    return `<span><b>${num(value)}</b><i>${esc(label)}</i></span>`;
  }

  _readinessCard(readiness = {}) {
    const checkout = readiness.checkout || { ready: false, blockers: [] };
    const ai = readiness.ai || { ready: false, blockers: [] };
    const blockers = [...(checkout.blockers || []), ...(ai.blockers || [])]
      .filter((item, index, rows) => rows.findIndex(candidate => candidate.code === item.code) === index);
    const blockerRows = blockers.length
      ? blockers.map(item => `<li><code>${esc(item.code)}</code><span>${esc(item.label)}</span></li>`).join("")
      : "<li><span>Sin bloqueos de readiness declarados.</span></li>";
    return `<article class="biz-readiness" data-family-commercial-readiness>
      <div class="biz-readiness-head">
        <div><p>Gate de lanzamiento</p><h2>Readiness comercial Family</h2>
          <span>Defensa adicional de despliegue. No sustituye RBAC/ABAC, privacidad, entitlements ni validaciones backend.</span></div>
        <div class="biz-readiness-statuses">
          ${this._readinessStatus("Checkout", checkout.ready)}
          ${this._readinessStatus("IA Family", ai.ready)}
        </div>
      </div>
      <details ${blockers.length ? "open" : ""}>
        <summary>${blockers.length ? `${blockers.length} bloqueo${blockers.length === 1 ? "" : "s"} pendiente${blockers.length === 1 ? "" : "s"}` : "Readiness completo"}</summary>
        <ul>${blockerRows}</ul>
      </details>
    </article>`;
  }

  _readinessStatus(label, ready) {
    return `<span class="biz-readiness-pill ${ready ? "is-ready" : "is-blocked"}"><b>${esc(label)}</b><i>${ready ? "READY" : "BLOCKED"}</i></span>`;
  }

  _kpi(label,value,caption) {
    return `<article><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(caption)}</small></article>`;
  }

  _bind() {
    this.container?.querySelector("[data-biz-days]")?.addEventListener("change", async event => {
      this.days = Number(event.target.value) || 30;
      await this.render(this.container);
    });

    this.container?.querySelector("[data-pilot-enroll]")?.addEventListener("click", async event => {
      if (!this._can(Permission.ENROLL_FAMILY_PILOT)) return;
      const select = this.container.querySelector("[data-pilot-candidate]");
      const daysSelect = this.container.querySelector("[data-pilot-days]");
      const candidates = (this.pilot?.candidates || []).filter(row => row?.eligible && !row?.active_enrollment_id);
      const candidate = candidates[Number(select?.value)];
      if (!candidate) return;
      const days = Number(daysSelect?.value) || FAMILY_PILOT_CONFIG.defaultTrialDays;
      const approved = typeof window.confirm !== "function" || window.confirm(
        `Incluir a ${candidate.owner_name || candidate.owner_email || "esta familia"} con ${candidate.player_name || "el jugador"} durante ${days} días. No habrá cobro. ¿Continuar?`
      );
      if (!approved) return;
      event.currentTarget.disabled = true;
      try {
        await this.pilotService.enroll({
          ownerUserId: candidate.owner_user_id,
          playerId: candidate.player_id,
          trialDays: days
        });
        await this.render(this.container);
      } catch (error) {
        event.currentTarget.disabled = false;
        window.alert?.(`No se pudo iniciar el piloto: ${error?.message || error}`);
      }
    });

    this.container?.querySelectorAll("[data-pilot-revoke]").forEach(button => {
      button.addEventListener("click", async event => {
        if (!this._can(Permission.REVOKE_FAMILY_PILOT)) return;
        const enrollmentId = event.currentTarget.dataset.pilotRevoke;
        const approved = typeof window.confirm !== "function" || window.confirm(
          "Revocar este acceso temporal y volver inmediatamente a Family Free. ¿Continuar?"
        );
        if (!approved) return;
        event.currentTarget.disabled = true;
        try {
          await this.pilotService.revoke({ enrollmentId, reason: "SUPERADMIN_DASHBOARD_REVOKE" });
          await this.render(this.container);
        } catch (error) {
          event.currentTarget.disabled = false;
          window.alert?.(`No se pudo revocar el piloto: ${error?.message || error}`);
        }
      });
    });
  }

  _styles() {
    if (document.getElementById("business-metrics-styles")) return;
    const style=document.createElement("style");
    style.id="business-metrics-styles";
    style.textContent=`
      .biz-shell{max-width:1180px;margin:0 auto;padding:8px 0 48px;color:#0f172a}.biz-hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;padding:24px;border:1px solid #dbeafe;border-radius:22px;background:linear-gradient(135deg,#eff6ff,#f8fafc)}
      .biz-hero p,.biz-card p,.biz-readiness p,.biz-pilot p{margin:0;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#2563eb}.biz-hero h1{margin:4px 0 6px}.biz-hero span{color:#64748b}.biz-hero label{display:grid;gap:5px;font-size:12px;font-weight:800}.biz-hero select{min-height:42px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:6px 10px}
      .biz-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.biz-kpis article{display:grid;padding:16px;background:#0f172a;color:#fff;border-radius:16px}.biz-kpis span{font-size:11px;color:#cbd5e1;text-transform:uppercase}.biz-kpis strong{font-size:27px}.biz-kpis small{color:#94a3b8}
      .biz-readiness{padding:20px;border:1px solid #fed7aa;border-radius:18px;background:#fff7ed;margin:14px 0}.biz-readiness-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.biz-readiness h2{margin:4px 0 5px}.biz-readiness-head>div>span{font-size:12px;color:#64748b}.biz-readiness-statuses{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.biz-readiness-pill{display:grid;gap:1px;min-width:105px;padding:8px 10px;border:1px solid #fdba74;border-radius:11px;background:#fff}.biz-readiness-pill b{font-size:12px}.biz-readiness-pill i{font-size:10px;font-style:normal;font-weight:900}.biz-readiness-pill.is-ready{border-color:#86efac;background:#f0fdf4}.biz-readiness-pill.is-ready i{color:#15803d}.biz-readiness-pill.is-blocked i{color:#c2410c}.biz-readiness details{margin-top:12px}.biz-readiness summary{cursor:pointer;font-weight:800;font-size:13px}.biz-readiness ul{display:grid;gap:7px;margin:10px 0 0;padding-left:20px}.biz-readiness li{font-size:12px;color:#475569}.biz-readiness code{display:inline-block;margin-right:8px;font-size:10px;color:#9a3412;background:#ffedd5;border-radius:5px;padding:2px 5px}
      .biz-pilot{margin:14px 0;padding:20px;border:1px solid #bfdbfe;border-radius:18px;background:#f8fbff}.biz-pilot-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.biz-pilot h2{margin:4px 0 5px}.biz-pilot-head>div>span,.biz-pilot>div>span{font-size:12px;color:#64748b}.biz-pilot-counts{display:flex;gap:7px}.biz-pilot-counts span{display:grid;min-width:72px;padding:8px 10px;text-align:center;border:1px solid #dbeafe;border-radius:11px;background:#fff}.biz-pilot-counts b{font-size:18px}.biz-pilot-counts i{font-size:10px;font-style:normal;color:#64748b;text-transform:uppercase}.biz-pilot-guardrail{margin:14px 0;padding:11px 12px;border-radius:10px;background:#eff6ff;font-size:12px;color:#475569}.biz-pilot-enroll{display:grid;grid-template-columns:minmax(0,2fr) minmax(110px,.6fr) auto;gap:10px;align-items:end;margin:12px 0 16px}.biz-pilot-enroll label{display:grid;gap:5px;min-width:0;font-size:12px;font-weight:800}.biz-pilot-enroll select,.biz-pilot-enroll button{min-height:42px;max-width:100%;border-radius:10px}.biz-pilot-enroll select{width:100%;border:1px solid #cbd5e1;background:#fff;padding:6px 9px}.biz-pilot-enroll button{border:0;background:#0f172a;color:#fff;padding:8px 14px;font-weight:800;cursor:pointer}.biz-pilot-enroll button:disabled{opacity:.45;cursor:not-allowed}.biz-pilot-table td:first-child{display:grid;gap:2px}.biz-pilot-table td small{color:#64748b}.biz-pilot-status{display:inline-flex;padding:3px 6px;border-radius:7px;background:#e2e8f0;font-size:10px;font-weight:900}.biz-pilot-status.is-active{background:#dcfce7;color:#166534}.biz-pilot-status.is-expired{background:#f1f5f9;color:#475569}.biz-pilot-status.is-revoked{background:#fee2e2;color:#991b1b}.biz-pilot-danger{min-height:34px;border:1px solid #fecaca;border-radius:8px;background:#fff;color:#b91c1c;padding:5px 8px;font-weight:800;cursor:pointer}
      .biz-grid{display:grid;grid-template-columns:1fr 1.2fr;gap:14px}.biz-card{padding:20px;border:1px solid #e2e8f0;border-radius:18px;background:#fff}.biz-card h2{margin:4px 0 14px}.biz-card small,.biz-note{color:#64748b;font-size:12px}.biz-plan-list{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 16px}.biz-plan{display:grid;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px}.biz-plan i{font-size:11px;color:#64748b;font-style:normal}
      .biz-table-wrap{overflow:auto;max-width:100%}.biz-card table,.biz-pilot table{width:100%;border-collapse:collapse;font-size:12px}.biz-card th,.biz-card td,.biz-pilot th,.biz-pilot td{text-align:left;padding:9px;border-bottom:1px solid #f1f5f9}.biz-card th:last-child,.biz-card td:last-child{text-align:right}.biz-note{margin-top:14px;padding:14px;border-radius:14px;background:#f8fafc}.biz-loading,.biz-error{padding:32px;text-align:center}
      @media(max-width:760px){.biz-hero,.biz-readiness-head,.biz-pilot-head{display:grid;align-items:start}.biz-readiness-statuses{justify-content:flex-start}.biz-pilot-counts{width:100%}.biz-pilot-counts span{flex:1;min-width:0}.biz-pilot-enroll{grid-template-columns:1fr 1fr}.biz-pilot-enroll label:first-child{grid-column:1/-1}.biz-pilot-enroll button{width:100%}.biz-kpis{grid-template-columns:1fr 1fr}.biz-grid{grid-template-columns:1fr}}
      @media(max-width:380px){.biz-kpis{grid-template-columns:1fr}.biz-readiness-statuses{display:grid;grid-template-columns:1fr 1fr}.biz-readiness-pill{min-width:0}.biz-pilot-enroll{grid-template-columns:1fr}.biz-pilot-enroll label:first-child{grid-column:auto}.biz-pilot-counts{display:grid;grid-template-columns:repeat(3,1fr)}}
    `;
    document.head.appendChild(style);
  }
}

export default BusinessMetricsView;
