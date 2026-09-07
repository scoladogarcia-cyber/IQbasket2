/**
 * @fileoverview V30 staff workspace for persistent Family/player relationships.
 * @description Separates relationship lifetime from invitation-code expiry and
 * lets the current team's coach see/revoke inherited active guardian links.
 */
import { DataStore } from "../../services/DataStore.js";
import { Permission } from "../../security/PermissionService.js";
import { FamilyStaffV30Service } from "../../services/family/FamilyStaffV30Service.js";
import { FamilyProfileControls } from "../../components/admin/FamilyProfileControls.js";

const esc = (value = "") => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function playerLabel(player = {}) {
  const name = (player.name || [player.first_name, player.last_name].filter(Boolean).join(" ")
    || [player.firstName, player.lastName].filter(Boolean).join(" ") || "Jugador").trim();
  return `#${player.jersey ?? player.number ?? "—"} · ${name}`;
}

function fmt(value) {
  if (!value) return "Indefinidamente";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

export class FamilyStaffV30View {
  constructor(supabaseClient = null, authController = null) {
    this.auth = authController;
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.service = new FamilyStaffV30Service(this.supabase);
    this.teamId = null;
    this.teamSeasonId = null;
    this.players = [];
    this.links = [];
    this.familyControls = null;
  }

  _resolveScope() {
    this.teamId = DataStore.getActiveTeamId?.() || null;
    const season = DataStore.getActiveSeasonContext?.(this.teamId) || null;
    this.teamSeasonId = season?.team_season_id || season?.teamSeasonId
      || (season?.source === "v3" ? season?.id : null)
      || DataStore.getActiveTeamSeasonId?.(this.teamId) || null;
    this.players = DataStore.getPlayers?.(this.teamId) || DataStore.getPlayers?.() || [];
  }

  _can(permission) {
    return Boolean(this.auth?.canPreview?.(permission, { teamId: this.teamId, teamSeasonId: this.teamSeasonId }));
  }

  async render(containerId = "dashboard-content-area") {
    const container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
    if (!container) return;
    this._resolveScope();
    const canInvite = this._can(Permission.INVITE_FAMILY_LINK);
    const canRevoke = this._can(Permission.REVOKE_FAMILY_LINK);
    const canDirectAssign = this._can(Permission.CREATE_PRIVACY_AUTHORIZATION);

    if (this.teamSeasonId && canRevoke) {
      try { this.links = await this.service.listLinks(this.teamSeasonId); }
      catch (error) { console.warn("[FamilyStaffV30] links:", error.message); this.links = []; }
    }

    container.innerHTML = `<section class="fv30">
      ${this._styles()}
      <header class="fv30-hero"><div><span>FAMILIAS & BIENESTAR</span><h1>Familias y tutores</h1>
        <p>El vínculo pertenece al jugador, no al equipo. Si cambia de club o equipo, una relación activa continúa y el nuevo staff la ve automáticamente.</p></div>
        <b>Vínculo por jugador</b></header>
      ${!this.teamSeasonId ? this._notice("Selecciona un equipo y una temporada activa.") : ""}
      ${this.teamSeasonId && canInvite ? this._inviteCard() : ""}
      ${this.teamSeasonId && canRevoke ? this._linksCard() : ""}
      ${this.teamSeasonId && canDirectAssign ? this._adminCard() : ""}
    </section>`;

    if (this.teamSeasonId && canInvite) this._bindInvite(container);
    if (this.teamSeasonId && canRevoke) this._bindLinks(container);
    if (this.teamSeasonId && canDirectAssign) this._bindAdmin(container);
  }

  _styles() {
    return `<style>
      .fv30{max-width:1120px;margin:auto;display:grid;gap:16px;color:#0f172a}.fv30-hero,.fv30-card{background:#fff;border:1px solid #dbe3ee;border-radius:18px;padding:20px;box-shadow:0 5px 20px rgba(15,23,42,.05)}
      .fv30-hero{display:flex;justify-content:space-between;gap:16px}.fv30-hero span{font-size:11px;letter-spacing:.12em;font-weight:900;color:#1d4ed8}.fv30-hero h1{margin:4px 0 7px;font-size:28px}.fv30-hero p,.fv30-card>p{margin:0;color:#64748b;line-height:1.5}.fv30-hero b{height:max-content;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:7px 10px;font-size:11px;white-space:nowrap}
      .fv30-card h2{margin:0 0 5px;font-size:18px}.fv30-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:15px}.fv30-field{display:grid;gap:6px}.fv30-field label{font-size:12px;font-weight:800;color:#334155}.fv30 input,.fv30 select{min-height:46px;width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;background:#fff;color:#0f172a;font:inherit}
      .fv30-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;flex-wrap:wrap}.fv30 button{min-height:44px;border:0;border-radius:10px;padding:9px 14px;font-weight:900;cursor:pointer}.fv30-primary{background:#2563eb;color:#fff}.fv30-secondary{background:#eef2ff;color:#3730a3}.fv30-danger{background:#fff1f2;color:#be123c;border:1px solid #fecdd3!important}.fv30 button:disabled{opacity:.55}.fv30-status{min-height:18px;margin-top:9px;font-size:12px}.fv30-status.ok{color:#166534}.fv30-status.error{color:#b91c1c}
      .fv30-result{display:none;margin-top:12px;padding:13px;border:1px solid #86efac;background:#f0fdf4;border-radius:11px}.fv30-result.show{display:grid;gap:7px}.fv30-code{font-family:ui-monospace,monospace;font-weight:900;overflow-wrap:anywhere;background:#fff;padding:9px;border-radius:8px;border:1px solid #bbf7d0}.fv30-link-list{display:grid;gap:9px;margin-top:14px}.fv30-link{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) auto;gap:12px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:12px}.fv30-link strong{display:block}.fv30-link small{color:#64748b;display:block;margin-top:3px}.fv30-empty{padding:14px;border:1px dashed #cbd5e1;border-radius:10px;color:#64748b}.fv30-admin-result{margin-top:12px}.fv30-note{font-size:12px;color:#64748b;margin-top:8px!important}
      @media(max-width:700px){.fv30-hero{display:grid}.fv30-hero h1{font-size:24px}.fv30-hero b{justify-self:start}.fv30-grid{grid-template-columns:1fr}.fv30-link{grid-template-columns:1fr}.fv30-actions{display:grid}.fv30-actions button{width:100%}.fv30-hero,.fv30-card{padding:16px;border-radius:14px}}
    </style>`;
  }

  _notice(text) { return `<article class="fv30-card"><p>${esc(text)}</p></article>`; }

  _playerOptions() {
    return `<option value="">Selecciona jugador</option>${this.players.map(p => `<option value="${esc(p.id)}">${esc(playerLabel(p))}</option>`).join("")}`;
  }

  _inviteCard() {
    return `<article class="fv30-card"><h2>Invitar familia / tutor</h2>
      <p>El código de seguridad caduca en 7 días. La duración elegida corresponde al vínculo con el jugador y puede revocarse en cualquier momento.</p>
      <div class="fv30-grid">
        <div class="fv30-field"><label>Jugador</label><select id="fv30-player">${this._playerOptions()}</select></div>
        <div class="fv30-field"><label>Email de la familia</label><input id="fv30-email" type="email" autocomplete="email" placeholder="familia@ejemplo.com"></div>
        <div class="fv30-field"><label>Duración del vínculo</label><select id="fv30-duration">
          <option value="INDEFINITE" selected>Indefinidamente</option><option value="7_DAYS">7 días</option>
          <option value="30_DAYS">30 días</option><option value="12_MONTHS">12 meses (una temporada)</option>
        </select></div>
      </div>
      <div class="fv30-actions"><button class="fv30-primary" id="fv30-invite">Generar código</button></div>
      <div class="fv30-status" id="fv30-invite-status"></div>
      <div class="fv30-result" id="fv30-result"><strong>Código para compartir</strong><div class="fv30-code" id="fv30-code"></div>
        <small id="fv30-expiry"></small><button class="fv30-secondary" id="fv30-copy">Copiar código</button></div>
    </article>`;
  }

  _linksCard() {
    const rows = this.links.length ? this.links.map(link => `<div class="fv30-link" data-link-id="${esc(link.relationship_id)}">
      <div><strong>${esc(link.player_name || "Jugador")}</strong><small>#${esc(link.jersey ?? "—")} · ${esc(link.primary_position || "Sin posición")}</small></div>
      <div><strong>${esc(link.family_name || link.family_email || "Familia")}</strong><small>${esc(link.family_email || "")} · ${link.indefinite ? "Indefinido" : `hasta ${esc(fmt(link.valid_until))}`}</small></div>
      <button class="fv30-danger fv30-revoke" data-id="${esc(link.relationship_id)}">Revocar</button>
    </div>`).join("") : `<div class="fv30-empty">No hay vínculos Family activos para la plantilla actual.</div>`;
    return `<article class="fv30-card"><h2>Vínculos activos de esta plantilla</h2>
      <p>Incluye vínculos creados en equipos anteriores: siguen al jugador mientras estén activos. El entrenador actual puede revocarlos si dejan de ser válidos.</p>
      <div class="fv30-link-list">${rows}</div><div class="fv30-status" id="fv30-links-status"></div></article>`;
  }

  _adminCard() {
    return `<article class="fv30-card"><h2>Asignación administrativa directa</h2>
      <p>Admin/Superadmin pueden localizar una cuenta Family y asignarle varios jugadores. La asignación directa es indefinida por defecto y queda auditada.</p>
      <div class="fv30-grid"><div class="fv30-field"><label>Email Family</label><input id="fv30-admin-email" type="email" placeholder="familia@ejemplo.com"></div></div>
      <div class="fv30-actions"><button class="fv30-secondary" id="fv30-find">Buscar cuenta</button></div>
      <div class="fv30-status" id="fv30-admin-status"></div><div class="fv30-admin-result" id="fv30-admin-result"></div>
    </article>`;
  }

  _bindInvite(container) {
    const button = container.querySelector("#fv30-invite");
    const status = container.querySelector("#fv30-invite-status");
    button?.addEventListener("click", async () => {
      const playerId = container.querySelector("#fv30-player")?.value || "";
      const email = container.querySelector("#fv30-email")?.value.trim() || "";
      const relationshipDuration = container.querySelector("#fv30-duration")?.value || "INDEFINITE";
      if (!playerId || !email) { status.className="fv30-status error"; status.textContent="Selecciona jugador e introduce el email."; return; }
      button.disabled=true; status.className="fv30-status"; status.textContent="Generando…";
      try {
        const data = await this.service.createInvitation({ teamSeasonId:this.teamSeasonId, playerId, email, relationshipDuration });
        container.querySelector("#fv30-code").textContent = data.claim_code || "";
        container.querySelector("#fv30-expiry").textContent = `Código válido hasta ${fmt(data.expires_at)} · vínculo: ${relationshipDuration === "INDEFINITE" ? "indefinido" : fmt(data.relationship_valid_until)}`;
        container.querySelector("#fv30-result")?.classList.add("show");
        status.className="fv30-status ok"; status.textContent="Invitación creada.";
      } catch (error) { status.className="fv30-status error"; status.textContent=error.message || String(error); }
      finally { button.disabled=false; }
    });
    container.querySelector("#fv30-copy")?.addEventListener("click", async () => {
      const code = container.querySelector("#fv30-code")?.textContent || "";
      try { await navigator.clipboard.writeText(code); status.className="fv30-status ok"; status.textContent="Código copiado."; }
      catch { status.textContent="Mantén pulsado sobre el código para copiarlo."; }
    });
  }

  _bindLinks(container) {
    const status = container.querySelector("#fv30-links-status");
    container.querySelectorAll(".fv30-revoke").forEach(button => button.addEventListener("click", async () => {
      const id = button.dataset.id;
      if (!confirm("¿Revocar este vínculo familiar? La familia dejará de ver los datos asociados a este jugador.")) return;
      const reason = prompt("Motivo de revocación (opcional):", "Relación familiar revisada por el equipo");
      if (reason === null) return;
      button.disabled=true;
      try {
        await this.service.revokeLink({ teamSeasonId:this.teamSeasonId, relationshipId:id, reason });
        status.className="fv30-status ok"; status.textContent="Vínculo revocado.";
        await this.render(container);
      } catch (error) { status.className="fv30-status error"; status.textContent=error.message || String(error); button.disabled=false; }
    }));
  }

  _bindAdmin(container) {
    const button = container.querySelector("#fv30-find");
    const status = container.querySelector("#fv30-admin-status");
    const result = container.querySelector("#fv30-admin-result");
    button?.addEventListener("click", async () => {
      const email = container.querySelector("#fv30-admin-email")?.value.trim() || "";
      if (!email) { status.className="fv30-status error"; status.textContent="Introduce un email."; return; }
      button.disabled=true; status.textContent="Buscando…"; result.innerHTML="";
      try {
        const profile = await this.service.findFamilyProfile({ teamSeasonId:this.teamSeasonId, email });
        if (!profile?.id) throw new Error("No existe una cuenta Family activa con ese email.");
        this.familyControls = new FamilyProfileControls(this.supabase);
        await this.familyControls.load({ userId:profile.id, teamSeasonId:this.teamSeasonId, players:this.players });
        result.innerHTML = `<div style="margin-bottom:10px;font-weight:800">${esc(profile.first_name || "")} ${esc(profile.last_name || "")} · ${esc(profile.email)}</div>${this.familyControls.render()}`;
        this.familyControls.bind(result, { onSaved: async () => { status.className="fv30-status ok"; status.textContent="Perfil Family actualizado."; } });
        status.className="fv30-status ok"; status.textContent="Cuenta localizada.";
      } catch (error) { status.className="fv30-status error"; status.textContent=error.message || String(error); }
      finally { button.disabled=false; }
    });
  }
}

export default FamilyStaffV30View;
