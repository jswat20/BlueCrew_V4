import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";
import { processCommunicationEmails } from "../_shared/email-processor.mjs";
import { createStagingSinkAdapter } from "../_shared/staging-sink-adapter.mjs";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
});

Deno.serve(async request => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authorization = request.headers.get("Authorization") || "";
  const url = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!authorization || !url || !publishableKey || !serviceKey) return json({ error: "unauthorized" }, 401);
  if (!url.includes("fdjhwxmphdzodxvhrblk.supabase.co")) return json({ error: "staging_project_required" }, 503);

  const userClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: organizationId, error: authorizationError } = await userClient.rpc("authorize_staging_email_sink");
  if (authorizationError || !organizationId) return json({ error: "workspace_administrator_required" }, 403);

  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const store = {
    async claim(limit: number) {
      const { data, error } = await serviceClient.rpc("claim_staging_email_deliveries", {
        p_organization_id: organizationId,p_limit: limit,p_lease_seconds: 120
      });
      if (error) throw error;
      return data || [];
    },
    async beginAttempt(id: string, token: string) {
      const { data, error } = await serviceClient.rpc("begin_communication_email_attempt", {
        p_delivery_id: id,p_lease_token: token
      });
      if (error) throw error;
      return data === true;
    },
    async complete(id: string, token: string, result: Record<string, unknown>) {
      const { error } = await serviceClient.rpc("complete_communication_email_delivery", {
        p_delivery_id: id,p_lease_token: token,p_sent: result.success === true,
        p_provider_message_id: result.providerMessageId || null,p_retryable: result.retryable === true,
        p_failure_code: result.failureCode || null,p_failure_message: result.failureMessage || null
      });
      if (error) throw error;
    }
  };
  const provider = createStagingSinkAdapter({
    capture: async ({ idempotencyKey, subject }) => {
      const { data, error } = await serviceClient.rpc("record_staging_email_capture", {
        p_idempotency_key: idempotencyKey,p_subject: subject
      });
      if (error) throw error;
      return data;
    }
  });
  try {
    return json(await processCommunicationEmails({
      store,provider,appUrl: "https://the-slate-v2.pages.dev",limit: 10
    }));
  } catch {
    return json({ error: "staging_sink_failed" }, 500);
  }
});
