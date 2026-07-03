// tests/helpers/navigation.js

const { expect } = require("@playwright/test");

class NavigationHelper {
  constructor(page) {
    this.page = page;
  }

  async dashboard() {
    await this.page.getByTestId("nav-dashboard").click();
    await this.expectPage("dashboard");
  }

  async schedule() {
    await this.page.getByTestId("nav-schedule").click();
    await this.expectPage("schedule");
  }

  async crew() {
    await this.page.getByTestId("nav-crew").click();
    await this.expectPage("crew");
  }

  async reports() {
    await this.page.getByTestId("nav-reports").click();
    await this.expectPage("reports");
  }

  async settings() {
    await this.page.getByTestId("nav-settings").click();
    await this.expectPage("settings");
  }

  async admin() {
    await this.page.getByTestId("nav-admin").click();
    await this.expectPage("admin");
  }

  async expectPage(pageName) {
    await expect(
      this.page.locator("body")
    ).toHaveAttribute("data-page", pageName);

    await expect(
      this.page.getByTestId(`page-${pageName}`)
    ).toBeVisible();
  }
}

module.exports = { NavigationHelper };