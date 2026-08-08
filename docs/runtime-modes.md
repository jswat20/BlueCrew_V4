# Runtime modes

The pilot/manual hosted origin is `http://127.0.0.1:5500`.

- `npm start` and `npm run start:hosted` require `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. They fail before starting the server when either value is missing or invalid.
- `npm run start:local` explicitly enables local/demo mode on `http://127.0.0.1:5500`.
- Playwright uses its isolated explicit-local server at `http://127.0.0.1:5501`. It serves runtime configuration in memory and never writes `config/supabase.js`.

Do not use `localhost` for pilot sessions. Keeping one canonical hostname prevents separate browser storage and Supabase session state across origins.

To restart the hosted pilot app, stop the process listening on port 5500, set the two public Supabase environment variables in that shell, and run `npm run start:hosted`. A missing hosted configuration displays a blocking error and never initializes local schedule, crew, account, or demo identity state.
