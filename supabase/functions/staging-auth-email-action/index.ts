import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.2";

const STAGING_REF = "fdjhwxmphdzodxvhrblk";
const STAGING_ORIGIN = "https://the-slate-v2.pages.dev";

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return response(405, { error: "Method not allowed." });
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authorization = request.headers.get("Authorization") || "";
  if (supabaseUrl !== `https://${STAGING_REF}.supabase.co` || !serviceRoleKey || !authorization) {
    return response(503, { error: "Staging Auth capture is unavailable." });
  }

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error: authorizationError } = await userClient.rpc("authorize_staging_auth_email_operator");
  if (authorizationError) return response(403, { error: "Workspace administrator access is required." });
  const { data: operatorData, error: operatorError } = await userClient.auth.getUser();
  const operator = operatorData?.user;
  if (operatorError || !operator?.id) return response(401, { error: "A valid operator session is required." });

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const actionType = String(body.actionType || "").trim();
  if (!email.endsWith("@slate.invalid") || !["signup", "recovery"].includes(actionType)) {
    return response(400, { error: "An approved synthetic recipient and action are required." });
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await service.rpc("claim_staging_auth_email_action", {
    p_recipient_email: email,
    p_action_type: actionType,
    p_claimed_by_auth_user_id: operator.id
  });
  const capture = Array.isArray(data) ? data[0] : null;
  if (error || !capture?.token_hash) return response(404, { error: "No unexpired Auth action is available." });

  const verifyUrl = new URL(`${supabaseUrl}/auth/v1/verify`);
  verifyUrl.searchParams.set("token", capture.token_hash);
  verifyUrl.searchParams.set("type", actionType);
  verifyUrl.searchParams.set("redirect_to", `${STAGING_ORIGIN}/`);
  return response(200, { actionUrl: verifyUrl.toString() });
});
