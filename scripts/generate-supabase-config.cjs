const fs = require("node:fs");
const path = require("node:path");

const outputPath = path.resolve(__dirname, "..", "config", "supabase.js");
const url = String(process.env.SUPABASE_URL || "").trim();
const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();
const optional = process.argv.includes("--optional");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

if ((!url || !publishableKey) && !optional) {
  fail("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.");
}

if ((url && !publishableKey) || (!url && publishableKey)) {
  fail("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be provided together.");
}

if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
  fail("SUPABASE_URL must be an HTTPS Supabase project URL.");
}

if (/service[_-]?role|sb_secret_/i.test(publishableKey)) {
  fail("A secret or service-role key cannot be written to browser configuration.");
}

if (publishableKey && !/^[A-Za-z0-9._-]+$/.test(publishableKey)) {
  fail("SUPABASE_PUBLISHABLE_KEY contains unexpected characters.");
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `window.BLUECREW_SUPABASE_CONFIG = window.BLUECREW_SUPABASE_CONFIG || Object.freeze(${JSON.stringify({
    url,
    publishableKey
  })});\n`,
  "utf8"
);

process.stdout.write(
  url
    ? "Generated public Supabase browser configuration.\n"
    : "Generated disabled local Supabase browser configuration.\n"
);
