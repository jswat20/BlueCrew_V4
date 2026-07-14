import { expect, test } from "@playwright/test";

test.describe(
  "Assigner Workbench mutation refresh",
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
    });

    test("claim approval invokes the workbench refresh hook after success", async ({
      page
    }) => {
      const result = await page.evaluate(() => {
        let refreshCount = 0;

        const originalRefresh =
          window.refreshWorkbenchIfActive;

        const originalApprove =
          claimsQueueService.approveClaim;

        const originalRender =
          window.renderPage;

        window.refreshWorkbenchIfActive =
          () => {
            refreshCount += 1;
          };

        claimsQueueService.approveClaim =
          () => ({
            success: true
          });

        window.renderPage = () => {};

        handleApproveClaim(
          "game-1",
          "assignment-1"
        );

        window.refreshWorkbenchIfActive =
          originalRefresh;

        claimsQueueService.approveClaim =
          originalApprove;

        window.renderPage =
          originalRender;

        return refreshCount;
      });

      expect(result).toBe(1);
    });

    test("failed claim decisions do not refresh the workbench", async ({
      page
    }) => {
      const result = await page.evaluate(() => {
        let refreshCount = 0;

        const originalRefresh =
          window.refreshWorkbenchIfActive;

        const originalApprove =
          claimsQueueService.approveClaim;

        const originalRender =
          window.renderPage;

        window.refreshWorkbenchIfActive =
          () => {
            refreshCount += 1;
          };

        claimsQueueService.approveClaim =
          () => ({
            success: false,
            message: "Denied"
          });

        window.renderPage = () => {};

        handleApproveClaim(
          "game-1",
          "assignment-1"
        );

        window.refreshWorkbenchIfActive =
          originalRefresh;

        claimsQueueService.approveClaim =
          originalApprove;

        window.renderPage =
          originalRender;

        return refreshCount;
      });

      expect(result).toBe(0);
    });

    test("review approval invokes the workbench refresh hook after success", async ({
      page
    }) => {
      const result = await page.evaluate(() => {
        let refreshCount = 0;

        const originalRefresh =
          window.refreshWorkbenchIfActive;

        const originalApprove =
          portalService.approveReview;

        const originalRender =
          window.renderPage;

        window.refreshWorkbenchIfActive =
          () => {
            refreshCount += 1;
          };

        portalService.approveReview =
          () => ({
            success: true
          });

        window.renderPage = () => {};

        approveReviewFromHub(
          "review-game"
        );

        window.refreshWorkbenchIfActive =
          originalRefresh;

        portalService.approveReview =
          originalApprove;

        window.renderPage =
          originalRender;

        return refreshCount;
      });

      expect(result).toBe(1);
    });

    test("review return invokes the workbench refresh hook after success", async ({
      page
    }) => {
      const result = await page.evaluate(() => {
        let refreshCount = 0;

        const originalRefresh =
          window.refreshWorkbenchIfActive;

        const originalReturn =
          portalService.returnReview;

        const originalRender =
          window.renderPage;

        const returnInput =
          document.createElement("textarea");

        returnInput.id =
          "game-hub-review-return-reason";

        returnInput.value =
          "Please correct the report.";

        document.body.appendChild(
          returnInput
        );

        window.refreshWorkbenchIfActive =
          () => {
            refreshCount += 1;
          };

        portalService.returnReview =
          () => ({
            success: true
          });

        window.renderPage = () => {};

        returnReviewFromHub(
          "review-game"
        );

        window.refreshWorkbenchIfActive =
          originalRefresh;

        portalService.returnReview =
          originalReturn;

        window.renderPage =
          originalRender;

        returnInput.remove();

        return refreshCount;
      });

      expect(result).toBe(1);
    });

    test("selection-only claim actions do not invoke the refresh hook", async ({
      page
    }) => {
      const result = await page.evaluate(() => {
        let refreshCount = 0;

        const originalRefresh =
          window.refreshWorkbenchIfActive;

        const originalRender =
          window.renderPage;

        window.refreshWorkbenchIfActive =
          () => {
            refreshCount += 1;
          };

        window.renderPage = () => {};

        toggleClaimSelection(
          "assignment-selection-only"
        );

        handleClearSelectedClaims();

        window.refreshWorkbenchIfActive =
          originalRefresh;

        window.renderPage =
          originalRender;

        return refreshCount;
      });

      expect(result).toBe(0);
    });
  }
);
