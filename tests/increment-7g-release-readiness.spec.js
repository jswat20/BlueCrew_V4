import { test, expect } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const script = path.join(root, "scripts", "verify-v2-release-candidate.cjs");
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const safeEnvironment = {
  ...process.env,
  RELEASE_CANDIDATE_SHA: head,
  SUPABASE_PROJECT_REF: "fdjhwxmphdzodxvhrblk",
  SUPABASE_URL: "https://fdjhwxmphdzodxvhrblk.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_public"
};

test.describe("Increment 7G release gate", () => {
  for (const scenario of [
    ["production ref", { SUPABASE_PROJECT_REF: "dynxjiqrdlhfhrjnhvgn", SUPABASE_URL: "https://dynxjiqrdlhfhrjnhvgn.supabase.co" }, "exact V2 staging project"],
    ["mixed endpoint", { SUPABASE_URL: "https://dynxjiqrdlhfhrjnhvgn.supabase.co" }, "exact V2 staging URL"],
    ["wrong candidate", { RELEASE_CANDIDATE_SHA: "0".repeat(40) }, "does not match"],
    ["secret browser key", { SUPABASE_PUBLISHABLE_KEY: "sb_secret_forbidden" }, "browser-safe publishable key"]
  ]) {
    test(`rejects ${scenario[0]}`, () => {
      const result = spawnSync(process.execPath, [script], {
        cwd: root,
        env: { ...safeEnvironment, ...scenario[1] },
        encoding: "utf8"
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("V2 release gate blocked:");
      expect(result.stderr).toContain(scenario[2]);
    });
  }
});
