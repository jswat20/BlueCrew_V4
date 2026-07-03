const { expect } = require('@playwright/test');

class GameEditorPage {
    constructor(page) {
        this.page = page;

        // Buttons
        this.addGameButton = page.getByTestId('add-game');
        this.saveButton = page.getByTestId('save-game');
        this.cancelButton = page.getByTestId('cancel-game');

        // Form fields
        this.dateInput = page.getByTestId('game-date');
        this.timeInput = page.getByTestId('game-time');
        this.levelSelect = page.getByTestId('game-level');
        this.fieldSelect = page.getByTestId('game-field');
        this.homeTeamSelect = page.getByTestId('home-team');
        this.awayTeamSelect = page.getByTestId('away-team');
        this.gameTypeSelect = page.getByTestId('game-type');

        // Drawer / Dialog
        this.editor = page.getByTestId('game-editor');

        // Result
        this.gameCards = page.getByTestId('game-card');
    }

    async openAddGame() {
        await this.addGameButton.click();
    }

    async verifyOpen() {
        await expect(this.editor).toBeVisible();
    }

    async fillDate(date) {
        await this.dateInput.fill(date);
    }

    async fillTime(time) {
        await this.timeInput.fill(time);
    }

    async selectLevel(level) {
        await this.levelSelect.selectOption({ label: level });
    }

    async selectField(field) {
        await this.fieldSelect.selectOption({ label: field });
    }

    async selectHomeTeam(team) {
        await this.homeTeamSelect.selectOption({ label: team });
    }

    async selectAwayTeam(team) {
        await this.awayTeamSelect.selectOption({ label: team });
    }

    async selectGameType(type) {
        await this.gameTypeSelect.selectOption({ label: type });
    }

    async fillGame(game) {
        await this.fillDate(game.date);
        await this.fillTime(game.time);
        await this.selectLevel(game.level);
        await this.selectField(game.field);
        await this.selectHomeTeam(game.homeTeam);
        await this.selectAwayTeam(game.awayTeam);
        await this.selectGameType(game.gameType);
    }

    async save() {
        await this.saveButton.click();
    }

    async cancel() {
        await this.cancelButton.click();
    }

    async verifyClosed() {
        await expect(this.editor).toBeHidden();
    }

    async verifyGameExists(text) {
        await expect(this.gameCards.filter({ hasText: text })).toHaveCount(1);
    }
}

module.exports = { GameEditorPage };