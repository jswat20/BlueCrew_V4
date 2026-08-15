# Supabase environment contract

Milestone 2A defines configuration only. Production JavaScript does not load or connect to Supabase yet.

## Public client values

The future static client requires exactly these public values:

- `SUPABASE_URL`: the HTTPS project URL.
- `SUPABASE_PUBLISHABLE_KEY`: the browser-safe publishable key (or legacy anon key during a controlled transition).

Cloudflare Pages should provide these at build/config generation time. This repository must never contain a real project URL tied to private operations, a secret key, a service-role key, database credentials, JWT signing secrets, or management API tokens.

Because the current application is served as unbundled static JavaScript, `.env` is not read by the browser. The selected pilot approach is an ignored, generated `config/supabase.js`: the Cloudflare Pages build command will render only the two public values from deployment environment variables. This avoids introducing a bundler solely for configuration. Milestone 2B may add the generator and runtime import after review. The committed `.env.example` is documentation, not runtime configuration.

## Required deployment separation

Use separate Supabase projects for local/test, staging, and production. Configure allowed Auth redirect URLs independently. Browser code may use only the publishable key and must rely on RLS. Administrative provisioning and migrations must run outside the browser.

## Credential controls

- `.env`, `.env.*`, `config/supabase.js`, and Supabase CLI temporary state are ignored.
- `.env.example` contains placeholders only.
- CI should scan for `service_role`, database URLs containing passwords, and JWT secrets before deployment.
- Key rotation and incident response remain project-operations responsibilities.

## Milestone 2B configuration acceptance

- Missing or malformed public values must fail startup with a configuration error, not fall back to local persistence.
- Local, staging, and production generated files must be distinct and untracked.
- No configuration path may accept a service-role key in browser code.
- Cloudflare preview deployments must target staging, never production, unless explicitly promoted.
