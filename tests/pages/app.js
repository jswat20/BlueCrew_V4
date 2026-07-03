import { expect } from '@playwright/test';

export class App {

    constructor(page) {
        this.page = page;

        this.sidebar = page.locator('aside');

        this.dashboard =
            this.sidebar.getByRole('button', { name: /^🏠?\s*Dashboard$/ });

        this.schedule =
            this.sidebar.getByRole('button', { name: /^📅?\s*Schedule$/ });

        this.crew =
            this.sidebar.getByRole('button', { name: /^👥?\s*Crew$/ });

        this.reports =
            this.sidebar.getByRole('button', { name: /^📈?\s*Reports$/ });

        this.settings =
            this.sidebar.getByRole('button', { name: /^⚙?\s*Settings$/ });

        this.admin =
            this.sidebar.getByRole('button', { name: /^🛠?\s*Admin$/ });
    }

    async open() {
        await this.page.goto('https://jswat20.github.io/bluecrew_v3/');
        await expect(this.page.getByRole('heading', { name: 'BlueCrew' })).toBeVisible();
    }

    async openSchedule() {
        await this.schedule.click();
    }

    async openCrew() {
        await this.crew.click();
    }
}