const { defineConfig } = require('@playwright/test');

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

  reporter: [

    ["list"],

    ["html", {
      open: "never"
    }]

  ]

});