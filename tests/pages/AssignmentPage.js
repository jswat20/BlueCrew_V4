import { expect } from "@playwright/test";

export class AssignmentPage {
  constructor(page) {
    this.page = page;
  }

  async open(gameId) {
    await this.page.getByTestId("nav-schedule").click();
    await this.page.getByTestId("view-all-games").click();
    await this.page.getByTestId(`assign-game-${gameId}`).click();
  }

  async expectOpen() {
    await expect(
      this.page.getByTestId("assignment-drawer")
    ).toBeVisible();
  }

  async autoFill() {
    await this.page.getByTestId("auto-fill-crew").click();
  }

  async assign(position, crewMember) {
    await this.page
      .getByTestId(`assignment-${position}`)
      .selectOption(crewMember);
  }

  async save() {
    await this.page.getByTestId("save-assignment").click();
  }

  async cancel() {
    await this.page.getByTestId("cancel-assignment").click();
  }

  async expectClosed() {
    await expect(
      this.page.getByTestId("assignment-drawer")
    ).not.toBeVisible();
  }

  async expectAssigned(position, crewMember) {
    await expect(
      this.page.getByTestId(`assignment-${position}`)
    ).toHaveValue(crewMember);
  }
}