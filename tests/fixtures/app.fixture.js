import { test as base } from "@playwright/test";

import { GameEditorPage } from "../pages/GameEditorPage.js";
import { AssignmentPage } from "../pages/AssignmentPage.js";

export const test = base.extend({
  app: async ({ page }, use) => {
    await page.goto("/");

    const app = {
      page,

      gameEditorPage: new GameEditorPage(page),

      assignmentPage: new AssignmentPage(page)
    };

    await use(app);
  }
});

export { expect } from "@playwright/test";