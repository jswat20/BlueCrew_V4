// playwright.config.js

const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: 1,
  workers: 1,

  use: {
    baseURL: "http://127.0.0.1:5500",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },

  webServer: {
    command: "npx http-server . -p 5500",
    url: "http://127.0.0.1:5500",
    reuseExistingServer: false,
    timeout: 120000
  },

  reporter: [
    ["list"],
    ["html", { open: "never" }]
  ]
});