const {
  test,
  expect
} = require("@playwright/test");

test.describe(
  "Returned Review Dashboard",
  () => {
    async function setupReturnedGames(
      page,
      count = 1
    ) {
      return page.evaluate(
        returnedCount => {
          localStorage.removeItem(
            "bluecrew_accounts"
          );

          const crew =
            crewService.getAll()[0];

          const account =
            accountService.createAccount({
              firstName: "Returned",
              lastName: "Umpire",
              email:
                `returned-review-${Date.now()}@test.com`
            }).data;

          accountService.approveAccount(
            account.id
          );

          accountService.linkCrew(
            account.id,
            crew.id
          );

          loginService.login(account.email);
          authService.loginAsUmpire();

          document.body.dataset.role =
            "umpire";

          if (window.BlueCrew?.test) {
            window.BlueCrew.test.currentRole =
              "umpire";
          }

          const gameIds = [];

          for (
  let index = 0;
  index < returnedCount;
  index += 1
) {
  if (index > 0) {
    const createdAt = Date.now();

    while (Date.now() === createdAt) {
      // Ensure Date.now-based game IDs cannot collide.
    }
  }

  const result =
    gameService.create({
      // existing fixture fields
    });

            const game =
              gameService.getById(
                result.data.id
              );

            const assignments =
              assignmentService.getAssignments(
                game
              );

            assignments[0].crewId =
              crew.id;
            assignments[0].position =
              "Plate";
            assignments[0].status =
              "assigned";

            game.crewId = crew.id;
            game.assignmentStatus =
              "assigned";
            game.completed = true;
            game.completionStatus =
              "completed";
            game.completionTime =
              "2026-07-13T18:30:00.000Z";
            game.completedBy =
              "Returned Umpire";
            game.homeScore = 5;
            game.awayScore = 4;

            game.review = {
              status: "returned",
              submittedForReview: false,
              submittedAt:
                "2026-07-13T19:00:00.000Z",
              submittedBy:
                "Returned Umpire",
              reviewer:
                "Alex Assigner",
              reviewedAt:
                "2026-07-13T20:15:00.000Z",
              returnReason:
                "Please clarify the incident details."
            };

            gameIds.push(game.id);
          }

          gameService.save();
          renderPage("dashboard");

          return { gameIds };
        },
        count
      );
    }

    test(
      "does not show a card when there are no returned games",
      async ({ page }) => {
        await page.goto("/");

        await page.evaluate(() => {
          localStorage.removeItem(
            "bluecrew_accounts"
          );

          const crew =
            crewService.getAll()[0];

          const account =
            accountService.createAccount({
              firstName: "Clean",
              lastName: "Umpire",
              email:
                `clean-review-${Date.now()}@test.com`
            }).data;

          accountService.approveAccount(
            account.id
          );

          accountService.linkCrew(
            account.id,
            crew.id
          );

          loginService.login(account.email);
          authService.loginAsUmpire();

          document.body.dataset.role =
            "umpire";

          gameService.getAll().forEach(game => {
  if (game.review?.status === "returned") {
    game.review.status = "approved";
  }
});

gameService.save();
          renderPage("dashboard");
        });

        await expect(
          page.getByTestId(
            "dashboard-returned-review-card"
          )
        ).toHaveCount(0);
      }
    );

    test(
      "shows count and opens the returned Game Hub",
      async ({ page }) => {
        await page.goto("/");

        const fixture =
          await setupReturnedGames(page, 1);

        await expect(
          page.getByTestId(
            "dashboard-returned-review-count"
          )
        ).toHaveText("1");

        await page
          .getByTestId(
            "dashboard-resume-returned-review"
          )
          .click();

        await expect(
          page.getByTestId("game-hub")
        ).toHaveAttribute(
          "data-game-id",
          String(fixture.gameIds[0])
        );

        await expect(
          page.getByTestId(
            "game-hub-returned-by"
          )
        ).toHaveText("Alex Assigner");

        await expect(
          page.getByTestId(
            "game-hub-returned-on"
          )
        ).toBeVisible();

        await expect(
          page.getByTestId(
            "game-hub-reviewer-comments"
          )
        ).toContainText(
          "Please clarify the incident details."
        );
      }
    );

    test(
      "shows the Returned badge in My Schedule",
      async ({ page }) => {
        await page.goto("/");

        const fixture =
          await setupReturnedGames(page, 1);

        await page.evaluate(() => {
          renderPage("my-schedule");
        });

        await expect(
          page.getByTestId(
            `my-schedule-badge-${fixture.gameIds[0]}-returned`
          )
        ).toHaveText("Returned");
      }
    );

    test(
      "multiple returned games open filtered My Schedule",
      async ({ page }) => {
        await page.goto("/");

        const fixture =
          await setupReturnedGames(page, 2);

        await expect(
          page.getByTestId(
            "dashboard-returned-review-count"
          )
        ).toHaveText("2");

        await page
          .getByTestId(
            "dashboard-resume-returned-review"
          )
          .click();

        await expect(
          page.getByTestId(
            "my-schedule-returned-filter"
          )
        ).toBeVisible();

        for (
          const gameId of fixture.gameIds
        ) {
          await expect(
            page.getByTestId(
              `my-schedule-row-${gameId}`
            )
          ).toBeVisible();

          await expect(
            page.getByTestId(
              `my-schedule-badge-${gameId}-returned`
            )
          ).toHaveText("Returned");
        }
      }
    );
  }
);
