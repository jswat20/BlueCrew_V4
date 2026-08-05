import { expect } from "@playwright/test";

export class GameEditorPage {
  constructor(page) {
    this.page = page;
  }

  async openFromSchedule() {
    await this.page.getByTestId("nav-schedule").click();
    await this.page.getByTestId("add-game").click();
  }

  async expectOpen() {
    await expect(this.page.getByTestId("game-editor")).toBeVisible();
  }

  async fillGame({
    date,
    time,
    field,
    level,
    homeTeam,
    awayTeam,
    gameType
  }) {
    await this.page.getByTestId("game-date-input").fill(date);
    await this.page.getByTestId("game-time-input").selectOption(time);
    await this.page.getByTestId("game-field-input").selectOption(field);
    await this.page.getByTestId("game-level-input").selectOption(level);
    await this.page.getByTestId("game-home-team-input").fill(homeTeam);
    await this.page.getByTestId("game-away-team-input").fill(awayTeam);
    await this.page.getByTestId("game-type-input").selectOption(gameType);
  }

  async createGame(game) {
    await this.openFromSchedule();
    await this.expectOpen();
    await this.fillGame(game);
    await this.save();
  }

  async save() {
    await this.page.getByTestId("save-game-button").click();
  }

  async cancel() {
    await this.page.getByTestId("cancel-game-button").click();
  }

  async openAllGames() {
    await this.page.getByTestId("nav-schedule").click();
    await this.page.getByTestId("view-all-games").click();
  }

  async openCurrentScheduleCards() {
    await this.page.getByTestId("nav-schedule").click();
    await this.page.getByTestId("today").click();
  }

  gameRow({ homeTeam, awayTeam }) {
    return this.page
      .locator(".schedule-game-card")
      .filter({ hasText: homeTeam })
      .filter({ hasText: awayTeam });
  }

  async openEditForGame(gameOrId) {
    await this.openCurrentScheduleCards();

    if (typeof gameOrId === "object") {
      const row = this.gameRow(gameOrId);

      await expect(row).toBeVisible();
      await row.getByTestId(/^edit-game-/).click();
    } else {
      await this.page.getByTestId(`edit-game-${gameOrId}`).click();
    }

    await this.expectOpen();
  }

  async openEditForGameByMatchup(game) {
    await this.openEditForGame(game);
  }

  async expectGameVisible({ homeTeam, awayTeam, field }) {
    await this.openCurrentScheduleCards();

    const row = this.gameRow({ homeTeam, awayTeam });

    await expect(row).toBeVisible();

    if (field) {
      await expect(row).toContainText(field);
    }
  }

  async expectGameNotVisible({ homeTeam, awayTeam }) {
    await this.openCurrentScheduleCards();

    const row = this.gameRow({ homeTeam, awayTeam });

    await expect(row).toHaveCount(0);
  }

  async deleteGame(game) {
    await this.deleteGameByMatchup(game);
  }

  async deleteGameByMatchup({ homeTeam, awayTeam }) {
    await this.openCurrentScheduleCards();

    const row = this.gameRow({ homeTeam, awayTeam });

    await expect(row).toBeVisible();

    this.page.once("dialog", dialog => dialog.accept());

    await row.getByTestId(/^delete-game-/).click();
  }
}
