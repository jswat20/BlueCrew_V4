const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const url = String(process.env.SUPABASE_URL || "").trim();
const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();
const projectRef = String(process.env.SUPABASE_PROJECT_REF || "").trim();

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
  fail("SUPABASE_URL must be the production HTTPS Supabase project URL.");
}
if (!/^[a-z]{20}$/.test(projectRef)) {
  fail("SUPABASE_PROJECT_REF must be the 20-character production project reference.");
}
if (new URL(url).hostname !== `${projectRef}.supabase.co`) {
  fail("SUPABASE_URL does not match SUPABASE_PROJECT_REF; refusing to build a mixed-environment artifact.");
}
if (!publishableKey || /service[_-]?role|sb_secret_/i.test(publishableKey)) {
  fail("SUPABASE_PUBLISHABLE_KEY must be a browser-safe publishable key.");
}
if (!/^[A-Za-z0-9._-]+$/.test(publishableKey)) {
  fail("SUPABASE_PUBLISHABLE_KEY contains unexpected characters.");
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const entry of ["index.html", "app.js", "styles.css", "assets", "components", "css", "data", "js"]) {
  fs.cpSync(path.join(root, entry), path.join(output, entry), { recursive: true });
}

for (const localOnly of [
  "components/admin.js",
  "js/demo",
  "js/services/demoDataService.js"
]) {
  fs.rmSync(path.join(output, localOnly), { recursive: true, force: true });
}

fs.writeFileSync(path.join(output, "data", "games.js"), "let games = [];\n", "utf8");
fs.writeFileSync(path.join(output, "data", "crew.js"), "let crew = [];\n", "utf8");

const indexPath = path.join(output, "index.html");
let index = fs.readFileSync(indexPath, "utf8");
for (const source of [
  "components/admin.js",
  "js/demo/demoCrew.js",
  "js/demo/demoGames.js",
  "js/demo/demoAccounts.js",
  "js/services/demoDataService.js"
]) {
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  index = index.replace(new RegExp(`\\s*<script[^>]+src=["']${escaped}(?:\\?[^"']*)?["'][^>]*><\\/script>`, "g"), "");
}
fs.writeFileSync(indexPath, index, "utf8");

fs.mkdirSync(path.join(output, "config"), { recursive: true });
fs.writeFileSync(
  path.join(output, "config", "supabase.js"),
  `window.BLUECREW_RUNTIME_CONFIG = Object.freeze({"mode":"hosted"});\n` +
    `window.BLUECREW_SUPABASE_CONFIG = Object.freeze(${JSON.stringify({ mode: "hosted", url, publishableKey })});\n`,
  "utf8"
);

fs.writeFileSync(
  path.join(output, "_headers"),
  `/*\n` +
    `  Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ${url} wss://${new URL(url).host}; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests\n` +
    `  Strict-Transport-Security: max-age=31536000; includeSubDomains\n` +
    `  X-Content-Type-Options: nosniff\n` +
    `  X-Frame-Options: DENY\n` +
    `  Referrer-Policy: strict-origin-when-cross-origin\n` +
    `  Permissions-Policy: camera=(), microphone=(), geolocation=()\n` +
    `  Cache-Control: no-cache\n\n` +
    `/assets/*\n` +
    `  Cache-Control: public, max-age=31536000, immutable\n`,
  "utf8"
);

process.stdout.write(`Built curated production artifact at ${output}\n`);
