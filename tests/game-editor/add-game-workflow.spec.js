import { test, expect } from "@playwright/test";
import { GameEditorPage } from "../pages/GameEditorPage.js";

test.describe("Game Editor Workflow", () => {
  test("Admin can add a new game from the schedule", async ({ page }) => {
    const errors = [];

    page.on("pageerror", error => errors.push(error.message));

    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });

    const editor = new GameEditorPage(page);

    await page.goto("/");

    await editor.openFromSchedule();
    await editor.expectOpen();
    const selectedScheduleDate = await page.evaluate(() => currentScheduleDate);

    await editor.fillGame({
      date: selectedScheduleDate,
      time: "6:00 PM",
      field: "Field 1",
      level: "12U",
      homeTeam: "QA Home",
      awayTeam: "QA Away",
      gameType: "single"
    });

    await editor.save();

    await editor.expectGameVisible({
      homeTeam: "QA Home",
      awayTeam: "QA Away",
      field: "Field 1",
      date: selectedScheduleDate
    });

    expect(errors).toEqual([]);
  });
});
