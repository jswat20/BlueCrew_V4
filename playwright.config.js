// playwright.config.js

const { defineConfig } = require("@playwright/test");

const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: 1,
  workers: 1,

  use: {
    baseURL: "http://127.0.0.1:5500",
    headless: true,
    launchOptions: executablePath ? { executablePath } : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: executablePath ? "off" : "retain-on-failure"
  },

  webServer: {
    command:
      "node node_modules/http-server/bin/http-server . -p 5500",
    url: "http://127.0.0.1:5500",
    reuseExistingServer: true,
    timeout: 120000
  },

  reporter: [
    ["list"],
    ["html", { open: "never" }]
  ]
});
