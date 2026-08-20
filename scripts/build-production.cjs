const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const url = String(process.env.SUPABASE_URL || "").trim();
const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();
const projectRef = String(process.env.SUPABASE_PROJECT_REF || "").trim();
const runtimeConfig =
  `window.BLUECREW_RUNTIME_CONFIG = Object.freeze({"mode":"hosted"});\n` +
  `window.BLUECREW_SUPABASE_CONFIG = Object.freeze(${JSON.stringify({ mode: "hosted", url, publishableKey })});\n`;
// Include the application entry document so a corrected deployment always
// changes the immutable runtime-config URL, even when Supabase values do not.
// Browsers that cached a failed or stale config request can then recover on a
// normal revisit without clearing site data.
const runtimeConfigHash = crypto.createHash("sha256")
  .update(runtimeConfig)
  .update(fs.readFileSync(path.join(root, "index.html"), "utf8"))
  .digest("hex")
  .slice(0, 12);
const runtimeConfigFile = `supabase.${runtimeConfigHash}.js`;
const supabaseBrowserBundleSource = path.join(root, "node_modules", "@supabase", "supabase-js", "dist", "umd", "supabase.js");

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
if (!fs.existsSync(supabaseBrowserBundleSource)) {
  fail("The pinned Supabase browser client is unavailable; run npm ci before building.");
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const entry of ["index.html", "manifest.webmanifest", "service-worker.js", "app.js", "styles.css", "assets", "components", "css", "data", "js"]) {
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
const supabaseBrowserBundle = fs.readFileSync(supabaseBrowserBundleSource);
const supabaseBrowserHash = crypto.createHash("sha256").update(supabaseBrowserBundle).digest("hex").slice(0, 12);
const supabaseBrowserFile = `supabase.${supabaseBrowserHash}.js`;
fs.mkdirSync(path.join(output, "vendor"), { recursive: true });
fs.writeFileSync(path.join(output, "vendor", supabaseBrowserFile), supabaseBrowserBundle);
index = index.replace(
  "node_modules/@supabase/supabase-js/dist/umd/supabase.js",
  `vendor/${supabaseBrowserFile}?v=${supabaseBrowserHash}`
);
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
index = index.replace(
  /\s*<button[^>]+data-page=["']admin["'][^>]*>.*?<\/button>/,
  ""
);
index = index.replace(
  /config\/supabase(?:\.[a-f0-9]+)?\.js(?:\?[^"']*)?/,
  `config/${runtimeConfigFile}`
);

// Query-string versions can be populated with an older body while a custom-domain
// cache is converging on a new Pages deployment. Give interaction-critical scripts
// content-addressed physical paths so a new HTML document can only request the
// exact bytes it was built with.
for (const source of ["components/crew.js", "js/schedule/workloadPanel.js", "js/ui/crewCard.js", "js/ui/profile.js"]) {
  const sourcePath = path.join(output, source);
  const content = fs.readFileSync(sourcePath);
  const fingerprint = crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
  const fingerprintedSource = source.replace(/\.js$/, `.${fingerprint}.js`);
  fs.copyFileSync(sourcePath, path.join(output, fingerprintedSource));
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  index = index.replace(new RegExp(`${escaped}(?:\\?[^"']*)?`), `${fingerprintedSource}?v=${fingerprint}`);
}
fs.writeFileSync(indexPath, index, "utf8");

fs.mkdirSync(path.join(output, "config"), { recursive: true });
fs.writeFileSync(
  path.join(output, "config", runtimeConfigFile),
  runtimeConfig,
  "utf8"
);

fs.writeFileSync(
  path.join(output, "_headers"),
  `/*\n` +
  `  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${url}; connect-src 'self' ${url} wss://${new URL(url).host}; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests\n` +
    `  Strict-Transport-Security: max-age=31536000; includeSubDomains\n` +
    `  X-Content-Type-Options: nosniff\n` +
    `  X-Frame-Options: DENY\n` +
    `  Referrer-Policy: strict-origin-when-cross-origin\n` +
    `  Permissions-Policy: camera=(), microphone=(), geolocation=()\n` +
    `  Cache-Control: no-cache\n\n` +
    `/config/*\n` +
    `  Cache-Control: public, max-age=31536000, immutable\n\n` +
    `/vendor/*\n` +
    `  Cache-Control: public, max-age=31536000, immutable\n\n` +
    `/assets/*\n` +
    `  Cache-Control: public, max-age=31536000, immutable\n`,
  "utf8"
);

process.stdout.write(`Built curated production artifact at ${output}\n`);
