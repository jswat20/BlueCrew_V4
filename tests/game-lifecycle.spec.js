import {
  test,
  expect
} from "@playwright/test";

test.describe(
  "Game Lifecycle Service",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
    });

    test(
      "normalizes legacy games from existing completion and review state",
      async ({ page }) => {
        const statuses =
          await page.evaluate(() => {
            const scheduled = {
              id: "legacy-scheduled"
            };

            const completed = {
              id: "legacy-completed",
              completed: true
            };

            const returned = {
              id: "legacy-returned",
              completed: true,
              review: {
                status: "returned"
              }
            };

            const approved = {
              id: "legacy-approved",
              completed: true,
              review: {
                status: "approved"
              }
            };

            return {
              scheduled:
                gameService.getStatus(
                  scheduled
                ),
              completed:
                gameService.getStatus(
                  completed
                ),
              returned:
                gameService.getStatus(
                  returned
                ),
              approved:
                gameService.getStatus(
                  approved
                )
            };
          });

        expect(statuses).toEqual({
          scheduled: "scheduled",
          completed: "completed",
          returned: "returned",
          approved: "approved"
        });
      }
    );

    test(
      "allows the established completion and review lifecycle",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const id =
              `lifecycle-${Date.now()}`;

            gameService.create({
              id,
              date: "2028-06-01",
              time: "18:00",
              homeTeam: "Home",
              awayTeam: "Away"
            });

            const sequence = [
              gameService.getStatus(id)
            ];

            const completed =
              gameService.transitionStatus(
                id,
                "completed",
                {
                  completed: true
                }
              );

            sequence.push(
              gameService.getStatus(id)
            );

            const submitted =
              gameService.transitionStatus(
                id,
                "submitted",
                {
                  review: {
                    status: "submitted",
                    submittedForReview: true
                  }
                }
              );

            sequence.push(
              gameService.getStatus(id)
            );

            const returned =
              gameService.transitionStatus(
                id,
                "returned",
                {
                  review: {
                    status: "returned",
                    submittedForReview: false
                  }
                }
              );

            sequence.push(
              gameService.getStatus(id)
            );

            const resubmitted =
              gameService.transitionStatus(
                id,
                "submitted",
                {
                  review: {
                    status: "submitted",
                    submittedForReview: true
                  }
                }
              );

            sequence.push(
              gameService.getStatus(id)
            );

            const approved =
              gameService.transitionStatus(
                id,
                "approved",
                {
                  review: {
                    status: "approved",
                    submittedForReview: false
                  }
                }
              );

            sequence.push(
              gameService.getStatus(id)
            );

            gameService.delete(id);

            return {
              sequence,
              results: [
                completed.success,
                submitted.success,
                returned.success,
                resubmitted.success,
                approved.success
              ]
            };
          });

        expect(result.sequence).toEqual([
          "scheduled",
          "completed",
          "submitted",
          "returned",
          "submitted",
          "approved"
        ]);

        expect(result.results).toEqual([
          true,
          true,
          true,
          true,
          true
        ]);
      }
    );

    test(
      "rejects invalid lifecycle transitions",
      async ({ page }) => {
        const result =
          await page.evaluate(() => {
            const id =
              `invalid-lifecycle-${Date.now()}`;

            gameService.create({
              id,
              date: "2028-06-01",
              time: "18:00",
              homeTeam: "Home",
              awayTeam: "Away"
            });

            const transition =
              gameService.transitionStatus(
                id,
                "approved"
              );

            const status =
              gameService.getStatus(id);

            gameService.delete(id);

            return {
              transition,
              status
            };
          });

        expect(
          result.transition.success
        ).toBe(false);

        expect(
          result.transition.message
        ).toContain(
          "cannot transition"
        );

        expect(result.status).toBe(
          "scheduled"
        );
      }
    );

    test(
      "exposes immutable lifecycle constants",
      async ({ page }) => {
        const statuses =
          await page.evaluate(() =>
            gameService
              .getLifecycleStatuses()
        );

        expect(statuses).toEqual({
          SCHEDULED: "scheduled",
          COMPLETED: "completed",
          SUBMITTED: "submitted",
          RETURNED: "returned",
          APPROVED: "approved",
          POSTPONED: "postponed",
          CANCELLED: "cancelled"
        });
      }
    );
  }
);
