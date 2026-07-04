import { expect } from "@playwright/test";

export class AllGamesPage {
  constructor(page) {
    this.page = page;
  }

  async open() {
    await this.page.getByTestId("nav-schedule").click();
    await this.page.getByTestId("view-all-games").click();
  }

  gameRow({ homeTeam, awayTeam }) {
    return this.page
      .getByRole("row")
      .filter({ hasText: homeTeam })
      .filter({ hasText: awayTeam });
  }

  async expectVisible(game) {
    const row = this.gameRow(game);
    await expect(row).toBeVisible();

    if (game.field) {
      await expect(row).toContainText(game.field);
    }
  }

  async expectNotVisible(game) {
    const row = this.gameRow(game);
    await expect(row).toHaveCount(0);
  }

  async openEdit(game) {
    const row = this.gameRow(game);

    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Edit" }).click();
  }

  async openAssignment(game) {
    const row = this.gameRow(game);

    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Assign" }).click();
  }

  async delete(game) {
    const row = this.gameRow(game);

    await expect(row).toBeVisible();

    this.page.once("dialog", dialog => dialog.accept());

    await row.getByRole("button", { name: "Delete" }).click();
  }
}