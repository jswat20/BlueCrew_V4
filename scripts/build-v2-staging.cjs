"use strict";
// The Slate V2: fail-closed staging artifact build.
// Never use this entry point with production or pre-deployment credentials.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const STAGING_REF = "fdjhwxmphdzodxvhrblk";
const PRODUCTION_REF = "dynxjiqrdlhfhrjnhvgn";
const repoRoot = path.resolve(__dirname, "..");

function fail(message) {
  process.stderr.write("V2 staging build blocked: " + message + "\n");
  process.exit(1);
}

const ref = (process.env.SUPABASE_PROJECT_REF || "").trim();
const url = (process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const key = (process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();

if (ref !== STAGING_REF) fail("SUPABASE_PROJECT_REF must be the exact staging project ID.");
if (url !== `https://${STAGING_REF}.supabase.co`) fail("SUPABASE_URL must be the exact staging project URL.");
if (!key || /sb_secret_|service[_-]?role/i.test(key)) fail("A browser-safe staging publishable key is required.");
if (Object.values(process.env).some(value => typeof value === "string" && value.includes(`https://${PRODUCTION_REF}.supabase.co`) && value === process.env.SUPABASE_URL)) {
  fail("Production endpoint is forbidden.");
}

function run(name, script) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit"
  });
  if (result.error) fail(`${name}: ${result.error.message}`);
  if (result.status !== 0) fail(`${name} failed (exit ${result.status}).`);
}
run("artifact build", "build-production.cjs");
run("artifact verification", "verify-production-artifact.cjs");

const index = fs.readFileSync(path.join(repoRoot, "dist", "index.html"), "utf8");
const match = index.match(/config\/(supabase\.[a-f0-9]{12}\.js)/);
if (!match) fail("No fingerprinted runtime config found in built HTML.");
const cfg = fs.readFileSync(path.join(repoRoot, "dist", "config", match[1]), "utf8");
if (!cfg.includes(`https://${STAGING_REF}.supabase.co`) || cfg.includes(PRODUCTION_REF)) {
  fail("Runtime config is not isolated to staging.");
}
const headers = fs.readFileSync(path.join(repoRoot, "dist", "_headers"), "utf8");
if (!headers.includes(`https://${STAGING_REF}.supabase.co`) || headers.includes(PRODUCTION_REF)) {
  fail("Artifact headers are not isolated to staging.");
}
process.stdout.write("V2 staging artifact built and verified: Supabase target is staging only. No deployment performed.\n");
