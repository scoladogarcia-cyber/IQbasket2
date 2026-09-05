/**
 * @fileoverview Superadmin business metrics boundary.
 * @description Reads aggregate first-party product analytics through a secured RPC.
 */
export class BusinessMetricsService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  async getMetrics(days = 30) {
    if (!this.supabase || typeof this.supabase.rpc !== "function") {
      throw new Error("BusinessMetricsService: cliente de datos no disponible.");
    }
    const windowDays = Math.max(1, Math.min(366, Number(days) || 30));
    const { data, error } = await this.supabase.rpc("iq_v9_product_metrics", {
      p_days: windowDays
    });
    if (error) throw error;
    return data || {};
  }
}

export default BusinessMetricsService;
