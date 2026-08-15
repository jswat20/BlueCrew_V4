import { test, expect } from "@playwright/test";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/202608130001_public_umpire_registration_and_approval.sql", "utf8");
const identityOrderFix = fs.readFileSync("supabase/migrations/202608130002_approval_identity_link_order.sql", "utf8");
const rls = fs.readFileSync("supabase/migrations/202608040002_rls.sql", "utf8");

test("public provisioning is verified, server-selects one active organization, and forces pending umpire", () => {
  const signature = migration.slice(migration.indexOf("create or replace function public.provision_public_pending_umpire"), migration.indexOf("returns public.profiles"));
  expect(migration).toContain("email_confirmed_at is null");
  expect(migration).toContain("from public.organizations where active = true");
  expect(migration).toContain("eligible_organization_count <> 1");
  expect(migration).toContain("eligible_organization_id, auth.uid(), 'umpire', 'pending'");
  expect(signature).not.toMatch(/p_(organization|role|status|crew)/);
});

test("one-click approval is administrator-only, organization-scoped, email-exact, and atomic", () => {
  expect(migration).toContain("if not public.is_administrator()");
  expect(migration).toContain("organization_id = administrator_organization_id for update");
  expect(migration).toContain("target_profile.role <> 'umpire' or target_profile.status <> 'pending'");
  expect(migration).toContain("lower(btrim(email)) = normalized_verified_email");
  expect(migration).toContain("crew_email_match_ambiguous");
  expect(migration).toContain("crew_email_match_already_linked");
  expect(migration).toContain("crew_email_match_inactive");
  expect(migration).toContain("insert into public.crew_members");
  expect(migration).toContain("enqueue_communication_event");
});

test("approved-account RLS gates normal organization data for pending identities", () => {
  for (const table of ["organizations", "seasons", "crew_members", "games", "assignment_claims", "availability", "notifications"]) {
    expect(rls).toContain(`on public.${table}`);
  }
  expect(rls).toContain("select role from public.profiles\n  where auth_user_id = auth.uid() and status = 'approved'");
  expect(rls).toContain("public.is_approved_account()");
});

test("rejection uses the existing account-rejected communication event", () => {
  expect(migration).toContain("p_type => 'account-rejected'");
  expect(migration).toContain("p_channels => array['email']::public.communication_channel[]");
});

test("approval establishes approved identity status before linking or creating Crew", () => {
  const profileApproval = identityOrderFix.indexOf("update public.profiles set status = 'approved'");
  const crewInsert = identityOrderFix.indexOf("insert into public.crew_members");
  const crewLink = identityOrderFix.indexOf("update public.crew_members set profile_id");

  expect(profileApproval).toBeGreaterThan(-1);
  expect(profileApproval).toBeLessThan(crewInsert);
  expect(profileApproval).toBeLessThan(crewLink);
});

test("identity-link ordering fix retains fail-closed identity and authorization guards", () => {
  expect(identityOrderFix).toContain("if not public.is_administrator()");
  expect(identityOrderFix).toContain("organization_id = administrator_organization_id for update");
  expect(identityOrderFix).toContain("target_profile.role <> 'umpire' or target_profile.status <> 'pending'");
  expect(identityOrderFix).toContain("verified_auth_identity_required");
  expect(identityOrderFix).toContain("verified_email_identity_conflict");
  expect(identityOrderFix).toContain("crew_email_match_ambiguous");
  expect(identityOrderFix).toContain("crew_email_match_already_linked");
  expect(identityOrderFix).toContain("crew_email_match_inactive");
});
