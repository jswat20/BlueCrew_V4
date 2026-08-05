# Bootstrap and registration boundary

Milestone 2A defines this boundary but does not expose it to production JavaScript.

## Trusted first-organization bootstrap

The first organization and administrator must be created by a trusted operator using the Supabase SQL editor, CLI migration identity, or a server-side administrative tool. A browser must never receive the service-role key.

The bootstrap operation must run as one transaction and:

1. create the organization and initial season;
2. create or select one email-verified Supabase Auth user;
3. create that user's `profiles` row with role `administrator`, status `approved`, and matching `approved_at`;
4. record an auditable bootstrap/migration result.

It must abort on an existing organization slug, an Auth user already attached to another profile, or an email collision within the organization. Re-running against the same organization/user may report the existing completed bootstrap, but must not create a second administrator silently.

## Controlled umpire registration

Milestone 2B should implement one authenticated, `security definer` provisioning RPC after Supabase Auth signup and email verification. The RPC must validate an organization-issued, expiring, single-use invitation or registration code; derive the organization on the server; force role `umpire` and status `pending`; and create only the caller's profile. Raw anonymous or authenticated profile inserts remain unavailable.

Duplicate behavior is explicit:

- Supabase Auth owns duplicate-email handling.
- The profile schema permits one profile per Auth user and one case-insensitive email per organization.
- A retry for the same Auth user and organization returns the existing pending profile.
- A request that would attach the Auth user to a different organization or elevated role is rejected.

Administrator approval changes the profile to `approved` and links it to the intended crew member in one transaction. Invitation storage, hashing, expiry, consumption, and the provisioning/approval RPCs belong in the reviewed Milestone 2B migration.

## Parent-managed credentials

No `parent` role is introduced. For the controlled pilot, a parent may manage the email/password for a junior umpire, but the authenticated application identity and profile remain the umpire's and receive only umpire permissions. A guardian relationship or public schedule is a separate post-pilot decision.
