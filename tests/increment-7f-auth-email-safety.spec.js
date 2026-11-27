const { test, expect } = require("@playwright/test");
const { readFileSync } = require("node:fs");

const migration = readFileSync("supabase/migrations/20261127203712_staging_auth_email_capture.sql","utf8");
const edge = readFileSync("supabase/functions/staging-auth-email-action/index.ts","utf8");
const service = readFileSync("js/services/stagingAuthEmailService.js","utf8");
const passwordService = readFileSync("js/services/passwordSecurityService.js","utf8");
const settings = readFileSync("components/settings.js","utf8");
const repository = readFileSync("js/repositories/supabaseSharedRepository.js","utf8");
const advisorMigration = readFileSync("supabase/migrations/20261127204102_index_staging_auth_capture_operator.sql","utf8");
const operatorMigration = readFileSync("supabase/migrations/20261127204252_restrict_staging_auth_email_operators.sql","utf8");
const redirectMigration = readFileSync("supabase/migrations/20261127210127_diagnose_staging_auth_redirect_boundary.sql","utf8");
const redirectPathMigration = readFileSync("supabase/migrations/20261127210209_allow_staging_auth_redirect_paths.sql","utf8");
const urlOriginMigration = readFileSync("supabase/migrations/20261127210247_validate_staging_auth_url_origins.sql","utf8");
const destinationMigration = readFileSync("supabase/migrations/20261127210342_enforce_staging_auth_action_destination.sql","utf8");
const cryptoGrantMigration = readFileSync("supabase/migrations/20261127210432_grant_auth_hook_crypto_execution.sql","utf8");
const cryptoIsolationMigration = readFileSync("supabase/migrations/20261127212251_isolate_staging_auth_hook_crypto.sql","utf8");
const cryptoCallerMigration = readFileSync("supabase/migrations/20261127213231_fix_staging_auth_crypto_caller_check.sql","utf8");

test("Auth hook is private, non-delivering, and restricted to the Auth service", () => {
  expect(migration).toContain("private.staging_auth_send_email_hook(event jsonb)");
  expect(migration).toContain("current_user<>'supabase_auth_admin'");
  expect(migration).toMatch(/revoke all on function private\.staging_auth_send_email_hook\(jsonb\) from public,anon,authenticated/);
  expect(migration).toMatch(/grant execute on function private\.staging_auth_send_email_hook\(jsonb\) to supabase_auth_admin/);
  expect(migration).not.toMatch(/api\.resend\.com|smtp_|http_post|net\.http/i);
});

test("Auth hook rejects external recipients and non-staging redirects", () => {
  expect(migration).toContain("v_email not like '%@slate.invalid'");
  expect(migration).toContain("staging_auth_recipient_not_allowed");
  expect(migration).toContain("staging_auth_redirect_not_allowed");
  expect(migration).toContain("v_site_url<>'https://the-slate-v2.pages.dev'");
  expect(migration).toContain("staging_auth_email_change_disabled");
  expect(redirectMigration).toContain("staging_auth_site_url_not_allowed");
  expect(redirectMigration).toContain("staging_auth_redirect_not_allowed");
  expect(redirectMigration).not.toMatch(/raise exception[^;]+v_(site_url|redirect)/i);
  expect(redirectPathMigration).toContain("^https://the-slate-v2[.]pages[.]dev([/?#].*)?$");
  expect(urlOriginMigration.match(/\^https:\/\/the-slate-v2\[\.\]pages\[\.\]dev/g)).toHaveLength(2);
  expect(destinationMigration).toContain("coalesce(nullif(event->'email_data'->>'redirect_to',''),event->'email_data'->>'site_url','')");
  expect(destinationMigration).toContain("staging_auth_redirect_not_allowed");
  expect(cryptoGrantMigration).toContain("extensions.pgp_sym_encrypt(text,text,text) to supabase_auth_admin");
  expect(cryptoGrantMigration).not.toContain("pgp_sym_decrypt");
  expect(cryptoIsolationMigration).toContain("private.encrypt_staging_auth_token(v_token_hash)");
  expect(cryptoIsolationMigration).toContain("revoke select on table private.staging_auth_email_capture_keys");
  expect(cryptoIsolationMigration).toContain("revoke usage on schema extensions from supabase_auth_admin");
  expect(cryptoIsolationMigration).not.toMatch(/grant execute[^;]+pgp_sym_decrypt/i);
  expect(cryptoCallerMigration).toContain("security definer");
  expect(cryptoCallerMigration).toContain("grant execute on function private.encrypt_staging_auth_token(text)");
  expect(cryptoCallerMigration).not.toContain("current_user<>'supabase_auth_admin'");
});

test("temporary capture stores no body, OTP, action URL, or plaintext token hash", () => {
  expect(migration).toContain("encrypted_token_hash bytea");
  expect(migration).toContain("pgp_sym_encrypt");
  expect(migration).toContain("interval '15 minutes'");
  expect(migration).not.toMatch(/^\s*(message_body|email_body|html_body|action_url|otp|plaintext_token_hash)\s+/im);
  expect(migration).toContain("claimed_at is null and expires_at>clock_timestamp()");
  expect(advisorMigration).toContain("staging_auth_email_captures(claimed_by_auth_user_id)");
});

test("operator action is admin-authorized and hard-bound to staging", () => {
  expect(edge).toContain('const STAGING_REF = "fdjhwxmphdzodxvhrblk"');
  expect(edge).toContain('const STAGING_ORIGIN = "https://the-slate-v2.pages.dev"');
  expect(edge).toContain('"Access-Control-Allow-Origin": STAGING_ORIGIN');
  expect(edge).toContain('request.method === "OPTIONS"');
  expect(edge).toContain('request.headers.get("Origin") !== STAGING_ORIGIN');
  expect(edge).toContain('rpc("authorize_staging_auth_email_operator")');
  expect(edge).toContain("auth.getUser()");
  expect(edge).toContain("p_claimed_by_auth_user_id: operator.id");
  expect(edge).toContain('rpc("claim_staging_auth_email_action"');
  expect(edge).toContain('"Cache-Control": "no-store"');
  expect(edge).not.toContain("console.log");
  expect(edge).not.toMatch(/RESEND|SMTP|api\.resend\.com/);
  expect(operatorMigration).toContain("private.staging_auth_email_operators");
  expect(operatorMigration).toContain("private.assert_staging_auth_email_operator()");
  expect(operatorMigration).toContain("staging_auth_operator_forbidden");
});

test("browser validates the one-time action URL before navigation", () => {
  expect(service).toContain('normalizedEmail.endsWith("@slate.invalid")');
  expect(service).toContain('actionUrl.host !== STAGING_HOST');
  expect(service).toContain('actionUrl.pathname !== "/auth/v1/verify"');
  expect(service).toContain('window.location.assign(actionUrl.toString())');
  expect(settings).toContain('role="alert" tabindex="-1" data-testid="staging-auth-email-error"');
});

test("hosted recovery uses the deployed origin instead of a fixed production URL", () => {
  expect(passwordService).toContain('return `${window.location.origin}/`');
  expect(passwordService).not.toContain("https://app.worktheslate.com/");
});

test("newly issued JWT clock skew is retried once without masking other errors", () => {
  expect(repository).toContain("FRESH_JWT_RETRY_DELAY_MS = 300");
  expect(repository).toContain("/jwt issued at future/i.test(result.error?.message || \"\")");
  expect(repository.match(/result = await db\.rpc\(functionName, parameters\)/g)).toHaveLength(2);
  expect(repository).toContain('rpcWithFreshJwtRetry("get_authorized_workspaces")');
  expect(repository).toContain('rpcWithFreshJwtRetry("get_active_profile")');
});

test("application email sink remains separate", () => {
  const appSink = readFileSync("supabase/functions/staging-email-sink/index.ts","utf8");
  expect(appSink).toContain("claim_staging_email_deliveries");
  expect(appSink).not.toContain("claim_staging_auth_email_action");
  expect(migration).not.toContain("communication_deliveries");
});
