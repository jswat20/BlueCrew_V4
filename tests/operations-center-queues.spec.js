import { expect, test } from "@playwright/test";

test.describe("Operations Center canonical queues", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => authService.loginAsAdmin());
  });

  test("retains canonical queue definitions in the service", async ({ page }) => {
    const queues = await page.evaluate(() =>
      dashboardService.getOperationsCenter().queues.map(queue => queue.id)
    );
    expect(queues).toEqual(["all", "assignments", "claims", "reviews", "accounts", "conflicts"]);
  });

  test("continues to filter canonical claim and review queues", async ({ page }) => {
    const result = await page.evaluate(() => ({
      claims: dashboardService.getOperationsCenter("claims"),
      reviews: dashboardService.getOperationsCenter("reviews")
    }));
    expect(result.claims.activeQueue).toBe("claims");
    expect(result.reviews.activeQueue).toBe("reviews");
    expect(result.claims.activeTasks.every(task => task.key === "pendingClaims")).toBe(true);
    expect(result.reviews.activeTasks.every(task => ["awaitingReview", "returnedReviews"].includes(task.key))).toBe(true);
  });

  test("keeps account queues role-aware", async ({ page }) => {
    const queues = await page.evaluate(() => {
      authService.loginAsAssigner();
      return dashboardService.getOperationsCenter("accounts").queues.map(queue => queue.id);
    });
    expect(queues).not.toContain("accounts");
  });
});
