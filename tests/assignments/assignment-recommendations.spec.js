const {
  test,
  expect
} = require("@playwright/test");

async function setupRecommendationDrawer(page) {
  await page.goto("/");

  return page.evaluate(() => {
    authService.loginAsAdmin();
    document.body.dataset.role = "admin";

    if (window.BlueCrew?.test) {
      window.BlueCrew.test.currentRole = "admin";
    }

    const members = crewService
      .getAll()
      .slice(0, 3);

    if (!members.length) {
      throw new Error(
        "Recommendation drawer tests require crew members."
      );
    }

    members.forEach(member => {
      member.active = true;
      member.levels = [];

      if (!member.availability) {
        member.availability = {};
      }
    });

    const result = gameService.create({
      date: "2099-10-15",
      time: "6:00 PM",
      field: "Recommendation Field",
      level: "12U",
      homeTeam: "Recommendation Home",
      awayTeam: "Recommendation Away",
      gameType: "single"
    });

    if (!result?.success || !result.data) {
      throw new Error(
        result?.message ||
        "Could not create recommendation test game."
      );
    }

    const game = result.data;

    members.forEach((member, index) => {
      member.availability[game.id] =
        index === 0
          ? "available"
          : "unknown";
    });

    if (typeof saveCrew === "function") {
      saveCrew();
    }

    openAssignmentDrawer(game.id);

    return {
      gameId: game.id
    };
  });
}

test.describe(
  "Assignment Drawer Recommendations",
  () => {
    test(
      "renders a recommendation panel for the assignment slot",
      async ({ page }) => {
        await setupRecommendationDrawer(page);

        await expect(
          page.getByTestId(
            "assignment-recommendation-Plate"
          )
        ).toBeVisible();

        await expect(
          page.getByTestId(
            "recommendation-name-Plate"
          )
        ).not.toHaveText("");
      }
    );
test(
  "renders structured recommendation highlights",
  async ({ page }) => {
    await setupRecommendationDrawer(page);

    const highlights =
      page.getByTestId(
        "recommendation-highlights-Plate"
      );

    await expect(
      highlights
    ).toBeVisible();

    const highlightItems =
      highlights.locator(
        "[data-highlight-type]"
      );

    expect(
      await highlightItems.count()
    ).toBeGreaterThan(0);

    const firstHighlight =
      highlightItems.first();

    await expect(
      firstHighlight
    ).not.toHaveText("");

    await expect(
      firstHighlight
    ).toHaveAttribute(
      "data-highlight-priority",
      /\d+/
    );
  }
);
    test(
      "renders recommendation score and supporting details",
      async ({ page }) => {
        await setupRecommendationDrawer(page);

        await expect(
          page.getByTestId(
            "recommendation-score-Plate"
          )
        ).toContainText("Score:");

        await expect(
          page.getByTestId(
            "recommendation-availability-Plate"
          )
        ).toContainText("Availability:");

        await expect(
          page.getByTestId(
            "recommendation-conflict-Plate"
          )
        ).toContainText("Conflict:");

        await expect(
          page.getByTestId(
            "recommendation-workload-Plate"
          )
        ).toContainText("Workload:");

        await expect(
          page.getByTestId(
            "recommendation-reasons-Plate"
          )
        ).toBeVisible();
      }
    );

    test(
      "does not change the selected crew member",
      async ({ page }) => {
        await setupRecommendationDrawer(page);

        await expect(
          page.getByTestId("assignment-Plate")
        ).toHaveValue("");
      }
    );

    test(
      "uses the recommendation for the draft assignment",
      async ({ page }) => {
        await setupRecommendationDrawer(page);

        const recommendation =
          page.getByTestId(
            "assignment-recommendation-Plate"
          );

        const recommendedCrewId =
          await recommendation.getAttribute(
            "data-crew-id"
          );

        expect(recommendedCrewId).toBeTruthy();

        await page
          .getByTestId(
            "use-recommendation-Plate"
          )
          .click();

        await expect(
          page.getByTestId("assignment-Plate")
        ).toHaveValue(recommendedCrewId);

        await expect(
          page.getByTestId(
            "assignment-availability-Plate"
          )
        ).toBeVisible();
      }
    );

    test(
      "disables the recommendation action for a locked slot",
      async ({ page }) => {
        await setupRecommendationDrawer(page);

        await page
          .getByTestId("assignment-lock-Plate")
          .click();

        await expect(
          page.getByTestId(
            "use-recommendation-Plate"
          )
        ).toBeDisabled();
      }
    );

  }
);
