// tests/pages/AvailabilityPage.js

const { expect } = require("@playwright/test");

class AvailabilityPage {
  constructor(page) {
    this.page = page;

    this.navButton =
      page.getByTestId("nav-availability");

    this.pageSection =
      page.getByTestId("availability-page");

    this.crewSelect =
      page.getByTestId("availability-crew-select");

    this.dateInput =
      page.getByTestId("availability-date-input");

    this.saveButton =
      page.getByTestId("availability-save");

    this.list =
      page.getByTestId("availability-list");
  }

  async open() {
    // Availability is intentionally not routable. These implementation-level
    // tests render the dormant feature directly so its behavior remains
    // covered without weakening the production navigation boundary.
    await this.page.evaluate(() => {
      if (!window.__availabilityImplementationRenderPage) {
        const applicationRenderPage = renderPage;
        window.__availabilityImplementationRenderPage = true;
        window.renderPage = (page, context = {}) => {
          if (page !== "availability") {
            return applicationRenderPage(page, context);
          }
          document.getElementById("app-content").innerHTML = renderAvailability(context);
        };
      }
      window.renderPage("availability");
    });
    await this.expectLoaded();
  }

  async expectLoaded() {
    await expect(this.pageSection).toBeVisible();
  }

  async selectCrew(crewId) {
    await this.crewSelect.selectOption(
      String(crewId)
    );
  }

  async chooseDate(date) {
    await this.dateInput.fill(date);
  }

  async chooseStatus(status) {
    await this.page
      .getByTestId(
        `availability-status-${status}`
      )
      .check();
  }

  async save({
    crewId,
    date,
    status
  }) {
    if (crewId !== undefined) {
      await this.selectCrew(crewId);
    }

    await this.chooseDate(date);
    await this.chooseStatus(status);
    await this.saveButton.click();
  }

  entryForDate(date) {
    return this.page.locator(
      `[data-testid="availability-entry"][data-date="${date}"]`
    );
  }

  async edit(date) {
    await this.page
      .getByTestId(`availability-edit-${date}`)
      .click();
  }

  async remove(date) {
    await this.page
      .getByTestId(`availability-remove-${date}`)
      .click();
  }

  async expectEntry({
    date,
    status
  }) {
    const entry = this.entryForDate(date);

    await expect(entry).toBeVisible();

    await expect(entry).toHaveAttribute(
      "data-status",
      status
    );

    await expect(
      entry.getByTestId(
        "availability-entry-status"
      )
    ).toHaveText(
      status === "maybe"
        ? "Maybe"
        : status === "unavailable"
          ? "Unavailable"
          : "Available"
    );
  }
}

module.exports = { AvailabilityPage };
