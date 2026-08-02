/**
 * @fileoverview Componente AppLayout.js
 * Genera el marco global de la aplicación (Menú lateral / Barra inferior responsive)
 * y un área fija de contenido donde se inyectan las vistas.
 */

export class AppLayout {
  constructor(router) {
    this.router = router;
  }

  render(containerId = "app") {
    const appContainer = document.getElementById(containerId);
    if (!appContainer) return;

    appContainer.innerHTML = `
      <div class="app-layout">
        
        <!-- 1. Menú Lateral (Desktop) / Barra Navegación Superior (Móvil) -->
        <aside class="app-sidebar">
          <div class="sidebar-brand">
            <span class="brand-logo">🏀</span>
            <span class="brand-name">IQ Basket</span>
          </div>

          <nav class="sidebar-nav">
            <a href="#/dashboard" class="nav-item active">
              <span class="nav-icon">📊</span>
              <span class="nav-text">Dashboard</span>
            </a>
            <a href="#/team" class="nav-item">
              <span class="nav-icon">👥</span>
              <span class="nav-text">Equipo</span>
            </a>
            <a href="#/games" class="nav-item">
              <span class="nav-icon">📅</span>
              <span class="nav-text">Partidos</span>
            </a>
            <a href="#/live" class="nav-item">
              <span class="nav-icon">📋</span>
              <span class="nav-text">Anotación</span>
            </a>
          </nav>
        </aside>

        <!-- 2. Marco Contenedor donde se cargan las Vistas -->
        <main id="main-content" class="app-main-content">
          <!-- Las vistas (SeasonDashboardView, etc.) se renderizan AQUÍ -->
        </main>

      </div>

      <!-- CSS del Layout Frame & Responsive Navigation -->
      <style>
        * { box-sizing: border-box; }
        body, html { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; }

        .app-layout {
          display: flex;
          min-height: 100vh;
          width: 100vw;
          overflow-x: hidden;
        }

        /* Sidebar Desktop */
        .app-sidebar {
          width: 240px;
          background: #0f172a;
          color: white;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          padding: 20px 16px;
          border-right: 1px solid #1e293b;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 900;
          font-size: 18px;
          margin-bottom: 30px;
          padding: 0 8px;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          color: #94a3b8;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .nav-item:hover, .nav-item.active {
          background: #1e293b;
          color: #38bdf8;
        }

        /* Área Principal de Trabajo */
        .app-main-content {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
          max-width: 100%;
        }

        /* 📱 RESPONSIVE PARA MÓVILES (Menú Inferior) */
        @media (max-width: 768px) {
          .app-layout {
            flex-direction: column-reverse; /* El menú pasa abajo en móvil */
          }

          .app-sidebar {
            width: 100%;
            height: 60px;
            position: fixed;
            bottom: 0;
            left: 0;
            z-index: 1000;
            flex-direction: row;
            justify-content: space-around;
            align-items: center;
            padding: 0;
            border-right: none;
            border-top: 1px solid #1e293b;
          }

          .sidebar-brand {
            display: none; /* Oculta el logo en la barra inferior */
          }

          .sidebar-nav {
            flex-direction: row;
            justify-content: space-around;
            width: 100%;
          }

          .nav-item {
            flex-direction: column;
            gap: 2px;
            font-size: 10px;
            padding: 6px;
          }

          .nav-icon {
            font-size: 18px;
          }

          .app-main-content {
            padding: 16px;
            padding-bottom: 80px; /* Margen para no tapar contenido con el menú móvil */
          }
        }
      </style>
    `;

    this._attachNavigationHighlight();
  }

  _attachNavigationHighlight() {
    window.addEventListener("hashchange", () => {
      const currentHash = window.location.hash || "#/dashboard";
      document.querySelectorAll(".nav-item").forEach((item) => {
        if (item.getAttribute("href") === currentHash) {
          item.classList.add("active");
        } else {
          item.classList.remove("active");
        }
      });
    });
  }
}