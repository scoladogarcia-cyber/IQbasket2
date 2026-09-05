import{T as O,I as D,s as u,P}from"./index-Co3VTdK8.js";import"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";class R{constructor(t=null){this.auth=t,this.userProfile=null,this.isFetching=!1}t(t,e=""){const a=O?O.t(t,""):D.t(t);return!a||a===t?e||t:a}showSyncOverlay(t="⚡ Sincronizando con Supabase..."){let e=document.getElementById("sync-loading-overlay");e||(e=document.createElement("div"),e.id="sync-loading-overlay",e.style.cssText=`
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(4px);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        z-index: 9999; color: white; font-family: var(--font-family-base, system-ui);
      `,document.body.appendChild(e)),e.innerHTML=`
      <div style="width: 48px; height: 48px; border: 4px solid var(--color-primary, #f97316); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
      <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 800;">${t}</h3>
      <p style="margin: 0; color: #94a3b8; font-size: 13px;">Guardando cambios en la Base de Datos...</p>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `,e.style.display="flex"}hideSyncOverlay(){const t=document.getElementById("sync-loading-overlay");t&&(t.style.display="none")}async _fetchUserProfile(t){try{if(this.isFetching=!0,!u)return;const{data:e,error:a}=await u.from("user_profiles").select("id,email,first_name,last_name,phone,role,status,assigned_team_ids,linked_player_id,created_at").eq("email",t).maybeSingle();!a&&e&&(this.userProfile=e,e.first_name&&localStorage.setItem("iq_user_name",e.first_name),e.last_name&&localStorage.setItem("iq_user_lastname",e.last_name),e.phone&&localStorage.setItem("iq_user_phone",e.phone))}catch(e){console.warn("Nota leyendo perfil desde user_profiles:",e)}finally{this.isFetching=!1}}_bindPasswordToggles(t){t.querySelectorAll(".pwd-toggle-btn").forEach(e=>{e.addEventListener("click",a=>{a.preventDefault();const n=e.getAttribute("data-target"),i=t.querySelector(`#${n}`);if(i){const d=i.type==="password";i.type=d?"text":"password",e.textContent=d?"🙈":"👁️"}})})}async render(t="dashboard-content-area"){var m,v,b,w,_,S,E,A,I;const e=document.getElementById(t)||document.getElementById("main-content")||document.querySelector(".app-main-content")||document.body;if(!e)return;const a=(v=(m=this.auth)==null?void 0:m.getCurrentUser)==null?void 0:v.call(m),n=(a==null?void 0:a.email)||"";!this.userProfile&&!this.isFetching&&await this._fetchUserProfile(n);const i=((w=(b=this.auth)==null?void 0:b.getAuthenticatedRole)==null?void 0:w.call(b))||"INVITADO",d=((_=this.userProfile)==null?void 0:_.first_name)||localStorage.getItem("iq_user_name")||"Usuario",x=((S=this.userProfile)==null?void 0:S.last_name)||localStorage.getItem("iq_user_lastname")||"IQ",q=((E=this.userProfile)==null?void 0:E.phone)||localStorage.getItem("iq_user_phone")||"",C=n.split("@")[0],N=d.charAt(0).toUpperCase()||"U";e.innerHTML=`
      <div class="profile-container">
        
        <!-- HEADER AZUL DEL PERFIL -->
        <div class="profile-header-card">
          <div class="avatar-circle-lg">${N}</div>
          <div class="header-info">
            <h2>${d} ${x}</h2>
            <p>${n}</p>
            <span class="badge-role-header">${this.t("profile_role_label","ROL ASIGNADO:")} ${i} (${this.t("not_editable","NO CAMBIABLE")})</span>
          </div>
        </div>

        <!-- 1. DATOS DEL PERFIL -->
        <div class="profile-card card">
          <div class="card-title">
            <span>👤</span> ${this.t("profile_data_title","DATOS DEL PERFIL").toUpperCase()}
          </div>
          <form id="form-profile-data" class="grid-2-cols">
            <div class="form-group">
              <label for="input-profile-name">${this.t("first_name","Nombre")} *</label>
              <input type="text" id="input-profile-name" value="${d}" required />
            </div>
            <div class="form-group">
              <label for="input-profile-lastname">${this.t("last_name","Apellidos")} *</label>
              <input type="text" id="input-profile-lastname" value="${x}" required />
            </div>
            <div class="form-group">
              <label for="input-profile-phone">${this.t("phone","Teléfono de Contacto")}</label>
              <input type="text" id="input-profile-phone" value="${q}" placeholder="Ej. +34 600 000 000" />
            </div>
            <div class="form-group">
              <label for="input-profile-email">${this.t("email","Correo Electrónico")}</label>
              <input type="email" id="input-profile-email" value="${n}" required disabled class="input-disabled-highlight" />
            </div>
            <div class="form-group">
              <label for="input-profile-login">${this.t("login","Usuario / Login")}</label>
              <input type="text" id="input-profile-login" value="${C}" disabled class="input-disabled-highlight" />
            </div>
            <div class="form-group">
              <label>${this.t("role_disabled_label","Rol en el Sistema")}</label>
              <input type="text" value="${i}" disabled class="input-disabled-highlight" />
            </div>
            <div style="grid-column: 1 / -1; text-align: right; margin-top: 10px;">
              <button type="submit" class="btn-primary-blue">💾 ${this.t("save_profile","Guardar Perfil")}</button>
            </div>
          </form>
        </div>

        <!-- 2. CAMBIO DE CONTRASEÑA -->
        <div class="profile-card card">
          <div class="card-title">
            <span>🔑</span> ${this.t("change_password_title","CAMBIAR CONTRASEÑA").toUpperCase()}
          </div>
          <form id="form-change-password" class="grid-2-cols">
            <div class="form-group">
              <label for="input-new-password">${this.t("new_password","Nueva Contraseña")}</label>
              <div class="input-password-wrapper">
                <input type="password" id="input-new-password" placeholder="${this.t("new_password_placeholder","Escribe la nueva contraseña")}" />
                <button type="button" class="pwd-toggle-btn" data-target="input-new-password" title="Ver/Ocultar" aria-label="Ver u ocultar contraseña">👁️</button>
              </div>
            </div>
            <div class="form-group">
              <label for="input-repeat-password">${this.t("repeat_password","Repetir Nueva Contraseña")}</label>
              <div class="input-password-wrapper">
                <input type="password" id="input-repeat-password" placeholder="${this.t("repeat_password_placeholder","Repite la nueva contraseña")}" />
                <button type="button" class="pwd-toggle-btn" data-target="input-repeat-password" title="Ver/Ocultar" aria-label="Ver u ocultar contraseña">👁️</button>
              </div>
            </div>
            <div style="grid-column: 1 / -1; text-align: right; margin-top: 10px;">
              <button type="submit" class="btn-secondary-purple">🔒 ${this.t("change_password_btn","Actualizar Contraseña")}</button>
            </div>
          </form>
        </div>

        <!-- 3. ALCANCE Y EQUIPOS ASIGNADOS -->
        <div class="profile-card card">
          <div class="card-title">
            <span>🛡️</span> ${this.t("assigned_teams_title","EQUIPOS ASIGNADOS").toUpperCase()}
          </div>
          <div class="assigned-info-box">
            ${i==="SUPERADMIN"?"Como SUPERADMIN tienes acceso global y completo a todos los equipos y temporadas.":i==="INVITADO"?"Acceso en modo INVITADO (Solo Lectura para Demostración).":"Acceso técnico asignado al equipo activo actual."}
          </div>
        </div>

      </div>

      <style>
        .profile-container {
          max-width: 950px;
          margin: 0 auto;
          font-family: var(--font-family-base, system-ui);
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding-bottom: 40px;
        }

        .profile-header-card {
          background: var(--color-secondary, #0f172a);
          color: white;
          border-radius: var(--radius-lg, 12px);
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .avatar-circle-lg {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--color-primary, #f97316);
          color: white;
          font-weight: 900;
          font-size: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 2px solid #fdba74;
        }

        .header-info h2 {
          margin: 0 0 4px 0;
          font-size: 20px;
          font-weight: 800;
        }

        .header-info p {
          margin: 0 0 10px 0;
          font-size: 13px;
          color: #bfdbfe;
        }

        .badge-role-header {
          background: #f59e0b;
          color: #1e293b;
          font-size: 10px;
          font-weight: 900;
          padding: 4px 10px;
          border-radius: 20px;
          letter-spacing: 0.03em;
        }

        .profile-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: var(--radius-lg, 12px);
          padding: 20px 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }

        .card-title {
          font-size: 12px;
          font-weight: 800;
          color: #1e3a8a;
          letter-spacing: 0.04em;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .grid-2-cols {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
        }

        .form-group input {
          padding: 10px 14px;
          border: 1px solid #dbeafe;
          background: #f0f9ff;
          border-radius: 8px;
          font-size: 13px;
          outline: none;
          color: #0f172a;
          min-height: 44px;
          transition: border-color 0.2s;
        }

        .form-group input:focus {
          border-color: var(--color-primary, #f97316);
          background: white;
        }

        .input-disabled-highlight {
          background: #f1f5f9 !important;
          color: #1e3a8a !important;
          font-weight: 800 !important;
          border-color: #cbd5e1 !important;
        }

        .input-password-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }

        .input-password-wrapper input {
          width: 100%;
          padding-right: 48px;
          background: white;
          border-color: #cbd5e1;
        }

        .pwd-toggle-btn {
          position: absolute;
          right: 4px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          padding: 8px;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.7;
        }

        .pwd-toggle-btn:hover {
          opacity: 1;
        }

        .btn-primary-blue {
          background: var(--color-secondary, #0f172a);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          min-height: 44px;
          transition: background 0.2s;
        }

        .btn-primary-blue:hover {
          background: #1e3a8a;
        }

        .btn-secondary-purple {
          background: #818cf8;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          min-height: 44px;
          transition: background 0.2s;
        }

        .btn-secondary-purple:hover {
          background: #6366f1;
        }

        .assigned-info-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #15803d;
          padding: 14px 18px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
        }

        @media (max-width: 767px) {
          .profile-header-card {
            flex-direction: column;
            text-align: center;
          }
        }
      </style>
    `,this._bindPasswordToggles(e),(A=e.querySelector("#form-profile-data"))==null||A.addEventListener("submit",async y=>{var p,f,g,s,h;if(y.preventDefault(),!((f=(p=this.auth)==null?void 0:p.can)!=null&&f.call(p,P.EDIT_OWN_PROFILE))){alert("⚠️ No tienes permiso para modificar este perfil.");return}const o=(g=e.querySelector("#input-profile-name"))==null?void 0:g.value.trim(),c=(s=e.querySelector("#input-profile-lastname"))==null?void 0:s.value.trim(),l=(h=e.querySelector("#input-profile-phone"))==null?void 0:h.value.trim();if(!o||!c){alert("⚠️ El nombre y los apellidos son obligatorios.");return}this.showSyncOverlay("💾 Guardando perfil en Supabase...");try{if(!u)throw new Error("Cliente Supabase no configurado");const{data:r,error:$}=await u.from("user_profiles").update({first_name:o,last_name:c,phone:l}).eq("email",n).select();if($){this.hideSyncOverlay(),alert(`❌ Error al actualizar perfil en Supabase: ${$.message}`);return}localStorage.setItem("iq_user_name",o),localStorage.setItem("iq_user_lastname",c),localStorage.setItem("iq_user_phone",l),r&&r.length>0&&(this.userProfile=r[0]),this.hideSyncOverlay(),alert("✅ Perfil guardado e integrado con éxito en la tabla 'user_profiles'."),await this.render(t)}catch(r){this.hideSyncOverlay(),console.error("Error guardando perfil:",r),alert(`❌ Error al conectar con Supabase: ${r.message}`)}}),(I=e.querySelector("#form-change-password"))==null||I.addEventListener("submit",async y=>{var l,p,f,g;if(y.preventDefault(),!((p=(l=this.auth)==null?void 0:l.can)!=null&&p.call(l,P.CHANGE_OWN_PASSWORD))){alert("⚠️ No tienes permiso para cambiar la contraseña.");return}const o=(f=e.querySelector("#input-new-password"))==null?void 0:f.value,c=(g=e.querySelector("#input-repeat-password"))==null?void 0:g.value;if(!o||!c){alert("⚠️ Por favor, introduce y repite la nueva contraseña.");return}if(o!==c){alert("❌ Las contraseñas no coinciden. Por favor, verifícalas.");return}if(o.length<6){alert("⚠️ La contraseña debe tener al menos 6 caracteres.");return}this.showSyncOverlay("🔒 Actualizando contraseña en Supabase Auth...");try{if(!u)throw new Error("Cliente Supabase no configurado");const{error:s}=await u.auth.updateUser({password:o});if(s){this.hideSyncOverlay(),alert(`❌ Error al cambiar la contraseña en Supabase Auth: ${s.message}`);return}this.hideSyncOverlay(),alert("🔑 Contraseña actualizada con éxito en tu cuenta de Supabase Auth.");const h=e.querySelector("#input-new-password"),r=e.querySelector("#input-repeat-password");h&&(h.value=""),r&&(r.value="")}catch(s){this.hideSyncOverlay(),console.error("Error actualizando contraseña:",s),alert(`❌ Error al conectar con Supabase Auth: ${s.message}`)}})}}export{R as ProfileView};
