# Bootstrap and registration boundary

Milestone 2B implements this boundary without exposing privileged credentials to browser JavaScript.

## Trusted first-organization bootstrap

The first organization and administrator must be created by a trusted operator using the Supabase SQL editor, CLI migration identity, or a server-side administrative tool. A browser must never receive the service-role key.

The bootstrap operation must run as one transaction and:

1. create the organization and initial season;
2. create or select one email-verified Supabase Auth user;
3. create that user's `profiles` row with role `administrator`, status `approved`, and matching `approved_at`;
4. record an auditable bootstrap/migration result.

It must abort on an existing organization slug, an Auth user already attached to another profile, or an email collision within the organization. Re-running against the same organization/user may report the existing completed bootstrap, but must not create a second administrator silently.

## Public umpire registration with controlled approval

`provision_public_pending_umpire` is the authenticated, `security definer` provisioning RPC used by ordinary umpire registration after Supabase Auth signup and email verification. The server selects the sole active pilot organization and fails closed unless exactly one exists. It forces role `umpire` and status `pending` and creates only the caller's profile. Raw anonymous or authenticated profile inserts remain unavailable. The browser cannot submit organization, role, status, or Crew identity.

Duplicate behavior is explicit:

- Supabase Auth owns duplicate-email handling.
- The profile schema permits one profile per Auth user and one case-insensitive email per organization.
- A retry for the same Auth user and organization returns the existing pending profile.
- A request that would attach the Auth user to a different organization or elevated role is rejected.

`approve_pending_umpire` requires a same-organization administrator and performs Crew matching/creation, profile linkage, approval, notification, communication enqueue, and audit activity in one transaction. It matches only one active, unlinked Crew record with the exact normalized verified email. Ambiguous, inactive, or already-linked matches fail closed. With no match, it creates a Crew record from the pending profile.

The earlier invitation functions and digest-backed invitation table remain available for compatibility, but ordinary public umpire registration no longer requests or consumes an invitation code.

## Parent-managed credentials

No `parent` role is introduced. For the controlled pilot, a parent may manage the email/password for a junior umpire, but the authenticated application identity and profile remain the umpire's and receive only umpire permissions. A guardian relationship or public schedule is a separate post-pilot decision.
