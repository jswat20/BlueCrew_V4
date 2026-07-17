import {
  expect,
  test
} from "@playwright/test";

const MOBILE_VIEWPORT = {
  width: 390,
  height: 844
};

async function useMobileViewport(page) {
  await page.setViewportSize(
    MOBILE_VIEWPORT
  );
}

async function expectNoPageOverflow(page) {
  const dimensions =
    await page.evaluate(() => ({
      documentWidth:
        document.documentElement
          .scrollWidth,
      viewportWidth:
        document.documentElement
          .clientWidth
    }));

  expect(
    dimensions.documentWidth
  ).toBeLessThanOrEqual(
    dimensions.viewportWidth + 1
  );
}

async function expectControlUsable(
  locator
) {
  await expect(locator).toBeVisible();

  const box =
    await locator.boundingBox();

  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(
    44
  );
  expect(box.height).toBeGreaterThanOrEqual(
    44
  );
}

test.describe(
  "Responsive layout hardening",
  () => {
    test.beforeEach(async ({ page }) => {
      await useMobileViewport(page);
      await page.goto("/");
});

test("tablet Operations Center preserves essential operational content", async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1112 });
  await page.goto("/");
  await page.evaluate(() => {
    authService.loginAsAdmin();
    renderPage("operations-center");
  });

  await expect(page.getByTestId("operations-status-strip")).toBeVisible();
  await expect(page.getByTestId("operations-work-deck")).toHaveCount(0);
  await expect(page.getByTestId("operations-upcoming-work")).toBeVisible();
  await expect(page.getByTestId("operations-recent-activity")).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    columns: getComputedStyle(document.querySelector(".operations-center-shell")).gridTemplateColumns
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.columns.split(" ")).toHaveLength(1);
});

    test(
      "mobile Notification Center keeps filters and actions usable",
      async ({ page }) => {
        await page.evaluate(() => {
          notificationService.clearAll();

          authService.loginAsAdmin();

          authService.loginAsAdmin();

          renderPage("notifications");
        });

        await expect(
          page.getByTestId(
            "page-notifications"
          )
        ).toBeVisible();

        const filter =
          page.getByTestId(
            "notification-filter-all"
          );

        const emptyState =
          page.locator(
            '[data-testid="notifications-empty"], ' +
            '[data-testid="empty-state"]'
          ).first();

        if (await filter.count()) {
          await expectControlUsable(filter);

          const bulk =
            page.getByTestId(
              "notifications-select-visible"
            );

          if (await bulk.count()) {
            await expectControlUsable(
              bulk
            );
          }
        } else {
          await expect(
            emptyState
          ).toBeVisible();
        }

        await expectNoPageOverflow(page);
      }
    );

    test(
      "mobile Profile stacks fields and keeps save controls visible",
      async ({ page }) => {
        await page.evaluate(() => {
          localStorage.removeItem(
            "bluecrew_accounts"
          );

          const account =
            accountService.createAccount({
              firstName: "Responsive",
              lastName: "Umpire",
              email:
                "responsive-profile@test.com"
            }).data;

          accountService.approveAccount(
            account.id
          );

          const crewMember =
            crewService.getAll()[0];

          if (crewMember) {
            accountService.linkCrew(
              account.id,
              crewMember.id
            );
          }

          loginService.login(
            account.email
          );

          authService.loginAsUmpire();

          document.body.dataset.role =
            "umpire";

          if (
            typeof
              refreshNavigationAuthorization ===
            "function"
          ) {
            refreshNavigationAuthorization();
          }

          if (window.BlueCrew?.test) {
            window.BlueCrew.test.currentRole =
              "umpire";
          }

          if (window.qaService) {
            qaService.setRole("umpire");
          }

          renderPage("profile");
        });

        await expect(
          page.getByTestId("page-profile")
        ).toBeVisible();

        const submit =
          page.getByTestId(
            "profile-save"
          );

        await expectControlUsable(submit);
        await expectNoPageOverflow(page);
      }
    );

    test(
      "mobile Workbench cards stack without clipping actions",
      async ({ page }) => {
        await page.evaluate(() => {
          authService.loginAsAdmin();
          renderPage(
            "assigner-workbench"
          );
        });

        await expect(
          page.getByTestId(
            "assigner-workbench"
          )
        ).toBeVisible();

        const launch =
          page.getByTestId(
            "workbench-launch-operations-center"
          );

        if (await launch.count()) {
          await expectControlUsable(launch);
        }

        await expectNoPageOverflow(page);
      }
    );

    test(
      "mobile Operations Center keeps action controls reachable",
      async ({ page }) => {
        await page.evaluate(() => {
          authService.loginAsAdmin();
          renderPage(
            "operations-center"
          );
        });

        await expect(
          page.getByTestId(
            "operations-center"
          )
        ).toBeVisible();

        const currentAction =
          page.getByTestId(
            "operations-current-task-action"
          );

        if (await currentAction.count()) {
          await expectControlUsable(
            currentAction
          );
        }

        const quickActions =
          page.locator(
            '[data-testid="operations-quick-actions"] button'
          );

        const quickActionCount =
          await quickActions.count();

        for (
          let index = 0;
          index < quickActionCount;
          index += 1
        ) {
          await expectControlUsable(
            quickActions.nth(index)
          );
        }

        await expectNoPageOverflow(page);
      }
    );

    test(
      "My Schedule contains horizontal table overflow inside its wrapper",
      async ({ page }) => {
        await page.evaluate(() => {
          authService.loginAsUmpire();
          renderPage("my-schedule");
        });

        await expect(
          page.getByTestId(
            "my-schedule"
          )
        ).toBeVisible();

        const table =
          page.locator(
            '[data-testid="my-schedule"] table'
          ).first();

        if (await table.count()) {
          const overflow =
            await table.evaluate(
              element => {
                const wrapper =
                  element.closest(
                    ".responsive-table, " +
                    ".table-wrapper, " +
                    ".table-container, " +
                    ".schedule-table-wrapper, " +
                    ".my-schedule-table-wrapper"
                  );

                if (!wrapper) {
                  return {
                    hasWrapper: false,
                    overflowX: ""
                  };
                }

                return {
                  hasWrapper: true,
                  overflowX:
                    getComputedStyle(
                      wrapper
                    ).overflowX
                };
              }
            );

          expect(
            overflow.hasWrapper
          ).toBe(true);

          expect(
            ["auto", "scroll"]
          ).toContain(
            overflow.overflowX
          );
        }

        await expectNoPageOverflow(page);
      }
    );

    test(
      "Season Dashboard cards wrap to the mobile viewport",
      async ({ page }) => {
        await page.evaluate(() => {
          authService.loginAsAdmin();
          renderPage(
            "season-dashboard"
          );
        });

        await expect(
          page.getByTestId(
            "season-dashboard"
          )
        ).toBeVisible();

        const cards =
          page.locator(
            '[data-testid="season-dashboard"] ' +
            ".dashboard-card, " +
            '[data-testid="season-dashboard"] ' +
            ".season-dashboard-card"
          );

        const count =
          await cards.count();

        for (
          let index = 0;
          index < count;
          index += 1
        ) {
          const box =
            await cards
              .nth(index)
              .boundingBox();

          expect(box).not.toBeNull();

          expect(
            box.width
          ).toBeLessThanOrEqual(
            MOBILE_VIEWPORT.width
          );
        }

        await expectNoPageOverflow(page);
      }
    );

    test(
      "Game Hub preserves readable hierarchy and visible actions",
      async ({ page }) => {
        const gameId =
          await page.evaluate(() => {
            authService.loginAsUmpire();

            const game =
              gameService.getAll()[0];

            if (!game) return "";

            renderPage("game-hub", {
              gameId: game.id
            });

            return game.id;
          });

        test.skip(
          !gameId,
          "No seeded game is available."
        );

        await expect(
          page.getByTestId(
            "game-hub"
          )
        ).toBeVisible();

        const buttons =
          page.locator(
            '[data-testid="game-hub"] button:visible'
          );

        const count =
          await buttons.count();

        for (
          let index = 0;
          index < count;
          index += 1
        ) {
          const box =
            await buttons
              .nth(index)
              .boundingBox();

          expect(box).not.toBeNull();
          expect(
            box.height
          ).toBeGreaterThanOrEqual(44);
        }

        await expectNoPageOverflow(page);
      }
    );

    test(
      "disabled controls expose consistent interaction behavior",
      async ({ page }) => {
        await page.evaluate(() => {
          notificationService.clearAll();

          authService.loginAsAdmin();

          authService.loginAsAdmin();

          renderPage("notifications");
        });

        const disabledControl =
          page.getByTestId(
            "notifications-clear-selection"
          );

        if (
          await disabledControl.count()
        ) {
          await expect(
            disabledControl
          ).toBeDisabled();

          const state =
            await disabledControl.evaluate(
            element => {
              const styles =
                getComputedStyle(element);

              return {
                cursor: styles.cursor,
                minHeight:
                  parseFloat(
                    styles.minHeight
                  ),
                pointerEvents:
                  styles.pointerEvents
              };
            }
          );

          expect(state.cursor)
            .toBe("not-allowed");

          expect(state.minHeight)
            .toBeGreaterThanOrEqual(44);

          expect(state.pointerEvents)
            .toBe("none");
        }
      }
    );
  }
);
