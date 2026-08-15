/**
 * EasyStatsEntryView.js
 * Sistema dual de entrada de estadísticas fácil (Rápido vs Cancha interactiva / Heatmap).
 * Integrado con el sistema dinámico de traducción (I18nService / TranslationStore) y control de roles.
 */

const ALLOWED_ROLES = ['superadmin', 'admin', 'entrenador', 'analista'];

export class EasyStatsEntryView {
  constructor(gameController, authController, i18nService, gameId) {
    this.gameController = gameController;
    this.authController = authController;
    this.i18n = i18nService;
    this.gameId = gameId;
    this.game = null;
    this.currentUser = null;
    this.selectedPlayerId = null;
    this.selectedPlayerName = null;
    this.currentMode = 'live'; // 'live' | 'postmatch'
    this.liveSubMode = 'court'; // 'fast' | 'court'
    this.actionHistory = [];
    this.pendingShot = null;
  }

  // Traducción dinámica con el motor de IQbasket (TranslationStore / I18nEngine)
  t(key, fallback = '') {
    if (this.i18n && typeof this.i18n.translate === 'function') {
      const val = this.i18n.translate(key);
      if (val && val !== key) return val;
    }
    if (this.i18n && typeof this.i18n.t === 'function') {
      const val = this.i18n.t(key);
      if (val && val !== key) return val;
    }
    return fallback || key;
  }

  async render(container) {
    this.container = container;

    // 1. Verificación de Roles
    this.currentUser = this.authController?.getCurrentUser?.() || null;
    const userRole = (this.currentUser?.role || '').toLowerCase().trim();

    if (!this.currentUser || !ALLOWED_ROLES.includes(userRole)) {
      this.renderAccessDenied();
      return;
    }

    // 2. Carga del Partido
    this.game = (await this.gameController?.getGameById?.(this.gameId)) || {
      homeTeamName: this.t('easy_entry.home_team', 'Local'),
      awayTeamName: this.t('easy_entry.away_team', 'Visitante'),
      homeScore: 0,
      awayScore: 0,
      players: [
        { id: '1', number: '4', name: 'García' },
        { id: '2', number: '7', name: 'Navarro' },
        { id: '3', number: '10', name: 'López' },
        { id: '4', number: '13', name: 'Gasol' },
        { id: '5', number: '23', name: 'Rubio' },
        { id: '6', number: '33', name: 'Mirotic' }
      ]
    };

    this.renderLayout();
    this.bindEvents();
  }

  renderAccessDenied() {
    this.container.innerHTML = `
      <div style="max-width: 520px; margin: 40px auto; padding: 28px; background: white; border-radius: 12px; border: 1px solid #fee2e2; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); font-family: system-ui, sans-serif;">
        <div style="font-size: 3.2rem; margin-bottom: 12px;">🔒</div>
        <h2 style="font-size: 1.3rem; font-weight: 800; color: #991b1b; margin: 0 0 8px 0;" data-i18n="easy_entry.access_denied_title">
          ${this.t('easy_entry.access_denied_title', 'Acceso Restringido')}
        </h2>
        <p style="font-size: 0.95rem; color: #64748b; line-height: 1.5; margin: 0 0 16px 0;" data-i18n="easy_entry.access_denied_desc">
          ${this.t('easy_entry.access_denied_desc', 'La entrada y edición de estadísticas está reservada exclusivamente para Superadmin, Admin, Entrenadores y Analistas.')}
        </p>
        <div style="background: #f8fafc; padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; color: #475569; margin-bottom: 18px; border: 1px solid #e2e8f0;">
          <span data-i18n="easy_entry.current_role">${this.t('easy_entry.current_role', 'Rol actual')}</span>: 
          <strong>${this.currentUser?.role || this.t('easy_entry.guest', 'Invitado')}</strong>
        </div>
        <button id="btn-back-dashboard" style="background: #0f172a; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer;" data-i18n="easy_entry.back_home">
          ${this.t('easy_entry.back_home', 'Volver al Inicio')}
        </button>
      </div>
    `;

    this.container.querySelector('#btn-back-dashboard')?.addEventListener('click', () => {
      window.location.hash = '#/dashboard';
    });
  }

  renderLayout() {
    this.container.innerHTML = `
      <div class="easy-entry-wrapper" style="max-width: 1300px; margin: 0 auto; padding: 12px; font-family: system-ui, -apple-system, sans-serif;">
        
        <!-- HEADER DE CONTROL -->
        <header style="background: #0f172a; color: white; border-radius: 12px; padding: 10px 18px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px;">
          <div>
            <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 700; text-transform: uppercase;">IQbasket Pro Entry</span>
            <h1 style="margin: 0; font-size: 1.15rem; font-weight: 800;">${this.game.homeTeamName} vs ${this.game.awayTeamName}</h1>
          </div>

          <!-- Marcador en Vivo -->
          <div style="display: flex; align-items: center; gap: 14px; background: #1e293b; padding: 4px 16px; border-radius: 8px;">
            <span style="font-size: 1.4rem; font-weight: 900; color: #38bdf8;" id="score-home">${this.game.homeScore}</span>
            <span style="color: #64748b; font-weight: 700;">-</span>
            <span style="font-size: 1.4rem; font-weight: 900; color: #f43f5e;" id="score-away">${this.game.awayScore}</span>
          </div>

          <!-- Modos y Deshacer -->
          <div style="display: flex; gap: 8px;">
            <button id="btn-toggle-main-mode" style="background: #334155; color: white; border: none; padding: 7px 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">
              ${this.currentMode === 'live' ? '📋 ' + this.t('easy_entry.mode_postmatch', 'Modo Acta Pospartido') : '⚡ ' + this.t('easy_entry.mode_live', 'Modo En Directo')}
            </button>
            <button id="btn-undo" style="background: #dc2626; color: white; border: none; padding: 7px 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">
              ↩ <span data-i18n="easy_entry.undo">${this.t('easy_entry.undo', 'Deshacer')}</span>
            </button>
          </div>
        </header>

        <!-- SUBSELECTOR DIRECTO -->
        ${this.currentMode === 'live' ? `
          <div style="display: flex; justify-content: space-between; align-items: center; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 14px; margin-bottom: 12px;">
            <div style="font-size: 0.85rem; font-weight: 700; color: #334155;" data-i18n="easy_entry.capture_type">${this.t('easy_entry.capture_type', 'Tipo de Registro:')}</div>
            <div style="display: flex; gap: 6px;">
              <button id="btn-mode-fast" style="padding: 6px 12px; font-size: 0.8rem; font-weight: 700; border-radius: 6px; border: 1px solid #cbd5e1; cursor: pointer; background: ${this.liveSubMode === 'fast' ? '#0284c7' : '#f8fafc'}; color: ${this.liveSubMode === 'fast' ? 'white' : '#475569'};">
                ⚡ <span data-i18n="easy_entry.fast_mode">${this.t('easy_entry.fast_mode', 'Modo Rápido')}</span>
              </button>
              <button id="btn-mode-court" style="padding: 6px 12px; font-size: 0.8rem; font-weight: 700; border-radius: 6px; border: 1px solid #cbd5e1; cursor: pointer; background: ${this.liveSubMode === 'court' ? '#0284c7' : '#f8fafc'}; color: ${this.liveSubMode === 'court' ? 'white' : '#475569'};">
                🏀 <span data-i18n="easy_entry.court_mode">${this.t('easy_entry.court_mode', 'Modo Pista (Mapa de Calor)')}</span>
              </button>
            </div>
          </div>
        ` : ''}

        <!-- CONTENIDO PRINCIPAL -->
        <main id="entry-main-content">
          ${this.currentMode === 'live' 
            ? (this.liveSubMode === 'fast' ? this.renderFastMode() : this.renderCourtMode()) 
            : this.renderPostMatchMode()}
        </main>

        <!-- FOOTER DE FEEDBACK -->
        <footer style="margin-top: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 16px; font-size: 0.85rem; color: #475569; display: flex; justify-content: space-between; align-items: center;">
          <span id="last-action-feed" data-i18n="easy_entry.ready_hint">${this.t('easy_entry.ready_hint', 'Selecciona un jugador para comenzar.')}</span>
          <span><span data-i18n="easy_entry.registered_actions">${this.t('easy_entry.registered_actions', 'Acciones registradas')}</span>: <strong id="action-count">${this.actionHistory.length}</strong></span>
        </footer>
      </div>
    `;
  }

  renderPlayerList() {
    return `
      <section style="background: white; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px;">
        <h2 style="font-size: 0.9rem; margin: 0 0 8px 0; font-weight: 700; color: #0f172a;">1️⃣ <span data-i18n="easy_entry.select_player">${this.t('easy_entry.select_player', 'Jugador')}</span></h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px;">
          ${this.game.players.map(p => `
            <button class="player-card-btn ${this.selectedPlayerId === p.id ? 'active-player' : ''}" 
                    data-player-id="${p.id}"
                    data-player-name="#${p.number} ${p.name}"
                    style="display: flex; flex-direction: column; align-items: center; padding: 10px 4px; border: 2px solid ${this.selectedPlayerId === p.id ? '#0284c7' : '#e2e8f0'}; background: ${this.selectedPlayerId === p.id ? '#e0f2fe' : '#f8fafc'}; border-radius: 8px; cursor: pointer;">
              <span style="font-size: 1.25rem; font-weight: 900; color: #0f172a;">#${p.number}</span>
              <span style="font-size: 0.75rem; font-weight: 600; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;">${p.name}</span>
            </button>
          `).join('')}
        </div>
      </section>
    `;
  }

  renderFastMode() {
    return `
      <div style="display: grid; grid-template-columns: 300px 1fr; gap: 12px;">
        ${this.renderPlayerList()}
        
        <section style="background: white; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px;">
          <h2 style="font-size: 0.9rem; margin: 0 0 10px 0; font-weight: 700; color: #0f172a;">2️⃣ <span data-i18n="easy_entry.select_action">${this.t('easy_entry.select_action', 'Acción')}</span></h2>
          
          <div style="margin-bottom: 12px;">
            <div style="font-size: 0.75rem; font-weight: 700; color: #16a34a; margin-bottom: 4px;" data-i18n="easy_entry.made_shots">${this.t('easy_entry.made_shots', 'CANASTAS CONVERTIDAS')}</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              <button class="action-btn" data-action="FGM2" data-pts="2" style="background: #22c55e; color: white; border: none; padding: 16px; border-radius: 8px; font-weight: 800; font-size: 1.1rem; cursor: pointer;">+2 ${this.t('easy_entry.two_pts', 'Canasta')}</button>
              <button class="action-btn" data-action="FGM3" data-pts="3" style="background: #16a34a; color: white; border: none; padding: 16px; border-radius: 8px; font-weight: 800; font-size: 1.1rem; cursor: pointer;">+3 ${this.t('easy_entry.three_pts', 'Triple')}</button>
              <button class="action-btn" data-action="FTM" data-pts="1" style="background: #84cc16; color: white; border: none; padding: 16px; border-radius: 8px; font-weight: 800; font-size: 1.1rem; cursor: pointer;">+1 ${this.t('easy_entry.free_throw', 'Libre')}</button>
            </div>
          </div>

          <div style="margin-bottom: 12px;">
            <div style="font-size: 0.75rem; font-weight: 700; color: #dc2626; margin-bottom: 4px;" data-i18n="easy_entry.missed_shots">${this.t('easy_entry.missed_shots', 'TIROS FALLADOS')}</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              <button class="action-btn" data-action="FGA2_MISS" data-pts="0" style="background: #f87171; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer;">${this.t('easy_entry.miss_t2', 'Fallo T2')}</button>
              <button class="action-btn" data-action="FGA3_MISS" data-pts="0" style="background: #ef4444; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer;">${this.t('easy_entry.miss_t3', 'Fallo T3')}</button>
              <button class="action-btn" data-action="FTA_MISS" data-pts="0" style="background: #fca5a5; color: #7f1d1d; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer;">${this.t('easy_entry.miss_ft', 'Fallo TL')}</button>
            </div>
          </div>

          <div>
            <div style="font-size: 0.75rem; font-weight: 700; color: #0284c7; margin-bottom: 4px;" data-i18n="easy_entry.game_events">${this.t('easy_entry.game_events', 'REBOTES / FALTAS / PÉRDIDAS')}</div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
              <button class="action-btn" data-action="DREB" style="background: #38bdf8; color: #0f172a; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer;">${this.t('easy_entry.reb_def', 'Reb Def')}</button>
              <button class="action-btn" data-action="OREB" style="background: #7dd3fc; color: #0f172a; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer;">${this.t('easy_entry.reb_off', 'Reb Of')}</button>
              <button class="action-btn" data-action="FOUL" style="background: #fbbf24; color: #78350f; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer;">${this.t('easy_entry.foul', 'Falta')}</button>
              <button class="action-btn" data-action="TOV" style="background: #fb923c; color: #7c2d12; border: none; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer;">${this.t('easy_entry.turnover', 'Pérdida')}</button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  renderCourtMode() {
    return `
      <div style="display: grid; grid-template-columns: 280px 1fr 220px; gap: 12px;">
        ${this.renderPlayerList()}
        
        <!-- PISTA INTERACTIVA -->
        <section style="background: white; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; align-items: center;">
          <div style="font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 6px; width: 100%; display: flex; justify-content: space-between;">
            <span>📍 <span data-i18n="easy_entry.court_touch_hint">${this.t('easy_entry.court_touch_hint', 'Toca el lugar del tiro en la pista')}</span></span>
            <span id="shot-status-hint" style="color: #0284c7;" data-i18n="easy_entry.step_two">${this.t('easy_entry.step_two', 'Paso 2: Toca el punto')}</span>
          </div>

          <div style="position: relative; width: 100%; max-width: 480px; aspect-ratio: 50/47; background: #e09f67; border: 3px solid #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); cursor: crosshair;" id="court-canvas-container">
            <svg viewBox="0 0 500 470" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; pointer-events: none;">
              <rect x="0" y="0" width="500" height="470" fill="none" stroke="#fff" stroke-width="4"/>
              <rect x="170" y="0" width="160" height="190" fill="rgba(255,255,255,0.15)" stroke="#fff" stroke-width="3"/>
              <path d="M 170 190 A 80 80 0 0 0 330 190" fill="none" stroke="#fff" stroke-width="3"/>
              <path d="M 170 190 A 80 80 0 0 1 330 190" stroke-dasharray="8,8" fill="none" stroke="#fff" stroke-width="2"/>
              <line x1="220" y1="40" x2="280" y2="40" stroke="#fff" stroke-width="4"/>
              <circle cx="250" cy="52" r="15" fill="none" stroke="#ff5722" stroke-width="4"/>
              <path d="M 215 52 A 35 35 0 0 0 285 52" fill="none" stroke="#fff" stroke-width="2"/>
              <line x1="30" y1="0" x2="30" y2="140" stroke="#fff" stroke-width="3"/>
              <line x1="470" y1="0" x2="470" y2="140" stroke="#fff" stroke-width="3"/>
              <path d="M 30 140 A 235 235 0 0 0 470 140" fill="none" stroke="#fff" stroke-width="3"/>
            </svg>
            <div id="shot-markers-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
          </div>
        </section>

        <!-- ACCIONES COMPLEMENTARIAS -->
        <section style="background: white; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
          <h2 style="font-size: 0.9rem; margin: 0 0 4px 0; font-weight: 700; color: #0f172a;">3️⃣ <span data-i18n="easy_entry.shot_result">${this.t('easy_entry.shot_result', 'Resultado del Tiro')}</span></h2>
          
          <button class="shot-outcome-btn" data-made="true" style="background: #22c55e; color: white; border: none; padding: 14px 8px; border-radius: 8px; font-weight: 800; font-size: 1rem; cursor: pointer;">
            ✔ <span data-i18n="easy_entry.made">${this.t('easy_entry.made', 'CONVERTIDO')}</span>
          </button>
          <button class="shot-outcome-btn" data-made="false" style="background: #ef4444; color: white; border: none; padding: 14px 8px; border-radius: 8px; font-weight: 800; font-size: 1rem; cursor: pointer;">
            ✖ <span data-i18n="easy_entry.missed">${this.t('easy_entry.missed', 'FALLADO')}</span>
          </button>

          <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; margin-top: 10px;" data-i18n="easy_entry.other_actions">${this.t('easy_entry.other_actions', 'OTRAS ACCIONES')}</div>
          <button class="action-btn" data-action="FTM" data-pts="1" style="background: #84cc16; color: white; border: none; padding: 8px; border-radius: 6px; font-weight: 700; cursor: pointer;">+1 ${this.t('easy_entry.free_throw', 'Libre')}</button>
          <button class="action-btn" data-action="DREB" style="background: #0284c7; color: white; border: none; padding: 8px; border-radius: 6px; font-weight: 700; cursor: pointer;">${this.t('easy_entry.reb_def', 'Rebote')}</button>
          <button class="action-btn" data-action="FOUL" style="background: #f59e0b; color: white; border: none; padding: 8px; border-radius: 6px; font-weight: 700; cursor: pointer;">${this.t('easy_entry.foul', 'Falta')}</button>
          <button class="action-btn" data-action="TOV" style="background: #ea580c; color: white; border: none; padding: 8px; border-radius: 6px; font-weight: 700; cursor: pointer;">${this.t('easy_entry.turnover', 'Pérdida')}</button>
        </section>
      </div>
    `;
  }

  renderPostMatchMode() {
    return `
      <section style="background: white; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; overflow-x: auto;">
        <h2 style="font-size: 1rem; margin: 0 0 10px 0; font-weight: 700; color: #0f172a;">📋 <span data-i18n="easy_entry.postmatch_title">${this.t('easy_entry.postmatch_title', 'Transcripción Rápida del Acta Oficial')}</span></h2>
        <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 0.85rem;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 8px; text-align: left;" data-i18n="easy_entry.player">${this.t('easy_entry.player', 'Jugador')}</th>
              <th>T2 Conv.</th><th>T2 Int.</th><th>T3 Conv.</th><th>T3 Int.</th><th>TL Conv.</th><th>TL Int.</th><th data-i18n="easy_entry.fouls">${this.t('easy_entry.fouls', 'Faltas')}</th><th style="background:#e0f2fe;" data-i18n="easy_entry.pts">${this.t('easy_entry.pts', 'Puntos')}</th>
            </tr>
          </thead>
          <tbody>
            ${this.game.players.map(p => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 6px; text-align: left; font-weight: 700;">#${p.number} ${p.name}</td>
                <td><input type="number" min="0" value="0" class="matrix-input t2m" style="width: 44px; text-align: center;"></td>
                <td><input type="number" min="0" value="0" class="matrix-input t2a" style="width: 44px; text-align: center;"></td>
                <td><input type="number" min="0" value="0" class="matrix-input t3m" style="width: 44px; text-align: center;"></td>
                <td><input type="number" min="0" value="0" class="matrix-input t3a" style="width: 44px; text-align: center;"></td>
                <td><input type="number" min="0" value="0" class="matrix-input ftm" style="width: 44px; text-align: center;"></td>
                <td><input type="number" min="0" value="0" class="matrix-input fta" style="width: 44px; text-align: center;"></td>
                <td><input type="number" min="0" max="5" value="0" class="matrix-input foul" style="width: 44px; text-align: center;"></td>
                <td class="total-pts-cell" style="font-weight: 800; color: #0284c7; background: #f0f9ff;">0</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="margin-top: 12px; text-align: right;">
          <button id="btn-save-postmatch" style="background: #16a34a; color: white; border: none; padding: 10px 18px; border-radius: 6px; font-weight: 700; cursor: pointer;">
            💾 <span data-i18n="easy_entry.save_match_sheet">${this.t('easy_entry.save_match_sheet', 'Guardar Acta')}</span>
          </button>
        </div>
      </section>
    `;
  }

  bindEvents() {
    this.container.querySelector('#btn-toggle-main-mode')?.addEventListener('click', () => {
      this.currentMode = this.currentMode === 'live' ? 'postmatch' : 'live';
      this.renderLayout();
      this.bindEvents();
    });

    this.container.querySelector('#btn-mode-fast')?.addEventListener('click', () => {
      this.liveSubMode = 'fast';
      this.renderLayout();
      this.bindEvents();
    });

    this.container.querySelector('#btn-mode-court')?.addEventListener('click', () => {
      this.liveSubMode = 'court';
      this.renderLayout();
      this.bindEvents();
    });

    this.container.querySelector('#btn-undo')?.addEventListener('click', () => {
      this.undoLastAction();
    });

    if (this.currentMode === 'live') {
      this.bindPlayerSelection();
      if (this.liveSubMode === 'fast') {
        this.bindFastModeActions();
      } else {
        this.bindCourtModeActions();
      }
    } else {
      this.bindPostMatchEvents();
    }
  }

  bindPlayerSelection() {
    const playerBtns = this.container.querySelectorAll('.player-card-btn');
    playerBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedPlayerId = btn.getAttribute('data-player-id');
        this.selectedPlayerName = btn.getAttribute('data-player-name');
        
        playerBtns.forEach(b => {
          b.style.border = '2px solid #e2e8f0';
          b.style.background = '#f8fafc';
        });
        btn.style.border = '2px solid #0284c7';
        btn.style.background = '#e0f2fe';

        this.updateFeed(`${this.t('easy_entry.active_player', 'Jugador activo')}: <strong>${this.selectedPlayerName}</strong>`);
      });
    });
  }

  bindFastModeActions() {
    this.container.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this.selectedPlayerId) return alert(this.t('easy_entry.warn_select_player', 'Selecciona primero un jugador'));
        const action = btn.getAttribute('data-action');
        const pts = parseInt(btn.getAttribute('data-pts') || '0', 10);
        this.saveEvent({ action, points: pts });
      });
    });
  }

  bindCourtModeActions() {
    const courtContainer = this.container.querySelector('#court-canvas-container');
    
    courtContainer?.addEventListener('click', (e) => {
      if (!this.selectedPlayerId) return alert(this.t('easy_entry.warn_select_player', 'Primero selecciona el jugador'));

      const rect = courtContainer.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const distFromRim = Math.hypot((x - 50) * 1.5, (y - 11) * 1.5);
      const isThreePoint = distFromRim > 42 || y > 55;

      this.pendingShot = {
        x: parseFloat(x.toFixed(1)),
        y: parseFloat(y.toFixed(1)),
        shotType: isThreePoint ? 'T3' : 'T2'
      };

      this.container.querySelector('#shot-status-hint').innerHTML = 
        `<span style="color:#16a34a; font-weight:800;">${this.pendingShot.shotType} ${this.t('easy_entry.marked_shot', 'marcado. Pulsa CONVERTIDO o FALLADO ➔')}</span>`;
    });

    this.container.querySelectorAll('.shot-outcome-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this.selectedPlayerId) return alert(this.t('easy_entry.warn_select_player', 'Selecciona un jugador'));
        if (!this.pendingShot) return alert(this.t('easy_entry.warn_mark_court', 'Toca primero en el mapa de la cancha dónde se lanzó el tiro'));

        const made = btn.getAttribute('data-made') === 'true';
        const isT3 = this.pendingShot.shotType === 'T3';
        const points = made ? (isT3 ? 3 : 2) : 0;
        const action = made ? (isT3 ? 'FGM3' : 'FGM2') : (isT3 ? 'FGA3_MISS' : 'FGA2_MISS');

        this.saveEvent({
          action,
          points,
          coordinates: { x: this.pendingShot.x, y: this.pendingShot.y },
          made
        });

        this.drawShotMarker(this.pendingShot.x, this.pendingShot.y, made);
        this.pendingShot = null;
        this.container.querySelector('#shot-status-hint').textContent = this.t('easy_entry.step_two', 'Paso 2: Toca el punto');
      });
    });

    this.container.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this.selectedPlayerId) return alert(this.t('easy_entry.warn_select_player', 'Selecciona primero un jugador'));
        const action = btn.getAttribute('data-action');
        const pts = parseInt(btn.getAttribute('data-pts') || '0', 10);
        this.saveEvent({ action, points: pts });
      });
    });
  }

  bindPostMatchEvents() {
    const rows = this.container.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const inputs = row.querySelectorAll('.matrix-input');
      inputs.forEach(input => {
        input.addEventListener('input', () => {
          const t2m = parseInt(row.querySelector('.t2m').value || 0, 10);
          const t3m = parseInt(row.querySelector('.t3m').value || 0, 10);
          const ftm = parseInt(row.querySelector('.ftm').value || 0, 10);
          const total = (t2m * 2) + (t3m * 3) + ftm;
          row.querySelector('.total-pts-cell').textContent = total;
        });
      });
    });

    this.container.querySelector('#btn-save-postmatch')?.addEventListener('click', () => {
      alert(this.t('easy_entry.postmatch_saved', '¡Acta oficial guardada con éxito!'));
    });
  }

  drawShotMarker(xPercent, yPercent, made) {
    const layer = this.container.querySelector('#shot-markers-layer');
    if (!layer) return;

    const marker = document.createElement('div');
    marker.style.position = 'absolute';
    marker.style.left = `${xPercent}%`;
    marker.style.top = `${yPercent}%`;
    marker.style.transform = 'translate(-50%, -50%)';
    marker.style.width = '12px';
    marker.style.height = '12px';
    marker.style.borderRadius = '50%';
    marker.style.background = made ? '#22c55e' : '#ef4444';
    marker.style.border = '2px solid white';
    marker.style.boxShadow = '0 0 4px rgba(0,0,0,0.5)';
    layer.appendChild(marker);
  }

  saveEvent(eventData) {
    const event = {
      id: Date.now(),
      playerId: this.selectedPlayerId,
      playerName: this.selectedPlayerName,
      ...eventData
    };

    this.actionHistory.push(event);

    if (event.points > 0) {
      this.game.homeScore += event.points;
      const sc = this.container.querySelector('#score-home');
      if (sc) sc.textContent = this.game.homeScore;
    }

    this.updateFeed(`✅ ${this.selectedPlayerName} - ${event.action} ${event.points > 0 ? '(+' + event.points + 'p)' : ''}`);
    
    this.container.querySelector('#action-count').textContent = this.actionHistory.length;
    this.selectedPlayerId = null;
    this.selectedPlayerName = null;
    this.container.querySelectorAll('.player-card-btn').forEach(b => {
      b.style.border = '2px solid #e2e8f0';
      b.style.background = '#f8fafc';
    });
  }

  undoLastAction() {
    if (this.actionHistory.length === 0) return alert(this.t('easy_entry.nothing_to_undo', 'Nada que deshacer'));
    const last = this.actionHistory.pop();
    if (last.points > 0) {
      this.game.homeScore = Math.max(0, this.game.homeScore - last.points);
      const sc = this.container.querySelector('#score-home');
      if (sc) sc.textContent = this.game.homeScore;
    }

    if (last.coordinates) {
      const layer = this.container.querySelector('#shot-markers-layer');
      if (layer && layer.lastChild) layer.removeChild(layer.lastChild);
    }

    this.updateFeed(`↩ ${this.t('easy_entry.undone', 'Deshecho')}: ${last.playerName} (${last.action})`);
    this.container.querySelector('#action-count').textContent = this.actionHistory.length;
  }

  updateFeed(html) {
    const el = this.container.querySelector('#last-action-feed');
    if (el) el.innerHTML = html;
  }
}