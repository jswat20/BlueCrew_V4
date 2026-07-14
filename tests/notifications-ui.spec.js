import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Notifications UI", () => {
  test("shows an empty state when there are no notifications", async ({ app }) => {
    await app.page.evaluate(() => {
      notificationService.clearAll();
    });

    await app.page.getByTestId("nav-notifications").click();

    await expect(app.page.getByTestId("notifications-empty")).toBeVisible();
  });

  test("shows notification cards", async ({ app }) => {
    await app.page.evaluate(() => {
      notificationService.clearAll();

      notificationService.create({
        type: "claim",
        title: "New claim submitted",
        message: "Pending Away @ Pending Home has been claimed.",
        relatedId: "game-1",
        audience: "admin"
      });
    });

    await app.page.getByTestId("nav-notifications").click();

    await expect(app.page.getByTestId("notification-card")).toHaveCount(1);
    await expect(app.page.getByText("New claim submitted")).toBeVisible();
    await expect(
      app.page.getByText("Pending Away @ Pending Home has been claimed.")
    ).toBeVisible();
  });

  test("shows an unread notification badge", async ({ app }) => {
    await app.page.evaluate(() => {
      notificationService.clearAll();

      notificationService.create({
        title: "Test Notification",
        message: "Unread message."
      });
    });

    await app.page.reload();

    await expect(app.page.getByTestId("notifications-badge")).toHaveText("1");
  });

  test("hides the badge when there are no unread notifications", async ({ app }) => {
    await app.page.evaluate(() => {
      notificationService.clearAll();
    });

    await app.page.reload();

    await expect(app.page.getByTestId("notifications-badge")).toBeHidden();
  });

  test("marks a notification as read", async ({ app }) => {
    await app.page.evaluate(() => {
      notificationService.clearAll();

      notificationService.create({
        title: "Unread Notification",
        message: "This should be marked read."
      });
    });

    await app.page.reload();

    await expect(app.page.getByTestId("notifications-badge")).toHaveText("1");

    await app.page.getByTestId("nav-notifications").click();
    await app.page.getByTestId("notification-mark-read").click();

    await expect(app.page.getByTestId("notifications-badge")).toBeHidden();
    await expect(app.page.getByTestId("notification-mark-read")).toHaveCount(0);
  });

  test("marks all notifications as read", async ({ app }) => {
    await app.page.evaluate(() => {
      notificationService.clearAll();

      notificationService.create({
        title: "First Notification",
        message: "First unread message."
      });

      notificationService.create({
        title: "Second Notification",
        message: "Second unread message."
      });
    });

    await app.page.reload();

    await expect(app.page.getByTestId("notifications-badge")).toHaveText("2");

    await app.page.getByTestId("nav-notifications").click();
    await app.page.getByTestId("notifications-mark-all-read").click();

    await expect(app.page.getByTestId("notifications-badge")).toBeHidden();
    await expect(app.page.getByTestId("notification-mark-read")).toHaveCount(0);
    await expect(app.page.getByTestId("notifications-mark-all-read")).toHaveCount(0);
  });

  test("filters notifications by unread status", async ({ app }) => {
    const result = await app.page.evaluate(() => {
      notificationService.clearAll();

      notificationService.create({
        type: "claim",
        title: "Unread notification",
        message: "Unread message"
      });

      const read = notificationService.create({
        type: "claim",
        title: "Read notification",
        message: "Read message"
      }).data;

      notificationService.markAsRead(read.id);

      return {
        unread: notificationService.getNotifications({ status: "unread" }),
        read: notificationService.getNotifications({ status: "read" }),
        all: notificationService.getNotifications({ status: "all" })
      };
    });

    expect(result.unread).toHaveLength(1);
    expect(result.unread[0].title).toBe("Unread notification");

    expect(result.read).toHaveLength(1);
    expect(result.read[0].title).toBe("Read notification");

    expect(result.all).toHaveLength(2);
  });

  test("shows notification timestamps", async ({ app }) => {
    await app.page.evaluate(() => {
      notificationService.clearAll();

      notificationService.create({
        type: "claim",
        title: "Timestamped notification",
        message: "Timestamp message",
        createdAt: "2026-07-09T12:00:00.000Z"
      });
    });

    await app.page.getByTestId("nav-notifications").click();

    await expect(app.page.getByTestId("notification-timestamp")).toBeVisible();
  });

  test("claim notifications navigate to the Claims Queue", async ({ app }) => {
    await app.page.evaluate(() => {
      notificationService.clearAll();

      notificationService.create({
        type: "claim",
        title: "New claim submitted",
        message: "Pending Away @ Pending Home has been claimed.",
        relatedId: "game-1",
        audience: "admin"
      });
    });

    await app.page.getByTestId("nav-notifications").click();
    await app.page.getByTestId("notification-action").click();

    await expect(app.page.getByTestId("claims-queue")).toBeVisible();
  });

  test("claim submitted notification opens Claims Queue and highlights related claim", async ({ app }) => {
  await app.createPendingClaim();

  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";

    notificationService.clearAll();

    const claim = claimsQueueService.getPendingClaims()[0];

    notificationService.create({
      type: "claim",
      title: "New claim submitted",
      message: "Pending Away @ Pending Home has been claimed.",
      relatedId: claim.gameId,
      audience: "admin"
    });
  });

  await app.page.getByTestId("nav-notifications").click();
  await app.page.getByTestId("notification-action").click();

  await expect(app.page.getByTestId("claims-queue")).toBeVisible();

  await expect(
    app.page.locator('[data-testid="claim-queue-card"][data-highlighted="true"]')
  ).toHaveCount(1);
});

  test("claim approved notifications navigate to the Schedule and highlight related game", async ({ app }) => {
 await app.page.evaluate(() => {
  const game = gameService.create({
    date: new Date().toISOString().split("T")[0],
    time: "6:00 PM",
    field: "Field 1",
    level: "12U",
    homeTeam: "Rejected Claim Home",
    awayTeam: "Rejected Claim Away",
    gameType: "single"
  }).data;

  assignmentService.openForClaim(game.id);

  const assignment = assignmentService.getAssignments(game)[0];

  assignment.claimedBy = "test-umpire";
  assignment.claimedByName = "Test Umpire";
  assignment.status = "pending-approval";

assignmentService.rejectClaim(game.id);

  notificationService.clearAll();

  const rejectedClaim = claimsQueueService.getClaimHistory()[0];

  notificationService.create({
    type: "claim-rejected",
    title: "Claim rejected",
    message: "Your claim was rejected.",
    relatedId:
      rejectedClaim.gameId ||
      rejectedClaim.assignment?.gameId,
    audience: "admin"
  });
});

  await app.page.getByTestId("nav-notifications").click();
  await app.page.getByTestId("notification-action").click();

  await expect(app.page.getByTestId("claim-history")).toBeVisible();

  await expect(
    app.page.locator(
      '[data-testid="rejected-claim-card"][data-highlighted="true"]'
    )
  ).toHaveCount(1);
});
});
test.describe(
  "Returned Review Notifications",
  () => {
    async function setupReturnedReview(
      app
    ) {
      return app.page.evaluate(() => {
        notificationService.clearAll();

        gameService.getAll().forEach(
          game => {
            if (
              game.review?.status ===
              "returned"
            ) {
              game.review.status =
                "approved";
            }
          }
        );

        const crew =
          crewService.getAll()[0];

        const account =
          accountService.createAccount({
            firstName: "Returned",
            lastName: "Notification",
            email:
              `returned-notification-${Date.now()}@test.com`
          }).data;

        accountService.approveAccount(
          account.id
        );

        accountService.linkCrew(
          account.id,
          crew.id
        );

        loginService.login(account.email);
        authService.loginAsCrew(crew.id);

        document.body.dataset.role =
          "umpire";

        if (window.BlueCrew?.test) {
          window.BlueCrew.test.currentRole =
            "umpire";
        }

        const result =
          gameService.create({
            date: "2099-09-15",
            time: "6:00 PM",
            field:
              "Returned Notification Field",
            level: "12U",
            homeTeam:
              "Returned Notification Home",
            awayTeam:
              "Returned Notification Away",
            gameType: "single"
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
          "Returned Notification Umpire";
        game.homeScore = 6;
        game.awayScore = 4;

        game.review = {
          status: "returned",
          submittedForReview: false,
          submittedAt:
            "2026-07-13T19:00:00.000Z",
          submittedBy:
            "Returned Notification Umpire",
          reviewer:
            "Alex Assigner",
          reviewedAt:
            "2026-07-13T20:15:00.000Z",
          returnReason:
            "Please add the missing incident details."
        };

        gameService.save();
        renderPage("dashboard");

        return {
          gameId: game.id
        };
        test(
  "returned review notifications are excluded from the Read filter",
  async ({ app }) => {
    await setupReturnedReview(app);

    await app.page.evaluate(() => {
      renderPage("notifications");
    });

    await app.page
      .getByTestId("notification-filter-read")
      .click();

    await expect(
      app.page.locator(
        '[data-testid="notification-action"][data-notification-type="returned-review"]'
      )
    ).toHaveCount(0);
  }
);
      });
    }

    test(
      "shows a returned review notification and updates the badge",
      async ({ app }) => {
        await setupReturnedReview(app);

        await expect(
          app.page.getByTestId(
            "notifications-badge"
          )
        ).toHaveText("1");

        await app.page.evaluate(() => {
          renderPage("notifications");
        });

        await expect(
          app.page.getByTestId(
            "notification-card"
          )
        ).toHaveCount(1);

        await expect(
          app.page.getByText(
            "Returned Review",
            { exact: true }
          )
        ).toBeVisible();

        await expect(
          app.page.getByText(
            "Please add the missing incident details."
          )
        ).toBeVisible();

        await expect(
          app.page.locator(
            '[data-testid="notification-action"][data-notification-type="returned-review"]'
          )
        ).toHaveText("Resume Review");
      }
    );

    test(
      "Resume Review opens the existing Game Hub",
      async ({ app }) => {
        const fixture =
          await setupReturnedReview(app);

        await app.page.evaluate(() => {
          renderPage("notifications");
        });

        await app.page
          .locator(
            '[data-testid="notification-action"][data-notification-type="returned-review"]'
          )
          .click();

        await expect(
          app.page.getByTestId("game-hub")
        ).toBeVisible();

        await expect(
          app.page.getByTestId("game-hub")
        ).toHaveAttribute(
          "data-game-id",
          String(fixture.gameId)
        );

        await expect(
          app.page.getByTestId(
            "game-hub-reviewer-comments"
          )
        ).toContainText(
          "Please add the missing incident details."
        );
      }
    );

    test(
      "does not show returned review notifications when none exist",
      async ({ app }) => {
        await app.page.evaluate(() => {
          notificationService.clearAll();

          gameService.getAll().forEach(
            game => {
              if (
                game.review?.status ===
                "returned"
              ) {
                game.review.status =
                  "approved";
              }
            }
          );

          gameService.save();
          renderPage("notifications");
        });

        await expect(
          app.page.locator(
            '[data-testid="notification-action"][data-notification-type="returned-review"]'
          )
        ).toHaveCount(0);

        await expect(
          app.page.getByTestId(
            "notifications-empty"
          )
        ).toBeVisible();
      }
    );
  }
);


