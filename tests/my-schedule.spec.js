import { test, expect } from "./fixtures/app.fixture.js";

test.describe("My Schedule", () => {
  test("shows an empty state when the umpire has no assigned games", async ({ app }) => {
    await app.page.evaluate(() => {
      const accountResult = accountService.createAccount({
        firstName: "Empty",
        lastName: "Schedule",
        email: "empty.schedule@example.com",
        password: "password123"
      });

      accountService.approveAccount(accountResult.data.id);

      loginService.login(
        "empty.schedule@example.com",
        "password123"
      );

      authService.loginAsUmpire();

      renderPage("my-schedule");
    });

    await expect(app.page.getByTestId("my-schedule")).toBeVisible();
    await expect(app.page.getByTestId("my-schedule-empty")).toBeVisible();
  });

  test("shows assigned games for the logged in umpire", async ({ app }) => {
    const game = await app.page.evaluate(() => {
      const accountResult = accountService.createAccount({
        firstName: "My",
        lastName: "Schedule",
        email: "my.schedule@example.com",
        password: "password123"
      });

      const crew = crewService.getAll()[0];

      accountService.approveAccount(accountResult.data.id);

      accountService.updateAccount(accountResult.data.id, {
        crewId: crew.id
      });

      loginService.login(
        "my.schedule@example.com",
        "password123"
      );

      authService.loginAsUmpire();

      const gameResult = gameService.create({
        date: "2099-01-15",
        time: "6:00 PM",
        field: "Field 1",
        level: "12U",
        homeTeam: "My Schedule Home",
        awayTeam: "My Schedule Away",
        gameType: "single"
      });

      const savedGame = gameService
        .getAll()
        .find(item => item.id === gameResult.data.id);

      savedGame.crewId = crew.id;
      savedGame.assignmentStatus = AssignmentStatus.ASSIGNED;

      renderPage("my-schedule");

      return savedGame;
    });

    await expect(app.page.getByTestId("my-schedule")).toBeVisible();
    await expect(app.page.getByTestId("my-schedule-table")).toBeVisible();

    await expect(
      app.page.getByTestId(`my-schedule-row-${game.id}`)
    ).toBeVisible();

    const row = app.page.getByTestId(`my-schedule-row-${game.id}`);

await expect(row).toContainText("My Schedule Away @ My Schedule Home");
await expect(row).toContainText("2099-01-15");
await expect(row).toContainText("6:00 PM");
await expect(row).toContainText("Field 1");
await expect(row).toContainText("12U");
  });
});

async function setupEnhancedMySchedule(
  app,
  {
    status = "assigned",
    locked = false
  } = {}
) {
  return app.page.evaluate(
    ({ assignmentStatus, isLocked }) => {
      const accountResult =
        accountService.createAccount({
          firstName: "Junior",
          lastName: "Umpire",
          email:
            `junior.schedule.${Date.now()}@example.com`,
          password: "password123"
        });

      const crewMembers =
        crewService.getAll();

      const junior = crewMembers[0];
      const partner = crewMembers.find(
        member =>
          String(member.id) !==
          String(junior.id)
      );

      if (!partner) {
        throw new Error(
          "Enhanced My Schedule tests require at least two crew members."
        );
      }

      accountService.approveAccount(
        accountResult.data.id
      );

      accountService.updateAccount(
        accountResult.data.id,
        {
          crewId: junior.id
        }
      );

      loginService.login(
        accountResult.data.email,
        "password123"
      );

      authService.loginAsUmpire();

      const gameResult = gameService.create({
        date: "2099-02-20",
        time: "6:00 PM",
        field: "Junior Field",
        level: "12U",
        homeTeam: "Junior Home",
        awayTeam: "Junior Away",
        gameType: "single"
      });

      const game = gameService
        .getAll()
        .find(
          item =>
            String(item.id) ===
            String(gameResult.data.id)
        );

      const assignments =
        assignmentService.getAssignments(game);

      const juniorAssignment =
        assignments[0];

      juniorAssignment.crewId =
        junior.id;

      juniorAssignment.position =
        "Plate";

      juniorAssignment.status =
        assignmentStatus;

      juniorAssignment.locked =
        isLocked;

      let partnerAssignment =
        assignments[1];

      if (!partnerAssignment) {
        partnerAssignment = {
          id: `${game.id}-base`,
          gameId: game.id,
          position: "Base",
          crewId: "",
          status: "needs_assignment",
          locked: false,
          claimedBy: ""
        };

        game.assignments.push(
          partnerAssignment
        );
      }

      partnerAssignment.crewId =
        partner.id;

      partnerAssignment.position =
        "Base";

      partnerAssignment.status =
        "assigned";

      partnerAssignment.locked =
        false;

      game.crewId = junior.id;
      game.assignmentStatus =
        assignmentStatus;

      if (
        typeof gameService.save ===
        "function"
      ) {
        gameService.save();
      }

      renderPage("my-schedule");

      return {
        gameId: game.id,
        partnerName:
          crewService.getDisplayName(
            partner.id
          )
      };
    },
    {
      assignmentStatus: status,
      isLocked: locked
    }
  );
}

test.describe(
  "Enhanced My Schedule assignment cards",
  () => {
    test(
      "renders the enhanced assignment information",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        const row = app.page.getByTestId(
          `my-schedule-row-${result.gameId}`
        );

        await expect(row).toBeVisible();
        await expect(row).toContainText(
          "Junior Away @ Junior Home"
        );
        await expect(row).toContainText(
          "Junior Field"
        );
        await expect(row).toContainText(
          "12U"
        );
      }
    );

    test(
      "displays the umpire position",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        await expect(
          app.page.getByTestId(
            `my-schedule-position-${result.gameId}`
          )
        ).toHaveText("Plate");
      }
    );

    test(
      "displays assigned partners and their positions",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        const partners =
          app.page.getByTestId(
            `my-schedule-partners-${result.gameId}`
          );

        await expect(partners).toContainText(
          result.partnerName
        );

        await expect(partners).toContainText(
          "Base"
        );
      }
    );

    test(
      "displays the arrival recommendation",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        const arrival =
          app.page.getByTestId(
            `my-schedule-arrival-${result.gameId}`
          );

        await expect(arrival).toContainText(
          "Arrive by 5:30 PM"
        );

        await expect(arrival).toContainText(
          "30 minutes before game time"
        );
      }
    );

    test(
      "displays the assigned status badge",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        await expect(
          app.page.getByTestId(
            `my-schedule-badge-${result.gameId}-assigned`
          )
        ).toHaveText("Assigned");
      }
    );

    test(
      "displays the locked status badge",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(
            app,
            {
              status: "locked",
              locked: true
            }
          );

        await expect(
          app.page.getByTestId(
            `my-schedule-badge-${result.gameId}-locked`
          )
        ).toHaveText("Locked");
      }
    );
  }
);

test.describe(
  "My Schedule game day guidance",
  () => {
    test(
      "shows that an assigned umpire is ready for game day",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(
            app,
            {
              status: "assigned"
            }
          );

        const gameDay =
          app.page.getByTestId(
            `my-schedule-game-day-${result.gameId}`
          );

        await expect(gameDay).toContainText(
          "Ready for game day"
        );

        await expect(gameDay).toContainText(
          "No action needed."
        );

        await expect(
          gameDay.locator(
            "[data-requires-attention]"
          )
        ).toHaveAttribute(
          "data-requires-attention",
          "false"
        );
      }
    );

    test(
      "shows that a claimed assignment is waiting for approval",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(
            app,
            {
              status: "pending_approval"
            }
          );

        const gameDay =
          app.page.getByTestId(
            `my-schedule-game-day-${result.gameId}`
          );

        await expect(gameDay).toContainText(
          "Waiting for approval"
        );

        await expect(gameDay).toContainText(
          "Your claim has been submitted."
        );
      }
    );

    test(
      "shows that a locked assignment is confirmed",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(
            app,
            {
              status: "locked",
              locked: true
            }
          );

        const gameDay =
          app.page.getByTestId(
            `my-schedule-game-day-${result.gameId}`
          );

        await expect(gameDay).toContainText(
          "Assignment confirmed"
        );

        await expect(gameDay).toContainText(
          "Everything is finalized."
        );

        await expect(
          gameDay.locator(
            "[data-requires-attention]"
          )
        ).toHaveAttribute(
          "data-requires-attention",
          "false"
        );
      }
    );
  }
);

test.describe(
  "My Schedule game day checklist",
  () => {
    test(
      "renders the game day checklist",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        const checklist =
          app.page.getByTestId(
            `my-schedule-checklist-${result.gameId}`
          );

        await expect(checklist).toBeVisible();

        await expect(checklist).toContainText(
          "Uniform ready"
        );

        await expect(checklist).toContainText(
          "Equipment packed"
        );

        await expect(checklist).toContainText(
          "Arrive by 5:30 PM"
        );

        await expect(checklist).toContainText(
          "Assignment confirmed"
        );
      }
    );

    test(
      "shows plate-specific equipment guidance",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        await expect(
          app.page.getByTestId(
            `my-schedule-checklist-item-${result.gameId}-equipment`
          )
        ).toContainText(
          "plate protective gear"
        );
      }
    );

    test(
      "includes the assigned position in the checklist",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        await expect(
          app.page.getByTestId(
            `my-schedule-checklist-item-${result.gameId}-assignment`
          )
        ).toContainText(
          "You are working Plate."
        );
      }
    );

    test(
      "marks confirmed assignments as complete",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        await expect(
          app.page.getByTestId(
            `my-schedule-checklist-item-${result.gameId}-assignment`
          )
        ).toHaveAttribute(
          "data-checklist-status",
          "complete"
        );
      }
    );
  }
);
