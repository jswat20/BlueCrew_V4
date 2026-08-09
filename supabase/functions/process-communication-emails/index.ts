import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createResendAdapter } from "../_shared/resend-adapter.mjs";
import { processCommunicationEmails } from "../_shared/email-processor.mjs";
import { resolveSlateEmailFrom } from "../_shared/email-worker-config.mjs";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async request => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const workerSecret = Deno.env.get("COMMUNICATION_WORKER_SECRET") || "";
  if (!workerSecret || request.headers.get("Authorization") !== `Bearer ${workerSecret}`) return json({ error: "unauthorized" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""; const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  if (!supabaseUrl || !serviceKey || !resendKey) return json({ error: "worker_not_configured" }, 503);
  let from = "";
  try { from = resolveSlateEmailFrom(Deno.env.get("SLATE_EMAIL_FROM")); }
  catch { return json({ error: "worker_sender_not_configured" }, 503); }
  const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const store = {
    async claim(limit: number) { const { data, error } = await client.rpc("claim_communication_email_deliveries", { p_limit: limit, p_lease_seconds: 120 }); if (error) throw error; return data || []; },
    async beginAttempt(id: string, token: string) { const { data, error } = await client.rpc("begin_communication_email_attempt", { p_delivery_id: id, p_lease_token: token }); if (error) throw error; return data === true; },
    async complete(id: string, token: string, result: Record<string, unknown>) { const { error } = await client.rpc("complete_communication_email_delivery", { p_delivery_id: id, p_lease_token: token, p_sent: result.success === true, p_provider_message_id: result.providerMessageId || null, p_retryable: result.retryable === true, p_failure_code: result.failureCode || null, p_failure_message: result.failureMessage || null }); if (error) throw error; }
  };
  try {
    const provider = createResendAdapter({ apiKey: resendKey, from, replyTo: Deno.env.get("SLATE_EMAIL_REPLY_TO") || "" });
    const summary = await processCommunicationEmails({ store, provider, appUrl: Deno.env.get("SLATE_APP_URL") || "" });
    return json(summary);
  } catch { return json({ error: "worker_failed" }, 500); }
});
