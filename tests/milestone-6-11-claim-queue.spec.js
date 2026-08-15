import { test, expect } from "./fixtures/app.fixture.js";
import AxeBuilder from "@axe-core/playwright";

async function openQueue(app) {
  await app.page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";
    window.BlueCrew.test.currentRole = "admin";
    if (window.qaService) qaService.setRole("admin");
    renderPage("claims-queue");
  });
}

test.describe("Milestone 6.11 admin claim queue", () => {
  test("renders a compact, formatted and explicitly actionable pending row", async ({ app }) => {
    await app.createPendingClaim({
      date: "2026-09-01",
      time: "18:00",
      level: "8U",
      locationComplex: "Lake Shore Athletic Complex",
      locationField: "Field 6",
      year: 2026,
      seasonCode: "S",
      organizationCode: "LSYB",
      canonicalLevel: "P",
      sequence: 18
    });
    await app.page.evaluate(() => levelTerminologyService.configure({ level_aliases: { "8U": "Pinto" } }));
    await openQueue(app);

    await expect(app.page.getByTestId("claims-queue").getByRole("heading", { name: "Claims Queue" })).toBeVisible();
    await expect(app.page.getByTestId("claims-pending-count")).toHaveText("1 Pending");
    await expect(app.page.getByTestId("claim-date")).toHaveText("09/01/26");
    await expect(app.page.getByTestId("claim-time")).toHaveText("6:00 PM");
    await expect(app.page.getByTestId("claim-game-identifier")).toHaveText("2026-S-LSYB-P-0018");
    await expect(app.page.getByTestId("claim-level")).toHaveText("Pinto");
    await expect(app.page.getByTestId("claim-location")).toHaveText("Lake Shore Athletic Complex • Field 6");
    await expect(app.page.getByTestId("claim-position")).toHaveText("U1");
    await expect(app.page.getByTestId("claim-status")).toHaveClass(/status-badge-pending-approval/);
    await expect(app.page.getByTestId("claim-queue-card")).not.toContainText(/Plate|Base/);
    await expect(app.page.getByTestId("claim-queue-card")).not.toHaveAttribute("role", "button");
    const accessibility = await new AxeBuilder({ page: app.page }).include('[data-testid="claims-queue"]').analyze();
    expect(accessibility.violations).toEqual([]);
  });

  test("uses the safe existing game ID when presentation metadata is incomplete", async ({ app }) => {
    await app.createPendingClaim({ date: "2026-09-01", gameIdentifier: "LEGACY-104" });
    await openQueue(app);
    await expect(app.page.getByTestId("claim-game-identifier")).toHaveText("LEGACY-104");
  });

  test("guards a rapid repeated decision and keeps a failed row", async ({ app }) => {
    await app.createPendingClaim();
    await openQueue(app);
    const calls = await app.page.evaluate(async () => {
      let count = 0;
      const original = claimsQueueService.approveClaim;
      claimsQueueService.approveClaim = async (...args) => {
        count += 1;
        await new Promise(resolve => setTimeout(resolve, 40));
        return { success: false, message: "Hosted failure" };
      };
      const claim = claimsQueueService.getPendingClaims()[0];
      await Promise.all([
        handleApproveClaim(claim.gameId, claim.assignmentId, claim.claimId),
        handleApproveClaim(claim.gameId, claim.assignmentId, claim.claimId)
      ]);
      claimsQueueService.approveClaim = original;
      return count;
    });
    expect(calls).toBe(1);
    await expect(app.page.getByTestId("claim-queue-card")).toHaveCount(1);
  });

  test("decides the exact selected identity once and leaves the next claim actionable", async ({ app }) => {
    await app.createPendingClaim({ homeTeam: "First Home", awayTeam: "First Away" });
    await app.createPendingClaim({ homeTeam: "Second Home", awayTeam: "Second Away" });
    await openQueue(app);
    const identities = await app.page.evaluate(() => claimsQueueService.getPendingClaims().map(claim => ({
      gameId: claim.gameId, assignmentId: claim.assignmentId, claimId: claim.claimId
    })));
    await app.page.getByTestId(`approve-claim-${identities[1].assignmentId}`).click();
    await expect(app.page.getByTestId("claim-queue-card")).toHaveCount(1);
    await expect(app.page.getByTestId(`approve-claim-${identities[0].assignmentId}`)).toBeEnabled();
  });

  test("preserves useful width and keyboard-accessible horizontal scrolling", async ({ app }) => {
    await app.createPendingClaim();
    await app.page.setViewportSize({ width: 420, height: 800 });
    await openQueue(app);
    const region = app.page.getByTestId("claims-queue-scroll-region");
    await region.focus();
    await expect(region).toBeFocused();
    const sizing = await region.evaluate(element => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
    expect(sizing.scrollWidth).toBeGreaterThan(sizing.clientWidth);
    await expect(app.page.getByRole("button", { name: "Approve", exact: true })).toBeEnabled();
    await expect(app.page.getByRole("button", { name: "Reject", exact: true })).toBeEnabled();
  });
});
