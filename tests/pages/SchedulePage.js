// tests/pages/SchedulePage.js

const { expect } = require("@playwright/test");

class SchedulePage {
  constructor(page) {
    this.page = page;

    this.schedulePage = page.getByTestId("schedule-page");
    this.content = page.getByTestId("schedule-content");

    this.dailyButton = page.getByTestId("view-daily");
    this.allGamesButton = page.getByTestId("view-all-games");

    this.previousButton = page.getByTestId("previous-date");
    this.todayButton = page.getByTestId("today");
    this.nextButton = page.getByTestId("next-date");

    this.addGameButton = page.getByTestId("add-game");
  }

  async expectLoaded() {
    await expect(this.schedulePage).toBeVisible();
    await expect(this.content).toBeVisible();
  }

  async showDailyView() {
    await this.dailyButton.click();
  }

  async showAllGamesView() {
    await this.allGamesButton.click();
  }

  async previousDate() {
    await this.previousButton.click();
  }

  async today() {
    await this.todayButton.click();
  }

  async nextDate() {
    await this.nextButton.click();
  }

  async openGameEditor() {
    await this.addGameButton.click();
  }
}

module.exports = { SchedulePage };