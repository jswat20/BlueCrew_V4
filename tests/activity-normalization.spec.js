import {
  test,
  expect
} from "./fixtures/app.fixture.js";

test.describe("Activity normalization", () => {
  test.beforeEach(async ({ app }) => {
    await app.page.evaluate(() => {
      localStorage.removeItem(
        "bluecrew_activity"
      );
    });
  });

  test("legacy activity calls remain supported", async ({ app }) => {
    const activity = await app.page.evaluate(() => {
      activityService.log(
        "general",
        "Legacy activity"
      );

      return JSON.parse(
        localStorage.getItem(
          "bluecrew_activity"
        )
      )[0];
    });

    expect(activity.type).toBe("general");
    expect(activity.message).toBe(
      "Legacy activity"
    );
    expect(activity.action).toBe("");
    expect(activity.gameId).toBe("");
  });

  test("assignment activity stores structured fields", async ({ app }) => {
    const activity = await app.page.evaluate(() => {
      const game = gameService.create({
        date: "2099-08-15",
        time: "6:00 PM",
        field: "Activity Field",
        level: "12U",
        homeTeam: "Activity Home",
        awayTeam: "Activity Away",
        gameType: "single"
      }).data;

      const crew = crewService.getAll()[0];

      assignmentService.assignCrew(
        game.id,
        crew.id
      );

      return activityService.getRecent(1)[0];
    });

    expect(activity.type).toBe(
      "assignment"
    );
    expect(activity.action).toBe(
      "assigned"
    );
    expect(activity.gameId).toBeTruthy();
    expect(activity.matchup).toBe(
      "Activity Away @ Activity Home"
    );
    expect(activity.message).toContain(
      "assigned"
    );
  });

  test("activity remains newest first", async ({ app }) => {
    const activities = await app.page.evaluate(() => {
      activityService.log({
        type: "assignment",
        action: "assigned",
        message: "First"
      });

      activityService.log({
        type: "assignment",
        action: "cleared",
        message: "Second"
      });

      return activityService.getRecent(2);
    });

    expect(activities[0].message).toBe(
      "Second"
    );
    expect(activities[1].message).toBe(
      "First"
    );
  });
});
