"use strict";

const { execFileSync } = require("node:child_process");

const STAGING_REF = "fdjhwxmphdzodxvhrblk";
const PRODUCTION_REF = "dynxjiqrdlhfhrjnhvgn";
const DEVELOPMENT_BRANCH = "slate-v2-development";

function fail(message) {
  process.stderr.write(`V2 release gate blocked: ${message}\n`);
  process.exit(1);
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const requestedSha = String(process.env.RELEASE_CANDIDATE_SHA || process.argv[2] || "").trim();
if (!/^[a-f0-9]{40}$/i.test(requestedSha)) fail("a full 40-character RELEASE_CANDIDATE_SHA is required.");

const head = git("rev-parse", "HEAD");
const branch = git("branch", "--show-current");
const workingTreeChanges = git("status", "--porcelain");
const ref = String(process.env.SUPABASE_PROJECT_REF || "").trim();
const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const key = String(process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();

if (branch !== DEVELOPMENT_BRANCH) fail(`branch must be ${DEVELOPMENT_BRANCH}.`);
if (head.toLowerCase() !== requestedSha.toLowerCase()) fail("checked-out commit does not match the explicitly selected candidate.");
if (ref !== STAGING_REF) fail("Supabase project must be the exact V2 staging project.");
if (url !== `https://${STAGING_REF}.supabase.co`) fail("Supabase URL must be the exact V2 staging URL.");
if (!key || /sb_secret_|service[_-]?role/i.test(key)) fail("a browser-safe publishable key is required.");
if ([ref, url, key].some(value => value.includes(PRODUCTION_REF))) fail("production Supabase configuration is forbidden.");
if (workingTreeChanges) fail("working-tree changes are present.");

process.stdout.write(`V2 release candidate verified: ${head} on ${branch}; target is staging only.\n`);
