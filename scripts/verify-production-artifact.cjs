const fs = require("node:fs");
const path = require("node:path");

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

const required = ["index.html", "app.js", "styles.css", "config/supabase.js", "_headers"];
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

if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write("Production artifact verification passed.\n");
