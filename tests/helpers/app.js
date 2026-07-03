import { expect } from '@playwright/test';

export async function openBlueCrew(page) {
    await page.goto('https://jswat20.github.io/bluecrew_v3/');

    await expect(page).toHaveTitle(/BlueCrew/i);

    await expect(
        page.getByRole('heading', {
            name: /BlueCrew/i
        })
    ).toBeVisible();
}