const {
  test,
  expect
} = require("@playwright/test");

test.describe(
  "Assigner Review Decisions",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");

      await page.evaluate(() => {
        authService.loginAsAdmin();
        document.body.dataset.role = "admin";

        if (window.BlueCrew?.test) {
          window.BlueCrew.test.currentRole =
            "admin";
        }

        localStorage.removeItem(
          "bluecrew_accounts"
        );

        const game = gameService.getAll()[0];

        const assignedCrewId =
          game.assignments?.find(
            assignment =>
              assignment.crewId
          )?.crewId ||
          game.crewId ||
          crewService.getAll()[0]?.id;

        game.completed = true;
        game.completionStatus = "completed";
        game.completionTime =
          "2026-07-13T18:30:00.000Z";
        game.completedBy = "Review Umpire";

        game.homeScore = 5;
        game.awayScore = 3;

        game.reports = {
          incidents: true,
          ejections: false,
          protests: false,
          rainout: false,
          notes:
            "Original report notes."
        };

        game.crewNotesByCrewId = {
          ...(game.crewNotesByCrewId || {}),
          [String(assignedCrewId)]:
            "Original crew notes."
        };

        game.review = {
          status: "submitted",
          submittedForReview: true,
          submittedAt:
            "2026-07-13T19:00:00.000Z",
          submittedBy: "Review Umpire",
          reviewer: "",
          reviewedAt: null,
          returnReason: ""
        };

        gameService.save();

        const account =
          accountService.createAccount({
            firstName: "Review",
            lastName: "Umpire",
            email:
              "review-decisions-umpire@test.com"
          }).data;

        accountService.approveAccount(
          account.id
        );

        accountService.linkCrew(
          account.id,
          assignedCrewId
        );

        window.__reviewDecisionFixture = {
          gameId: game.id,
          umpireEmail: account.email,
          assignedCrewId
        };

        renderPage("dashboard");
      });
    });

    async function openSubmittedReview(page) {
      const fixture =
        await page.evaluate(
          () =>
            window.__reviewDecisionFixture
        );

      await page.evaluate(() =>
        navigateTo("review-queue")
      );

      await page
        .getByTestId(
          `review-queue-open-${fixture.gameId}`
        )
        .click();

      await expect(
        page.getByTestId("game-hub")
      ).toHaveAttribute(
        "data-review-mode",
        "true"
      );

      return fixture;
    }

    async function loginAsUmpire(
      page,
      gameId
    ) {
      await page.evaluate(
        ({ gameId }) => {
          const fixture =
            window.__reviewDecisionFixture;

          loginService.login(
            fixture.umpireEmail
          );

          document.body.dataset.role =
            "umpire";

          if (window.BlueCrew?.test) {
            window.BlueCrew.test.currentRole =
              "umpire";
          }

          renderPage("game-hub", {
            gameId
          });
        },
        { gameId }
      );
    }

    test(
      "approve removes the game from the queue and persists reviewer metadata",
      async ({ page }) => {
        const fixture =
          await openSubmittedReview(page);

        await page
          .getByTestId(
            "game-hub-approve-review"
          )
          .click();

        await expect(
          page.getByTestId(
            "review-queue-empty"
          )
        ).toBeVisible();

        const review =
          await page.evaluate(
            gameId =>
              gameService.getById(gameId)
                .review,
            fixture.gameId
          );

        expect(review.status).toBe(
          "approved"
        );

        expect(
          review.submittedForReview
        ).toBe(false);

        expect(review.reviewer).toBeTruthy();
        expect(review.reviewedAt).toBeTruthy();
        expect(review.returnReason).toBe("");

        await page.evaluate(() =>
          renderPage("dashboard")
        );

        await expect(
          page.getByTestId(
            "dashboard-summary-pending-reviews-value"
          )
        ).toHaveText("0");
      }
    );

    test(
      "return removes the game from the queue and persists the return reason",
      async ({ page }) => {
        const fixture =
          await openSubmittedReview(page);

        await page
          .getByTestId(
            "game-hub-show-return-review"
          )
          .click();

        await expect(
          page.getByTestId(
            "game-hub-return-review"
          )
        ).toBeVisible();

        await page
          .getByTestId(
            "game-hub-return-review-reason"
          )
          .fill(
            "Please clarify the incident details."
          );

        await page
          .getByTestId(
            "game-hub-confirm-return-review"
          )
          .click();

        await expect(
          page.getByTestId(
            "review-queue-empty"
          )
        ).toBeVisible();

        const review =
          await page.evaluate(
            gameId =>
              gameService.getById(gameId)
                .review,
            fixture.gameId
          );

        expect(review.status).toBe(
          "returned"
        );

        expect(
          review.submittedForReview
        ).toBe(false);

        expect(review.reviewer).toBeTruthy();
        expect(review.reviewedAt).toBeTruthy();

        expect(review.returnReason).toBe(
          "Please clarify the incident details."
        );

        await page.evaluate(() =>
          renderPage("dashboard")
        );

        await expect(
          page.getByTestId(
            "dashboard-summary-pending-reviews-value"
          )
        ).toHaveText("0");
      }
    );

    test(
      "returned games become editable for the assigned umpire",
      async ({ page }) => {
        const fixture =
          await page.evaluate(() => {
            const fixture =
              window.__reviewDecisionFixture;

            portalService.returnReview(
              fixture.gameId,
              "Update the report."
            );

            return fixture;
          });

        await loginAsUmpire(
          page,
          fixture.gameId
        );

        await expect(
          page.getByTestId(
            "game-hub-review-status"
          )
        ).toHaveText("Returned");

        await expect(
          page.getByTestId(
            "game-hub-review-return-reason"
          )
        ).toHaveText(
          "Update the report."
        );

        await expect(
          page.getByTestId(
            "game-hub-away-score"
          )
        ).toBeEnabled();

        await expect(
          page.getByTestId(
            "game-hub-home-score"
          )
        ).toBeEnabled();

        await expect(
          page.getByTestId(
            "game-hub-save-score"
          )
        ).toBeEnabled();

        await expect(
          page.getByTestId(
            "game-hub-report-incidents"
          )
        ).toBeEnabled();

        await expect(
          page.getByTestId(
            "game-hub-report-notes"
          )
        ).toBeEnabled();

        await expect(
          page.getByTestId(
            "game-hub-save-reports"
          )
        ).toBeEnabled();

        await expect(
          page.getByTestId(
            "game-hub-crew-notes-input"
          )
        ).not.toHaveAttribute(
          "readonly",
          ""
        );

        await expect(
          page.getByTestId(
            "game-hub-save-crew-notes"
          )
        ).toBeEnabled();

        await expect(
          page.getByTestId(
            "game-hub-submit-review"
          )
        ).toBeVisible();
      }
    );

    test(
      "returned games can be updated and resubmitted",
      async ({ page }) => {
        const fixture =
          await page.evaluate(() => {
            const fixture =
              window.__reviewDecisionFixture;

            portalService.returnReview(
              fixture.gameId,
              "Correct the score and notes."
            );

            return fixture;
          });

        await loginAsUmpire(
          page,
          fixture.gameId
        );

        await page
          .getByTestId(
            "game-hub-away-score"
          )
          .fill("4");

        await page
          .getByTestId(
            "game-hub-home-score"
          )
          .fill("6");

        await page
          .getByTestId(
            "game-hub-save-score"
          )
          .click();

        await page
          .getByTestId(
            "game-hub-report-notes"
          )
          .fill(
            "Updated report notes."
          );

        await page
          .getByTestId(
            "game-hub-save-reports"
          )
          .click();

        await page
          .getByTestId(
            "game-hub-submit-review"
          )
          .click();

        const stored =
          await page.evaluate(gameId => {
            const game =
              gameService.getById(gameId);

            return {
              homeScore: game.homeScore,
              awayScore: game.awayScore,
              reports: game.reports,
              review: game.review
            };
          }, fixture.gameId);

        expect(stored.homeScore).toBe(6);
        expect(stored.awayScore).toBe(4);

        expect(
          stored.reports.notes
        ).toBe(
          "Updated report notes."
        );

        expect(stored.review.status).toBe(
          "submitted"
        );

        expect(
          stored.review.submittedForReview
        ).toBe(true);

        expect(stored.review.reviewer).toBe(
          ""
        );

        expect(
          stored.review.reviewedAt
        ).toBeNull();

        expect(
          stored.review.returnReason
        ).toBe("");

        await page.evaluate(() => {
          authService.loginAsAdmin();
          document.body.dataset.role =
            "admin";

          if (window.BlueCrew?.test) {
            window.BlueCrew.test.currentRole =
              "admin";
          }

          renderPage("review-queue");
        });

        await expect(
          page.getByTestId(
            `review-queue-row-${fixture.gameId}`
          )
        ).toBeVisible();
      }
    );

    test(
      "approved games remain read-only for the umpire",
      async ({ page }) => {
        const fixture =
          await page.evaluate(() => {
            const fixture =
              window.__reviewDecisionFixture;

            portalService.approveReview(
              fixture.gameId
            );

            return fixture;
          });

        await loginAsUmpire(
          page,
          fixture.gameId
        );

        await expect(
          page.getByTestId(
            "game-hub-review-status"
          )
        ).toHaveText("Approved");

        await expect(
          page.getByTestId(
            "game-hub-away-score"
          )
        ).toBeDisabled();

        await expect(
          page.getByTestId(
            "game-hub-home-score"
          )
        ).toBeDisabled();

        await expect(
          page.getByTestId(
            "game-hub-save-score"
          )
        ).toBeDisabled();

        await expect(
          page.getByTestId(
            "game-hub-report-incidents"
          )
        ).toBeDisabled();

        await expect(
          page.getByTestId(
            "game-hub-report-notes"
          )
        ).toBeDisabled();

        await expect(
          page.getByTestId(
            "game-hub-save-reports"
          )
        ).toBeDisabled();

        await expect(
          page.getByTestId(
            "game-hub-submit-review"
          )
        ).toHaveCount(0);
      }
    );
  }
);
