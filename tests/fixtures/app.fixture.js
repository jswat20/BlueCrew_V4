// tests/fixtures/app.fixture.js

import { test as base, expect } from "@playwright/test";

import { AppPage } from "../pages/AppPage";
import { SchedulePage } from "../pages/SchedulePage";
import { GameEditorPage } from "../pages/GameEditorPage";
import { AssignmentDrawerPage } from "../pages/AssignmentDrawerPage";

export const test = base.extend({
  app: async ({ page }, use) => {
    await page.goto("/");

    const app = {
      page,
      appPage: new AppPage(page),
      schedulePage: new SchedulePage(page),
      gameEditorPage: new GameEditorPage(page),
      assignmentDrawerPage: new AssignmentDrawerPage(page)
    };

    await use(app);
  }
});

export { expect };