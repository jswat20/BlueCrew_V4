// tests/pages/AssignmentDrawerPage.js

const { expect } = require("@playwright/test");

class AssignmentDrawerPage {
  constructor(page) {
    this.page = page;

    this.drawer =
      page.getByTestId("assignment-drawer");

    this.title =
      page.getByTestId("assignment-title");

    this.saveButton =
      page.getByTestId("assignment-save");

    this.cancelButton =
      page.getByTestId("assignment-cancel");

    this.closeButton =
      page.getByTestId("assignment-close");

    this.autoFillButton =
      page.getByTestId("assignment-autofill");
  }

  assignmentSelect(position) {
    return this.page.getByTestId(
      `assignment-${position}`
    );
  }

  availabilityBadge(position) {
    return this.page.getByTestId(
      `assignment-availability-${position}`
    );
  }

  async expectOpen() {
    await expect(this.drawer).toBeVisible();
  }

  async expectClosed() {
    await expect(this.drawer).toBeHidden();
  }

  async autoFill() {
    await this.autoFillButton.click();
  }

  async save() {
    await this.saveButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async close() {
    await this.closeButton.click();
  }

  async select(position, crewName) {
    await this
      .assignmentSelect(position)
      .selectOption({
        label: crewName
      });
  }

  async selectById(position, crewId) {
    await this
      .assignmentSelect(position)
      .selectOption(String(crewId));
  }

  async selected(position) {
    return this
      .assignmentSelect(position)
      .inputValue();
  }

  async optionLabels(position) {
    return this
      .assignmentSelect(position)
      .locator("option")
      .allTextContents();
  }

  async expectOptionText(
    position,
    crewId,
    expectedText
  ) {
    const option = this
      .assignmentSelect(position)
      .locator(
        `option[value="${String(crewId)}"]`
      );

    await expect(option).toHaveText(expectedText);
  }

  async expectAvailability(
    position,
    expectedStatus
  ) {
    const normalizedStatus =
      String(expectedStatus).toLowerCase();

    const label =
      normalizedStatus === "maybe"
        ? "Maybe"
        : normalizedStatus === "unavailable"
          ? "Unavailable"
          : "Available";

    const badge =
      this.availabilityBadge(position);

    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(label);

    await expect(badge).toHaveAttribute(
      "data-availability",
      normalizedStatus
    );
  }
}

module.exports = {
  AssignmentDrawerPage
};