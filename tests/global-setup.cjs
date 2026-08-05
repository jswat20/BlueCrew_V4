const { execFileSync } = require("node:child_process");
const path = require("node:path");

module.exports = function globalSetup() {
  execFileSync(
    process.execPath,
    [path.resolve(__dirname, "..", "scripts", "generate-supabase-config.cjs"), "--optional"],
    { stdio: "inherit" }
  );
};
