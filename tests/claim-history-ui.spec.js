import { test, expect } from "./fixtures/app.fixture.js";

test.describe("Claim History UI", () => {
async function createApprovedAndRejectedClaims(
  app,
  {
    approvedDaysAgo = 0,
    rejectedDaysAgo = 0
  } = {}
) {
  function isoDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }

  await app.createPendingClaim({
    homeTeam: "Approved Home",
    awayTeam: "Approved Away"
  });

  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";
  });

  await app.page.getByTestId("nav-claims-queue").click();

  await app.page
    .locator('[data-testid^="approve-claim-"]')
    .first()
    .click();

  await app.createPendingClaim({
    homeTeam: "Rejected Home",
    awayTeam: "Rejected Away"
  });

  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";
  });

  await app.page.getByTestId("nav-claims-queue").click();

  await app.page
    .locator('[data-testid^="reject-claim-"]')
    .first()
    .click();

  await app.page.evaluate(
    ({ approvedDate, rejectedDate }) => {
      const approvedGame = gameService
        .getAll()
        .find(game =>
          game.homeTeam === "Approved Home" &&
          game.assignments?.some(
            assignment => assignment.claimStatus === "approved"
          )
        );

      const rejectedGame = gameService
        .getAll()
        .find(game =>
          game.homeTeam === "Rejected Home" &&
          game.assignments?.some(
            assignment => assignment.claimStatus === "rejected"
          )
        );

      const approvedAssignment = approvedGame?.assignments?.find(
        assignment => assignment.claimStatus === "approved"
      );

      const rejectedAssignment = rejectedGame?.assignments?.find(
        assignment => assignment.claimStatus === "rejected"
      );

      if (approvedGame && approvedAssignment) {
        approvedAssignment.claimProcessedAt = approvedDate;
        approvedGame.date = approvedDate.split("T")[0];
      }

      if (rejectedGame && rejectedAssignment) {
        rejectedAssignment.claimProcessedAt = rejectedDate;
        rejectedGame.date = rejectedDate.split("T")[0];
      }

      gameService.save();
    },
    {
      approvedDate: isoDaysAgo(approvedDaysAgo),
      rejectedDate: isoDaysAgo(rejectedDaysAgo)
    }
  );
}
  test("shows an empty state when there is no claim history", async ({ app }) => {
    await app.page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
      renderPage("claim-history");
    });

    await expect(app.page.getByTestId("claim-history")).toBeVisible();
    await expect(app.page.getByTestId("claim-history-empty")).toBeVisible();
    await expect(
      app.page.getByText("There is no claim history.")
    ).toBeVisible();
  });

  test("approved claim appears in claim history after approval", async ({ app }) => {
    await app.createPendingClaim();

    await app.page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
    });

    await app.page.getByTestId("nav-claims-queue").click();

    await app.page
      .locator('[data-testid^="approve-claim-"]')
      .first()
      .click();

    await app.page.getByTestId("nav-claim-history").click();

    await expect(app.page.getByTestId("approved-claim-card")).toHaveCount(1);
    await expect(
      app.page.getByText("Pending Away @ Pending Home")
    ).toBeVisible();
  });

  test("rejected claim appears in claim history after rejection", async ({ app }) => {
    await app.createPendingClaim();

    await app.page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
    });

    await app.page.getByTestId("nav-claims-queue").click();

    await app.page
      .locator('[data-testid^="reject-claim-"]')
      .first()
      .click();

    await app.page.getByTestId("nav-claim-history").click();

    await expect(app.page.getByTestId("rejected-claim-card")).toHaveCount(1);
    await expect(
      app.page.getByText("Pending Away @ Pending Home")
    ).toBeVisible();
  });

  test("renders claim history filter buttons", async ({ app }) => {
    await createApprovedAndRejectedClaims(app);

    await app.page.getByTestId("nav-claim-history").click();

    await expect(
      app.page.getByTestId("claim-history-filter-all")
    ).toBeVisible();

    await expect(
      app.page.getByTestId("claim-history-filter-approved")
    ).toBeVisible();

    await expect(
      app.page.getByTestId("claim-history-filter-rejected")
    ).toBeVisible();
  });

  test("approved filter displays only approved claim cards", async ({ app }) => {
    await createApprovedAndRejectedClaims(app);

    await app.page.getByTestId("nav-claim-history").click();
    await app.page.getByTestId("claim-history-filter-approved").click();

    await expect(app.page.getByTestId("approved-claim-card")).toHaveCount(1);
    await expect(app.page.getByTestId("rejected-claim-card")).toHaveCount(0);
  });

  test("rejected filter displays only rejected claim cards", async ({ app }) => {
    await createApprovedAndRejectedClaims(app);

    await app.page.getByTestId("nav-claim-history").click();
    await app.page.getByTestId("claim-history-filter-rejected").click();

    await expect(app.page.getByTestId("approved-claim-card")).toHaveCount(0);
    await expect(app.page.getByTestId("rejected-claim-card")).toHaveCount(1);
  });

  test("all filter restores approved and rejected claim cards", async ({ app }) => {
    await createApprovedAndRejectedClaims(app);

    await app.page.getByTestId("nav-claim-history").click();

    await app.page.getByTestId("claim-history-filter-approved").click();

    await expect(app.page.getByTestId("approved-claim-card")).toHaveCount(1);
    await expect(app.page.getByTestId("rejected-claim-card")).toHaveCount(0);

    await app.page.getByTestId("claim-history-filter-all").click();

    await expect(app.page.getByTestId("approved-claim-card")).toHaveCount(1);
    await expect(app.page.getByTestId("rejected-claim-card")).toHaveCount(1);
  });
  test("renders claim history date filter buttons", async ({ app }) => {
  await createApprovedAndRejectedClaims(app);

  await app.page.getByTestId("nav-claim-history").click();

  await expect(app.page.getByTestId("claim-history-date-filter-all")).toBeVisible();
  await expect(app.page.getByTestId("claim-history-date-filter-today")).toBeVisible();
  await expect(app.page.getByTestId("claim-history-date-filter-7")).toBeVisible();
  await expect(app.page.getByTestId("claim-history-date-filter-30")).toBeVisible();
});
  test("today date filter displays only today's claims", async ({ app }) => {
    await createApprovedAndRejectedClaims(app, {
      approvedDaysAgo: 0,
      rejectedDaysAgo: 6
    });

    await app.page.getByTestId("nav-claim-history").click();
    await app.page.getByTestId("claim-history-date-filter-today").click();

    await expect(app.page.getByTestId("approved-claim-card")).toHaveCount(1);
    await expect(app.page.getByTestId("rejected-claim-card")).toHaveCount(0);
  });

  test("last 7 days date filter displays claims from the last 7 days", async ({ app }) => {
    await createApprovedAndRejectedClaims(app, {
      approvedDaysAgo: 3,
      rejectedDaysAgo: 20
    });

    await app.page.getByTestId("nav-claim-history").click();
    await app.page.getByTestId("claim-history-date-filter-7").click();

    await expect(app.page.getByTestId("approved-claim-card")).toHaveCount(1);
    await expect(app.page.getByTestId("rejected-claim-card")).toHaveCount(0);
  });

  test("last 30 days date filter displays claims from the last 30 days", async ({ app }) => {
    await createApprovedAndRejectedClaims(app, {
      approvedDaysAgo: 20,
      rejectedDaysAgo: 40
    });

    await app.page.getByTestId("nav-claim-history").click();
    await app.page.getByTestId("claim-history-date-filter-30").click();

    await expect(app.page.getByTestId("approved-claim-card")).toHaveCount(1);
    await expect(app.page.getByTestId("rejected-claim-card")).toHaveCount(0);
  });

  test("approved status filter composes with today date filter", async ({ app }) => {
    await createApprovedAndRejectedClaims(app, {
      approvedDaysAgo: 0,
      rejectedDaysAgo: 0
    });

    await app.page.getByTestId("nav-claim-history").click();
    await app.page.getByTestId("claim-history-filter-approved").click();
    await app.page.getByTestId("claim-history-date-filter-today").click();

    await expect(app.page.getByTestId("approved-claim-card")).toHaveCount(1);
    await expect(app.page.getByTestId("rejected-claim-card")).toHaveCount(0);
  });

  test("rejected status filter composes with last 7 days date filter", async ({ app }) => {
    await createApprovedAndRejectedClaims(app, {
      approvedDaysAgo: 20,
      rejectedDaysAgo: 6
    });

    await app.page.getByTestId("nav-claim-history").click();
    await app.page.getByTestId("claim-history-filter-rejected").click();
    await app.page.getByTestId("claim-history-date-filter-7").click();

    await expect(app.page.getByTestId("approved-claim-card")).toHaveCount(0);
    await expect(app.page.getByTestId("rejected-claim-card")).toHaveCount(1);
  });
});