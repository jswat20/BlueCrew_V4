import { test, expect } from '@playwright/test';

const BASE_URL = 'https://jswat20.github.io/bluecrew_v3/';

test('BlueCrew app audit - pages, buttons, drawers, and console errors', async ({ page }) => {
    const errors = [];

    page.on('pageerror', error => {
        errors.push(error.message);
    });

    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
        }
    });

    await page.goto(BASE_URL);

    await expect(page.getByRole('heading', { name: /BlueCrew/i })).toBeVisible();

    const navButtons = [
        /Dashboard/i,
        /Schedule/i,
        /Crew/i,
        /Reports/i,
        /Settings/i,
        /Admin/i
    ];

    for (const name of navButtons) {
        await page.getByRole('button', { name }).click();
        await page.waitForTimeout(300);
    }

    const allButtons = await page.getByRole('button').all();

    for (let i = 0; i < allButtons.length; i++) {
        const button = allButtons[i];

        if (!(await button.isVisible())) continue;
        if (!(await button.isEnabled())) continue;

        const text = (await button.innerText()).trim();

        // Skip destructive buttons for now.
        if (/delete|remove|reject|trash/i.test(text)) continue;

        try {
            await button.click({ timeout: 1500 });
            await page.waitForTimeout(250);
        } catch (err) {
            errors.push(`Button failed: "${text}" — ${err.message}`);
        }
    }

    expect(errors).toEqual([]);
});