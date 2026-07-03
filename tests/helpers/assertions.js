// tests/helpers/assertions.js

const { expect } = require("@playwright/test");

async function expectNoConsoleErrors(page) {
  const errors = [];

  page.on("console", message => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  await page.waitForTimeout(250);

  expect(errors).toEqual([]);
}

async function expectNoPageErrors(page) {
  const state = await page.evaluate(() => {
    if (window.qaService) {
      return window.qaService.getState();
    }

    return {
      errors: window.BlueCrew?.test?.errors || []
    };
  });

  expect(state.errors).toEqual([]);
}

async function expectCurrentPage(page, pageName) {
  await expect(
    page.locator("body")
  ).toHaveAttribute("data-page", pageName);
}

async function expectCurrentRole(page, role) {
  await expect(
    page.locator("body")
  ).toHaveAttribute("data-role", role);
}

module.exports = {
  expectNoConsoleErrors,
  expectNoPageErrors,
  expectCurrentPage,
  expectCurrentRole
};