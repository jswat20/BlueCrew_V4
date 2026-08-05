# Supabase Auth configuration for Milestone 2B

These settings apply to the staging project first. Production remains out of scope.

## Dashboard configuration

1. Enable the Email provider under Authentication > Providers.
2. Require email confirmation. Do not enable anonymous sign-ins.
3. Set the staging Site URL to the eventual Cloudflare staging origin.
4. Add only controlled local and Cloudflare staging callback URLs to the redirect allow list.
5. Keep user self-registration enabled; profile provisioning remains blocked until the authenticated user calls `provision_pending_umpire` with a valid invitation.
6. Configure an application-specific SMTP provider before pilot invitations. Default development email delivery is not a pilot dependency.
7. Keep leaked-password protection and the strongest available password policy enabled.

The browser receives only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Database passwords, service-role keys, management tokens, and JWT signing material remain outside Cloudflare browser output.

## Generated static configuration

Run this before serving or building the unbundled static application:

```powershell
npm.cmd run generate:supabase-config
```

It creates ignored `config/supabase.js`. Local Playwright startup creates a disabled version when the environment values are absent. A partial, malformed, or secret-key configuration fails generation.

## Trusted bootstrap

Create and verify the first administrator Auth user in the Supabase dashboard. Then invoke `bootstrap_organization` from the SQL editor as the database owner, or through a trusted server-side service-role client. The function atomically creates the organization, first approved administrator profile, active season, and migration audit record.

Never call bootstrap from browser JavaScript. A duplicate slug, Auth profile, active-season conflict, or unverified administrator aborts the transaction.

## Registration and approval

1. An approved administrator creates a high-entropy invitation through `accountService.createRegistrationInvitation`.
2. The umpire signs up with email/password and verifies that email.
3. `accountService.registerAuthenticatedAccount` calls the controlled provisioning RPC. The server derives email and organization and forces role `umpire`, status `pending`.
4. An administrator calls `accountService.approveAuthenticatedAccount`, which atomically approves the profile, links the selected crew member, creates the notification, and appends activity.
5. Only an approved profile can establish an application login.

One Auth account maps to one umpire profile. A parent may control those credentials for a junior umpire, but no parent or guardian authorization role exists.
