const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const failures = [];

if (!fs.existsSync(output)) failures.push("dist does not exist; run npm run build:production first");

const forbiddenPaths = [
  "tests", "playwright", "pilot-data", "docs", "supabase", "node_modules",
  ".git", ".env", "js/demo", "js/services/demoDataService.js", "components/admin.js"
];
for (const relative of forbiddenPaths) {
  if (fs.existsSync(path.join(output, relative))) failures.push(`forbidden artifact path: ${relative}`);
}

const required = [
  "index.html", "manifest.webmanifest", "service-worker.js", "app.js", "styles.css",
  "js/ui/login.js", "js/ui/installHelper.js", "assets/icons/icon-192.png", "assets/icons/icon-512.png",
  "assets/icons/apple-touch-icon.png", "assets/icons/favicon-32.png", "_headers"
];
for (const relative of required) {
  if (!fs.existsSync(path.join(output, relative))) failures.push(`missing required artifact file: ${relative}`);
}

const textExtensions = new Set([".html", ".js", ".css", ".json", ".txt", ""]);
const secretPatterns = [
  [/SUPABASE_SERVICE_ROLE_KEY\s*[:=]/i, "service-role configuration"],
  [/RESEND_API_KEY\s*[:=]/i, "Resend credential configuration"],
  [/COMMUNICATION_WORKER_SECRET\s*[:=]/i, "worker credential configuration"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
  [/\bsb_secret_[A-Za-z0-9_-]+/, "Supabase secret key"]
];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) {
      const content = fs.readFileSync(absolute, "utf8");
      for (const [pattern, label] of secretPatterns) {
        if (pattern.test(content)) failures.push(`${label} found in ${path.relative(output, absolute)}`);
      }
    }
  }
}

if (fs.existsSync(output)) walk(output);

if (fs.existsSync(path.join(output, "js/ui/login.js"))) {
  const login = fs.readFileSync(path.join(output, "js/ui/login.js"), "utf8");
  if (!login.includes('form.addEventListener("submit", handleLoginSubmit)')) {
    failures.push("production login submit listener is missing");
  }
  if (login.includes('onsubmit="handleLoginSubmit(event)"')) {
    failures.push("production login depends on a CSP-blocked inline submit handler");
  }
}

if (fs.existsSync(path.join(output, "index.html"))) {
  const index = fs.readFileSync(path.join(output, "index.html"), "utf8");
  if (/data-page=["']admin["']|data-testid=["']nav-admin["']/.test(index)) {
    failures.push("production navigation exposes the local-only Admin destination");
  }
  for (const metadata of [
    /<link[^>]+rel=["']manifest["'][^>]+href=["']manifest\.webmanifest["']/,
    /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']assets\/icons\/apple-touch-icon\.png["']/,
    /<meta[^>]+name=["']theme-color["'][^>]+content=["']#0b0d10["']/,
    /<meta[^>]+name=["']apple-mobile-web-app-capable["'][^>]+content=["']yes["']/
  ]) {
    if (!metadata.test(index)) failures.push(`production HTML is missing required mobile metadata: ${metadata}`);
  }
  if (!/js\/ui\/installHelper\.js/.test(index)) failures.push("production HTML is missing install guidance");
  const configReference = index.match(/config\/(supabase\.([a-f0-9]{12})\.js)/);
  if (!configReference) {
    failures.push("production HTML does not reference a fingerprinted Supabase runtime config");
  } else {
    const configPath = path.join(output, "config", configReference[1]);
    if (!fs.existsSync(configPath)) failures.push(`fingerprinted runtime config is missing: config/${configReference[1]}`);
    else {
      const config = fs.readFileSync(configPath, "utf8");
      const sourceIndex = fs.readFileSync(path.join(root, "index.html"), "utf8");
      const actualHash = crypto.createHash("sha256").update(config).update(sourceIndex).digest("hex").slice(0, 12);
      if (actualHash !== configReference[2]) failures.push("runtime config filename does not match its content fingerprint");
    }
  }
  if (/config\/supabase\.js(?:["'?])/.test(index)) failures.push("production HTML references stale-prone unversioned runtime config");
  for (const source of ["components/crew", "js/schedule/workloadPanel", "js/ui/crewCard", "js/ui/profile"]) {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const reference = index.match(new RegExp(`${escaped}\\.([a-f0-9]{12})\\.js`));
    if (!reference) {
      failures.push(`production HTML does not reference a content-fingerprinted ${source}.js`);
      continue;
    }
    const assetPath = path.join(output, `${source}.${reference[1]}.js`);
    if (!fs.existsSync(assetPath)) failures.push(`fingerprinted interaction asset is missing: ${source}.${reference[1]}.js`);
    else {
      const assetContent = fs.readFileSync(assetPath);
      const actualHash = crypto.createHash("sha256").update(assetContent).digest("hex").slice(0, 12);
      if (actualHash !== reference[1]) failures.push(`interaction asset fingerprint does not match content: ${source}`);
      if (source === "components/crew" && assetContent.toString("utf8").includes("getCrewFullName")) {
        failures.push("production Crew component depends on the local-only getCrewFullName helper");
      }
    }
  }
}

const configDirectory = path.join(output, "config");
if (fs.existsSync(path.join(configDirectory, "supabase.js"))) failures.push("unversioned production runtime config is present");
if (fs.existsSync(configDirectory)) {
  const runtimeConfigs = fs.readdirSync(configDirectory).filter(file => /^supabase\.[a-f0-9]{12}\.js$/.test(file));
  if (runtimeConfigs.length !== 1) failures.push(`expected exactly one fingerprinted runtime config, found ${runtimeConfigs.length}`);
}

if (fs.existsSync(path.join(output, "_headers"))) {
  const headers = fs.readFileSync(path.join(output, "_headers"), "utf8");
  if (!/\/config\/\*[\s\S]*Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/i.test(headers)) {
    failures.push("fingerprinted runtime config does not have an immutable cache policy");
  }
}

if (fs.existsSync(path.join(output, "manifest.webmanifest"))) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(output, "manifest.webmanifest"), "utf8"));
    if (manifest.name !== "The Slate" || manifest.short_name !== "The Slate") failures.push("production manifest has an unexpected application name");
    if (manifest.start_url !== "/" || manifest.scope !== "/") failures.push("production manifest start_url and scope must both be /");
    if (manifest.display !== "standalone") failures.push("production manifest must use standalone display mode");
    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    for (const size of ["192x192", "512x512"]) {
      if (!icons.some(icon => icon.sizes === size && icon.type === "image/png" && fs.existsSync(path.join(output, icon.src)))) {
        failures.push(`production manifest is missing a valid ${size} PNG icon`);
      }
    }
    if (!icons.some(icon => String(icon.purpose || "").split(/\s+/).includes("maskable"))) failures.push("production manifest is missing a maskable icon");
  } catch (error) {
    failures.push(`production manifest is invalid JSON: ${error.message}`);
  }
}

if (fs.existsSync(path.join(output, "service-worker.js"))) {
  const serviceWorker = fs.readFileSync(path.join(output, "service-worker.js"), "utf8");
  if (!/addEventListener\(["']fetch["']/.test(serviceWorker)) failures.push("production service worker is missing a fetch handler");
}

if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write("Production artifact verification passed.\n");
