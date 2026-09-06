/**
 * @fileoverview SUPERADMIN Early Access feedback triage client boundary.
 * @description Uses narrow V20 RPCs only. Direct product_feedback table access is intentionally forbidden.
 */
const STATUSES = new Set(["NEW","REVIEWING","PLANNED","RESOLVED","DISMISSED"]);

function requireClient(client) {
  if (!client || typeof client.rpc !== "function") throw new Error("PRODUCT_FEEDBACK_BACKEND_UNAVAILABLE");
}
function uuid(value) {
  const normalized=String(value||"").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error("PRODUCT_FEEDBACK_ID_REQUIRED");
  }
  return normalized;
}
function status(value,{ optional=false }={}) {
  const normalized=String(value||"").trim().toUpperCase();
  if (optional && !normalized) return null;
  if (!STATUSES.has(normalized)) throw new Error("PRODUCT_FEEDBACK_STATUS_INVALID");
  return normalized;
}

export class ProductFeedbackService {
  constructor(supabaseClient=null) {
    this.supabase=supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }
  async list({ status: filterStatus=null, limit=100 }={}) {
    requireClient(this.supabase);
    const { data,error }=await this.supabase.rpc("iq_v20_list_product_feedback",{
      p_status:status(filterStatus,{ optional:true }),
      p_limit:Math.max(1,Math.min(Number(limit)||100,300))
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }
  async review({ feedbackId, status: nextStatus, note=null }={}) {
    requireClient(this.supabase);
    const normalizedNote=String(note||"").trim().slice(0,2000) || null;
    const normalizedStatus=status(nextStatus);
    if (normalizedStatus==="DISMISSED" && !normalizedNote) {
      throw new Error("PRODUCT_FEEDBACK_DISMISS_NOTE_REQUIRED");
    }
    const { data,error }=await this.supabase.rpc("iq_v20_review_product_feedback",{
      p_feedback_id:uuid(feedbackId),
      p_status:normalizedStatus,
      p_note:normalizedNote
    });
    if (error) throw error;
    return Boolean(data);
  }
}

export default ProductFeedbackService;
