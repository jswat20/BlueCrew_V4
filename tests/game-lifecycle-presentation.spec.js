import {
  test,
  expect
} from "@playwright/test";

test.describe(
  "Game Lifecycle Presentation",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
    });

    test(
      "renders lifecycle badges",
      async ({ page }) => {
        const results =
          await page.evaluate(() => {
            const statuses = [
              "scheduled",
              "completed",
              "submitted",
              "returned",
              "approved",
              "postponed",
              "cancelled"
            ];

            return statuses.map(status => {
              const container =
                document.createElement("div");

              container.innerHTML =
                renderGameHubLifecycleBadge({
                  lifecycleStatus: status
                });

              const badge =
                container.querySelector(
                  '[data-testid="game-hub-lifecycle-badge"]'
                );

              return {
                status:
                  badge?.dataset.status,
                label:
                  badge?.textContent.trim()
              };
            });
          });

        expect(results).toEqual([
          {
            status: "scheduled",
            label: "Scheduled"
          },
          {
            status: "completed",
            label: "Completed"
          },
          {
            status: "submitted",
            label: "Submitted"
          },
          {
            status: "returned",
            label: "Returned"
          },
          {
            status: "approved",
            label: "Approved"
          },
          {
            status: "postponed",
            label: "Postponed"
          },
          {
            status: "cancelled",
            label: "Cancelled"
          }
        ]);
      }
    );

    test(
      "renders lifecycle banners",
      async ({ page }) => {
        const results =
          await page.evaluate(() => ({
            scheduled:
              renderGameHubLifecycleBanner({
                lifecycleStatus:
                  "scheduled"
              }),
            postponed:
              renderGameHubLifecycleBanner({
                lifecycleStatus:
                  "postponed"
              }),
            cancelled:
              renderGameHubLifecycleBanner({
                lifecycleStatus:
                  "cancelled"
              }),
            approved:
              renderGameHubLifecycleBanner({
                lifecycleStatus:
                  "approved"
              })
          }));

        expect(results.scheduled).toBe("");

        expect(results.postponed).toContain(
          "Game Postponed"
        );

        expect(results.cancelled).toContain(
          "Game Cancelled"
        );

        expect(results.approved).toContain(
          "Game Finalized"
        );
      }
    );

    test(
      "derives read-only lifecycle state",
      async ({ page }) => {
        const results =
          await page.evaluate(() => ({
            scheduled:
              isGameHubReadOnly({
                lifecycleStatus:
                  "scheduled"
              }),
            postponed:
              isGameHubReadOnly({
                lifecycleStatus:
                  "postponed"
              }),
            approved:
              isGameHubReadOnly({
                lifecycleStatus:
                  "approved"
              }),
            cancelled:
              isGameHubReadOnly({
                lifecycleStatus:
                  "cancelled"
              }),
            submitted:
              isGameHubReadOnly({
                lifecycleStatus:
                  "submitted",
                completion: {
                  review: {
                    submittedForReview:
                      true
                  }
                }
              })
          }));

        expect(results).toEqual({
          scheduled: false,
          postponed: false,
          approved: true,
          cancelled: true,
          submitted: true
        });
      }
    );

    test(
      "cancelled games lock existing controls",
      async ({ page }) => {
        const results =
          await page.evaluate(() => {
            const game = {
              id: "readonly-game",
              lifecycleStatus:
                "cancelled",
              isReadOnly: true,
              crewNotes: "Existing note",
              completion: {
                review: {
                  submittedForReview:
                    false
                }
              },
              gameDayChecklist: [
                {
                  key: "confirm",
                  label: "Confirm assignment",
                  detail:
                    "Review the assignment.",
                  completed: false
                }
              ]
            };

            const notes =
              document.createElement("div");

            notes.innerHTML =
              renderGameHubCrewNotes(game);

            const checklist =
              document.createElement("div");

            checklist.innerHTML =
              renderGameHubChecklist(game);

            return {
              notesReadonly:
                notes.querySelector(
                  '[data-testid="game-hub-crew-notes-input"]'
                )?.readOnly,
              saveDisabled:
                notes.querySelector(
                  '[data-testid="game-hub-save-crew-notes"]'
                )?.disabled,
              checklistDisabled:
                checklist.querySelector(
                  '[data-testid="game-hub-checklist-toggle-confirm"]'
                )?.disabled
            };
          });

        expect(results).toEqual({
          notesReadonly: true,
          saveDisabled: true,
          checklistDisabled: true
        });
      }
    );

    test(
      "postponed games remain editable",
      async ({ page }) => {
        const results =
          await page.evaluate(() => {
            const game = {
              id: "postponed-game",
              lifecycleStatus:
                "postponed",
              isReadOnly: false,
              crewNotes: "",
              completion: {
                review: {
                  submittedForReview:
                    false
                }
              },
              gameDayChecklist: [
                {
                  key: "confirm",
                  label: "Confirm assignment",
                  detail:
                    "Review the assignment.",
                  completed: false
                }
              ]
            };

            const notes =
              document.createElement("div");

            notes.innerHTML =
              renderGameHubCrewNotes(game);

            const checklist =
              document.createElement("div");

            checklist.innerHTML =
              renderGameHubChecklist(game);

            return {
              notesReadonly:
                notes.querySelector(
                  '[data-testid="game-hub-crew-notes-input"]'
                )?.readOnly,
              saveDisabled:
                notes.querySelector(
                  '[data-testid="game-hub-save-crew-notes"]'
                )?.disabled,
              checklistDisabled:
                checklist.querySelector(
                  '[data-testid="game-hub-checklist-toggle-confirm"]'
                )?.disabled
            };
          });

        expect(results).toEqual({
          notesReadonly: false,
          saveDisabled: false,
          checklistDisabled: false
        });
      }
    );
  }
);
