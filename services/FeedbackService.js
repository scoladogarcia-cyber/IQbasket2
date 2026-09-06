/**
 * @fileoverview Early-access product feedback service.
 * @description RPC-only client boundary. The backend remains authoritative for identity and role provenance.
 */
export class FeedbackService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async submit({ category, severity, message, route, releaseCode, clientContext = {} }) {
    const { data, error } = await this.supabase.rpc('iq_v19_submit_product_feedback', {
      p_category: category,
      p_severity: severity,
      p_message: message,
      p_route: route || null,
      p_release_code: releaseCode || null,
      p_client_context: clientContext
    });
    if (error) throw error;
    return data;
  }
}

export default FeedbackService;
