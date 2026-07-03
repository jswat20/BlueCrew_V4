// tests/pages/AppPage.js

const { expect } = require("@playwright/test");

class AppPage {
  constructor(page) {
    this.page = page;

    this.shell = page.getByTestId("app-shell");
    this.content = page.getByTestId("app-content");
    this.pageTitle = page.getByTestId("page-title");

    this.adminRoleButton = page.getByTestId("role-admin");
    this.umpireRoleButton = page.getByTestId("role-umpire");
  }

  async open() {
    await this.page.goto("/");
    await this.expectLoaded();
  }

  async expectLoaded() {
    await expect(this.shell).toBeVisible();
    await expect(this.content).toBeVisible();

    await this.page.waitForFunction(() => {
      return Boolean(
        window.BlueCrew &&
        window.BlueCrew.test &&
        window.BlueCrew.test.initialized === true
      );
    });
  }

  async getQaState() {
    return await this.page.evaluate(() => {
      if (!window.qaService) return null;
      return window.qaService.getState();
    });
  }

  async expectQaReady() {
    const state = await this.getQaState();
    expect(state).not.toBeNull();
  }

  async expectNoAppErrors() {
    const state = await this.getQaState();

    if (state && Array.isArray(state.errors)) {
      expect(state.errors).toEqual([]);
    }

    const legacyErrors = await this.page.evaluate(() => {
      return window.BlueCrew?.test?.errors || [];
    });

    expect(legacyErrors).toEqual([]);
  }

  async expectPage(pageName) {
    await expect(this.page.locator("body")).toHaveAttribute(
      "data-page",
      pageName
    );

    await expect(
      this.page.getByTestId(`page-${pageName}`)
    ).toBeVisible();
  }

  async switchToAdmin() {
    await this.adminRoleButton.click();

    await expect(this.page.locator("body")).toHaveAttribute(
      "data-role",
      "admin"
    );
  }

  async switchToUmpire() {
    await this.umpireRoleButton.click();

    await expect(this.page.locator("body")).toHaveAttribute(
      "data-role",
      "umpire"
    );
  }
}

module.exports = { AppPage };