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

  async save() {
    await this.page.getByTestId("save-game-button").click();
  }

  async expectGameVisible({ homeTeam, awayTeam, field }) {
    await expect(this.page.getByText(homeTeam)).toBeVisible();
    await expect(this.page.getByText(awayTeam)).toBeVisible();
    await expect(this.page.getByText(field)).toBeVisible();
  }
}
