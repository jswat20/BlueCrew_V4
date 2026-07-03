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

    const select =
      this.page.getByTestId(
        `assignment-${position}`
      );

    await select.selectOption({
      label: crewName
    });

  }

  async selected(position) {

    return this.page.evaluate(pos => {

      const el =
        document.querySelector(
          `[data-testid="assignment-${pos}"]`
        );

      return el
        ? el.value
        : null;

    }, position);

  }

}

module.exports = {
  AssignmentDrawerPage
};