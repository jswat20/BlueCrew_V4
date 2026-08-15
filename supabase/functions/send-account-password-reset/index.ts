import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
function response(status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }); }

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return response(405, { error: "Method not allowed." });
  const authorization = request.headers.get("Authorization") || "";
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!authorization || !url || !serviceKey || !publishableKey) return response(401, { error: "Unauthorized." });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const token = authorization.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return response(401, { error: "Unauthorized." });
  const { profileId, crewMemberId, redirectTo } = await request.json().catch(() => ({}));
  if ((!profileId && !crewMemberId) || !redirectTo || !/^https?:\/\//i.test(String(redirectTo))) return response(400, { error: "Invalid reset request." });
  const { data: actor, error: actorError } = await admin.from("profiles").select("id,organization_id,role,status").eq("auth_user_id", userData.user.id).maybeSingle();
  if (actorError) return response(500, { error: "Administrator profile lookup failed." });
  if (!actor || actor.role !== "administrator" || actor.status !== "approved") return response(403, { error: "Administrator access is required." });
  let resolvedProfileId = profileId;
  let resolvedCrewMemberId = crewMemberId || null;
  if (!resolvedProfileId && crewMemberId) {
    const { data: crew } = await admin.from("crew_members").select("profile_id,organization_id,active").eq("id", crewMemberId).eq("organization_id", actor.organization_id).maybeSingle();
    if (!crew?.active) return response(409, { error: "This crew member's login identity needs review before a password reset can be sent." });
    resolvedProfileId = crew?.profile_id || null;
  }
  if (!resolvedProfileId) return response(409, { error: "This crew member's login identity needs review before a password reset can be sent." });
  const { data: target } = await admin.from("profiles").select("id,auth_user_id,organization_id,email,role,status").eq("id", resolvedProfileId).eq("organization_id", actor.organization_id).maybeSingle();
  if (!target?.auth_user_id || target.role !== "umpire" || target.status !== "approved") return response(409, { error: "This crew member's login identity needs review before a password reset can be sent." });
  const { data: links } = await admin.from("crew_members").select("id,organization_id,active").eq("profile_id", target.id);
  if (!links || links.length !== 1 || links[0].organization_id !== actor.organization_id || !links[0].active) return response(409, { error: "This crew member's login identity needs review before a password reset can be sent." });
  if (resolvedCrewMemberId && links[0].id !== resolvedCrewMemberId) return response(409, { error: "This crew member's login identity needs review before a password reset can be sent." });
  resolvedCrewMemberId = links[0].id;
  const { data: authTarget, error: authError } = await admin.auth.admin.getUserById(target.auth_user_id);
  if (authError || !authTarget.user?.email || authTarget.user.email.toLowerCase() !== target.email.toLowerCase()) return response(409, { error: "This crew member's login identity needs review before a password reset can be sent." });
  const authClient = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { error } = await authClient.auth.resetPasswordForEmail(authTarget.user.email, { redirectTo: String(redirectTo) });
  if (error) return response(error.status && error.status >= 400 ? error.status : 500, { error: "Password reset could not be sent." });
  return response(200, { message: "If an account exists for that email, a password reset link has been sent." });
});
