import { test, expect } from "@playwright/test";
import { GameEditorPage } from "./pages/GameEditorPage.js";

test.describe("Game Management QA", () => {
  test("Admin can cancel adding a game without saving", async ({ page }) => {
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

    await editor.fillGame({
      date: new Date().toISOString().split("T")[0],
      time: "6:00 PM",
      field: "Field 1",
      level: "12U",
      homeTeam: "Cancel QA Home",
      awayTeam: "Cancel QA Away",
      gameType: "single"
    });

    await page.getByTestId("cancel-game-button").click();

    await expect(page.getByTestId("game-editor")).not.toBeVisible();

    await page.getByTestId("view-all-games").click();

    await expect(
      page.getByRole("row").filter({ hasText: "Cancel QA Home" })
    ).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});