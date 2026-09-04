/**
 * @fileoverview Controlador de autenticación compatible con el RBAC v2.
 * @description Encapsula Supabase Auth y delega toda autorización en PermissionService.
 */

import { supabase as defaultSupabase } from "../config/database.config.js";
import {
  PermissionService,
  Permission,
  UserRole,
  UNIQUE_SUPERADMIN_EMAIL
} from "../security/PermissionService.js";
import { AccountStatusService } from "../services/security/AccountStatusService.js";

export { UserRole, Permission, UNIQUE_SUPERADMIN_EMAIL };

export class AuthController extends PermissionService {
  constructor(supabaseClient = defaultSupabase) {
    super();
    this.supabase = supabaseClient?.auth ? supabaseClient : defaultSupabase;
    this.accountStatusService = new AccountStatusService(this.supabase);
  }

  async _fetchProfile(email) {
    if (!this.supabase || !email) return null;
    const { data, error } = await this.supabase
      .from("user_profiles")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.warn("[AuthController] No se pudo cargar user_profiles:", error.message);
      return null;
    }
    return data || null;
  }

  async login(email, password) {
    try {
      if (!this.supabase) throw new Error("Supabase no configurado");

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: String(email || "").trim(),
        password
      });

      if (error || !data?.user) {
        return { success: false, error: error?.message || "Credenciales no válidas." };
      }

      const [profile, accountState] = await Promise.all([
        this._fetchProfile(data.user.email),
        this.accountStatusService.getCurrentState()
      ]);
      const user = this.setCurrentUser({
        ...(profile || {}),
        id: data.user.id,
        email: data.user.email,
        role: profile?.role || data.user.user_metadata?.role || UserRole.INVITADO,
        first_name: profile?.first_name || data.user.user_metadata?.first_name || "",
        last_name: profile?.last_name || data.user.user_metadata?.last_name || "",
        account_status: accountState.accountStatus
      });

      if (!accountState.active || !this.isAccountActive()) {
        await this.supabase.auth.signOut({ scope: "local" });
        this.clear();
        return {
          success: false,
          error: "ACCOUNT_NOT_ACTIVE",
          code: "ACCOUNT_NOT_ACTIVE",
          accountStatus: accountState.accountStatus
        };
      }

      return { success: true, user };
    } catch (err) {
      return { success: false, error: err.message || String(err) };
    }
  }

  async register(email, password, metadata = {}) {
    try {
      if (!this.supabase) throw new Error("Supabase no configurado");

      // El registro público siempre nace como INVITADO.
      const safeMetadata = {
        ...metadata,
        role: UserRole.INVITADO
      };

      const { data, error } = await this.supabase.auth.signUp({
        email: String(email || "").trim(),
        password,
        options: { data: safeMetadata }
      });

      if (error || !data?.user) {
        return { success: false, error: error?.message || "No se pudo crear la cuenta." };
      }

      const accountState = await this.accountStatusService.getCurrentState();
      const user = this.setCurrentUser({
        id: data.user.id,
        email: data.user.email,
        role: UserRole.INVITADO,
        first_name: safeMetadata.first_name || "",
        last_name: safeMetadata.last_name || "",
        account_status: accountState.accountStatus
      });

      if (!accountState.active || !this.isAccountActive()) {
        await this.supabase.auth.signOut({ scope: "local" });
        this.clear();
        return { success: false, error: "ACCOUNT_NOT_ACTIVE", code: "ACCOUNT_NOT_ACTIVE", accountStatus: accountState.accountStatus };
      }

      return { success: true, user };
    } catch (err) {
      return { success: false, error: err.message || String(err) };
    }
  }

  async restoreSession() {
    try {
      if (!this.supabase) return null;
      const { data, error } = await this.supabase.auth.getSession();
      if (error || !data?.session?.user) return null;

      const authUser = data.session.user;
      const [profile, accountState] = await Promise.all([
        this._fetchProfile(authUser.email),
        this.accountStatusService.getCurrentState()
      ]);
      const user = this.setCurrentUser({
        ...(profile || {}),
        id: authUser.id,
        email: authUser.email,
        role: profile?.role || authUser.user_metadata?.role || UserRole.INVITADO,
        account_status: accountState.accountStatus
      });
      if (!accountState.active || !this.isAccountActive()) {
        await this.supabase.auth.signOut({ scope: "local" });
        this.clear();
        return null;
      }
      return user;
    } catch (err) {
      console.warn("[AuthController] No se pudo restaurar la sesión:", err);
      return null;
    }
  }

  async logout() {
    try {
      if (this.supabase) await this.supabase.auth.signOut();
    } finally {
      this.clear();
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("iq_user_role");
        localStorage.removeItem("iq_simulated_role");
      }
    }
  }

  canApproveChangeRequest(changeRequest) {
    if (!changeRequest) return false;
    return this.can(Permission.APPROVE_TEAM_ACCESS, {
      clubId: changeRequest.club_id || changeRequest.clubId || null,
      teamId: changeRequest.team_id || changeRequest.teamId || null
    });
  }
}

export default AuthController;
