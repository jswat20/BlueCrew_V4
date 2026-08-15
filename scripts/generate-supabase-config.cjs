const fs = require("node:fs");
const path = require("node:path");

const outputPath = path.resolve(__dirname, "..", "config", "supabase.js");
const url = String(process.env.SUPABASE_URL || "").trim();
const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();
const modeArgument = process.argv.find(argument => argument.startsWith("--mode="));
const mode = modeArgument?.split("=")[1] || "hosted";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

if (!new Set(["hosted", "local"]).has(mode)) {
  fail("Runtime mode must be hosted or local.");
}

if (mode === "hosted" && (!url || !publishableKey)) {
  fail("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.");
}

if (mode === "hosted" && ((url && !publishableKey) || (!url && publishableKey))) {
  fail("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be provided together.");
}

if (mode === "hosted" && url && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
  fail("SUPABASE_URL must be an HTTPS Supabase project URL.");
}

if (mode === "hosted" && /service[_-]?role|sb_secret_/i.test(publishableKey)) {
  fail("A secret or service-role key cannot be written to browser configuration.");
}

if (mode === "hosted" && publishableKey && !/^[A-Za-z0-9._-]+$/.test(publishableKey)) {
  fail("SUPABASE_PUBLISHABLE_KEY contains unexpected characters.");
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `window.BLUECREW_RUNTIME_CONFIG = window.BLUECREW_RUNTIME_CONFIG || Object.freeze(${JSON.stringify({ mode })});\n` +
  `window.BLUECREW_SUPABASE_CONFIG = window.BLUECREW_SUPABASE_CONFIG || Object.freeze(${JSON.stringify({
    mode,
    url: mode === "hosted" ? url : "",
    publishableKey: mode === "hosted" ? publishableKey : ""
  })});\n`,
  "utf8"
);

process.stdout.write(
  mode === "hosted"
    ? "Generated public Supabase browser configuration.\n"
    : "Generated explicit local browser configuration.\n"
);
