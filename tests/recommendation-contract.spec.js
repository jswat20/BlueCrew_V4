const {
  test,
  expect
} = require("@playwright/test");

async function openApp(page) {
  await page.goto("/");

  await page.waitForFunction(() =>
    typeof recommendationService !== "undefined" &&
    typeof crewService !== "undefined" &&
    typeof gameService !== "undefined"
  );
}

test.describe("Recommendation Service Contract", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test("returns deterministic score, name, and id ordering", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const recommendations = [
        {
          crewId: "crew-3",
          name: "Taylor",
          score: 80
        },
        {
          crewId: "crew-2",
          name: "Alex",
          score: 90
        },
        {
          crewId: "crew-1",
          name: "Alex",
          score: 90
        },
        {
          crewId: "crew-4",
          name: "Jordan",
          score: 70
        }
      ];

      return recommendationService
        .rankRecommendations(recommendations)
        .map(item => item.crewId);
    });

    expect(result).toEqual([
      "crew-1",
      "crew-2",
      "crew-3",
      "crew-4"
    ]);
  });

  test("ranking does not mutate the supplied array", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const recommendations = [
        {
          crewId: "lower",
          name: "Lower",
          score: 10
        },
        {
          crewId: "higher",
          name: "Higher",
          score: 20
        }
      ];

      const ranked =
        recommendationService.rankRecommendations(
          recommendations
        );

      return {
        original: recommendations.map(
          item => item.crewId
        ),
        ranked: ranked.map(
          item => item.crewId
        ),
        sameReference:
          ranked === recommendations
      };
    });

    expect(result.original).toEqual([
      "lower",
      "higher"
    ]);

    expect(result.ranked).toEqual([
      "higher",
      "lower"
    ]);

    expect(result.sameReference).toBe(false);
  });

  test("returns the complete recommendation snapshot", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const member = crewService.getAll()[0];

      if (!member) {
        throw new Error(
          "Recommendation contract test requires a crew member."
        );
      }

      member.active = true;
      member.levels = [];

      const game = {
        id: "recommendation-contract-game",
        date: "2099-09-01",
        time: "6:00 PM",
        level: "Varsity",
        homeTeam: "Contract Home",
        awayTeam: "Contract Away",
        assignments: []
      };

      const recommendation =
        recommendationService.scoreCrewForGame(
          member,
          game
        );

      return {
  keys: Object.keys(recommendation),

  explanationKeys:
    Object.keys(
      recommendation.explanation
    ),

  workload:
    recommendation.workload,

  workloadCount:
    recommendation.workloadCount,

  reasonsIsArray:
    Array.isArray(
      recommendation.reasons
    ),

  explanationReasonsIsArray:
    Array.isArray(
      recommendation.explanation.reasons
    ),

  explanationHighlightsIsArray:
    Array.isArray(
      recommendation.explanation.highlights
    ),

  explanationHighlights:
    recommendation.explanation.highlights,

  preferenceMatchesIsArray:
    Array.isArray(
      recommendation.preferenceMatches
    )
};
    });

    expect(result.keys).toEqual(
      expect.arrayContaining([
        "crewId",
        "member",
        "name",
        "score",
        "availability",
        "dateAvailability",
        "eligible",
        "available",
        "active",
        "conflict",
        "workload",
        "workloadCount",
        "preferenceScore",
        "preferenceMatches",
        "reasons"
      ])
      
    );
    expect(result.explanationKeys)
  .toEqual(
    expect.arrayContaining([
      "score",
      "available",
      "availability",
      "dateAvailability",
      "eligible",
      "conflict",
      "workload",
      "preferenceScore",
      "preferenceMatches",
      "highlights",
      "reasons"
    ])
  );
expect(
  result.explanationHighlightsIsArray
).toBe(true);

expect(
  result.explanationHighlights.length
).toBeGreaterThan(0);

expect(
  result.explanationHighlights[0]
).toEqual(
  expect.objectContaining({
    type: expect.any(String),
    priority: expect.any(Number),
    label: expect.any(String)
  })
);

    expect(result.workload)
      .toBe(result.workloadCount);

    expect(result.reasonsIsArray).toBe(true);
expect(
  result.explanationReasonsIsArray
).toBe(true);

    expect(
      result.preferenceMatchesIsArray
    ).toBe(true);
  });

  test("best recommendation accepts the same options context", async ({
    page
  }) => {
    const result = await page.evaluate(() => {
      const members = crewService.getAll().slice(0, 2);

      if (members.length < 2) {
        throw new Error(
          "Options test requires two crew members."
        );
      }

      members.forEach(member => {
        member.active = true;
        member.levels = [];
      });

      const preferredMember = members[0];
      const assignedMember = members[1];

      preferredMember.preferences = {
        preferredCrewIds: [
          String(assignedMember.id)
        ],
        avoidedCrewIds: [],
        preferredLevels: []
      };

      const game = {
        id: "recommendation-options-game",
        date: "2099-09-02",
        time: "6:00 PM",
        level: "Varsity",
        assignments: []
      };

      const best =
        recommendationService.getBestCrewForGame(
          game,
          {
            assignedCrewIds: [
              assignedMember.id
            ]
          }
        );

      const preferred =
        recommendationService.scoreCrewForGame(
          preferredMember,
          game,
          {
            assignedCrewIds: [
              assignedMember.id
            ]
          }
        );

      return {
        bestCrewId: best?.crewId,
        preferredCrewId:
          preferredMember.id,
        preferenceScore:
          preferred.preferenceScore,
        matches:
          preferred.preferenceMatches,
        explanationHighlightsIsArray:
          Array.isArray(
            preferred.explanation.highlights
          ),
        explanationHighlights:
          preferred.explanation.highlights
      };
    });

    expect(result.preferenceScore)
      .toBeGreaterThan(0);

    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "preferred_partner"
        })
      ])
    );

    expect(String(result.bestCrewId))
      .toBe(String(result.preferredCrewId));
  });
});
