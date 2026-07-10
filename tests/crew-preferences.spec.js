const { test, expect } = require("@playwright/test");

async function seedScenario(
  page,
  {
    crewMembers,
    game = {
      id: "preference-game",
      date: "2099-06-15",
      time: "18:00",
      level: "Varsity",
      gameType: "single",
      crewSize: 2,
      assignments: []
    }
  }
) {
  await page.evaluate(
    ({ crewMembers, game }) => {
      crew.splice(
        0,
        crew.length,
        ...crewMembers.map(member => ({
          active: true,
          levels: [],
          availability: {},
          ...member
        }))
      );

      games.splice(
        0,
        games.length,
        {
          ...game,
          assignments: Array.isArray(game.assignments)
            ? game.assignments.map(assignment => ({
                claimedBy: "",
                status: assignment.crewId
                  ? "assigned"
                  : "needs_assignment",
                locked: false,
                ...assignment
              }))
            : []
        }
      );

      if (
        typeof crewBuilderService !== "undefined" &&
        typeof crewBuilderService.discard === "function"
      ) {
        crewBuilderService.discard();
      }
    },
    {
      crewMembers,
      game
    }
  );
}

test.describe("Crew Preference Engine", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("existing crew without preferences remains supported", async ({
    page
  }) => {
    await seedScenario(page, {
      crewMembers: [
        {
          id: "crew-a",
          firstName: "Alex",
          lastName: "Official"
        }
      ]
    });

    const result = await page.evaluate(() => {
      const member = crewService.getById("crew-a");

      return {
        preferences: crewService.getPreferences(member),
        recommendation:
          recommendationService.scoreCrewForGame(
            member,
            games[0]
          )
      };
    });

    expect(result.preferences).toEqual({
      preferredCrewIds: [],
      avoidedCrewIds: [],
      preferredLevels: []
    });

    expect(result.recommendation.preferenceScore).toBe(0);
    expect(result.recommendation.preferenceMatches).toEqual([]);
  });

  test("preference arrays normalize safely and remove duplicates", async ({
    page
  }) => {
    await seedScenario(page, {
      crewMembers: [
        {
          id: "crew-a",
          firstName: "Alex",
          lastName: "Official",
          preferences: {
            preferredCrewIds: [
              "crew-b",
              "crew-b",
              "",
              null
            ],
            avoidedCrewIds: [
              "crew-c",
              "crew-c",
              ""
            ],
            preferredLevels: [
              "Varsity",
              "Varsity",
              "",
              null
            ]
          }
        }
      ]
    });

    const preferences = await page.evaluate(() =>
      crewService.getPreferences("crew-a")
    );

    expect(preferences).toEqual({
      preferredCrewIds: ["crew-b"],
      avoidedCrewIds: ["crew-c"],
      preferredLevels: ["Varsity"]
    });
  });

  test("crew cannot prefer or avoid themselves", async ({
    page
  }) => {
    await seedScenario(page, {
      crewMembers: [
        {
          id: "crew-a",
          firstName: "Alex",
          lastName: "Official",
          preferences: {
            preferredCrewIds: [
              "crew-a",
              "crew-b"
            ],
            avoidedCrewIds: [
              "crew-a",
              "crew-c"
            ],
            preferredLevels: []
          }
        }
      ]
    });

    const preferences = await page.evaluate(() =>
      crewService.getPreferences("crew-a")
    );

    expect(preferences.preferredCrewIds).toEqual([
      "crew-b"
    ]);

    expect(preferences.avoidedCrewIds).toEqual([
      "crew-c"
    ]);
  });

  test("the same partner cannot remain preferred and avoided", async ({
    page
  }) => {
    await seedScenario(page, {
      crewMembers: [
        {
          id: "crew-a",
          firstName: "Alex",
          lastName: "Official",
          preferences: {
            preferredCrewIds: [
              "crew-b",
              "crew-c"
            ],
            avoidedCrewIds: ["crew-b"],
            preferredLevels: []
          }
        }
      ]
    });

    const preferences = await page.evaluate(() =>
      crewService.getPreferences("crew-a")
    );

    expect(preferences.preferredCrewIds).toEqual([
      "crew-c"
    ]);

    expect(preferences.avoidedCrewIds).toEqual([
      "crew-b"
    ]);
  });

  test("setPreferences persists normalized preferences", async ({
    page
  }) => {
    await seedScenario(page, {
      crewMembers: [
        {
          id: "crew-a",
          firstName: "Alex",
          lastName: "Official"
        }
      ]
    });

    const result = await page.evaluate(() => {
      const saveResult = crewService.setPreferences(
        "crew-a",
        {
          preferredCrewIds: [
            "crew-a",
            "crew-b",
            "crew-b"
          ],
          avoidedCrewIds: [
            "crew-c",
            "crew-b"
          ],
          preferredLevels: [
            "Varsity",
            "Varsity"
          ]
        }
      );

      return {
        saveResult,
        stored:
          crewService.getById("crew-a")
            .preferences
      };
    });

    expect(result.saveResult.success).toBe(true);

    expect(result.stored).toEqual({
      preferredCrewIds: [],
      avoidedCrewIds: [
        "crew-c",
        "crew-b"
      ],
      preferredLevels: ["Varsity"]
    });
  });

  test("preferred partner increases score only when assigned", async ({
    page
  }) => {
    await seedScenario(page, {
      crewMembers: [
        {
          id: "crew-a",
          firstName: "Alex",
          lastName: "Official",
          preferences: {
            preferredCrewIds: ["crew-b"]
          }
        },
        {
          id: "crew-b",
          firstName: "Blake",
          lastName: "Partner"
        }
      ]
    });

    const result = await page.evaluate(() => {
      const member = crewService.getById("crew-a");
      const game = games[0];

      const withoutPartner =
        recommendationService.scoreCrewForGame(
          member,
          game
        );

      const withPartner =
        recommendationService.scoreCrewForGame(
          member,
          game,
          {
            assignedCrewIds: ["crew-b"]
          }
        );

      return {
        withoutPartner,
        withPartner
      };
    });

    expect(
      result.withPartner.score -
        result.withoutPartner.score
    ).toBe(20);

    expect(
      result.withPartner.preferenceScore
    ).toBe(20);

    expect(
      result.withPartner.preferenceMatches
    ).toContainEqual({
      type: "preferred_partner",
      crewId: "crew-b",
      score: 20
    });

    expect(result.withPartner.reasons).toContain(
      "Preferred partner is already assigned to this game."
    );
  });

  test("avoided partner decreases score only when assigned", async ({
    page
  }) => {
    await seedScenario(page, {
      crewMembers: [
        {
          id: "crew-a",
          firstName: "Alex",
          lastName: "Official",
          preferences: {
            avoidedCrewIds: ["crew-c"]
          }
        },
        {
          id: "crew-c",
          firstName: "Casey",
          lastName: "Partner"
        }
      ]
    });

    const result = await page.evaluate(() => {
      const member = crewService.getById("crew-a");
      const game = games[0];

      const withoutPartner =
        recommendationService.scoreCrewForGame(
          member,
          game
        );

      const withPartner =
        recommendationService.scoreCrewForGame(
          member,
          game,
          {
            assignedCrewIds: ["crew-c"]
          }
        );

      return {
        withoutPartner,
        withPartner
      };
    });

    expect(
      result.withPartner.score -
        result.withoutPartner.score
    ).toBe(-30);

    expect(
      result.withPartner.preferenceScore
    ).toBe(-30);

    expect(result.withPartner.reasons).toContain(
      "An avoided partner is already assigned to this game."
    );
  });

  test("preferred game level increases score", async ({
    page
  }) => {
    await seedScenario(page, {
      crewMembers: [
        {
          id: "crew-a",
          firstName: "Alex",
          lastName: "Official",
          preferences: {
            preferredLevels: ["Varsity", "JV"]
          }
        }
      ]
    });

    const result = await page.evaluate(() => {
      const member = crewService.getById("crew-a");
      const game = games[0];

      const recommendation =
        recommendationService.scoreCrewForGame(
          member,
          game
        );

      return recommendation;
    });

    expect(result.preferenceScore).toBe(10);

    expect(result.preferenceMatches).toContainEqual({
      type: "preferred_level",
      level: "Varsity",
      score: 10
    });

    expect(result.reasons).toContain(
      "Crew member prefers this game level."
    );
  });

  test("preferences do not change eligibility or create conflicts", async ({
    page
  }) => {
    await seedScenario(page, {
      crewMembers: [
        {
          id: "crew-a",
          firstName: "Alex",
          lastName: "Official",
          levels: ["Varsity"],
          preferences: {
            avoidedCrewIds: ["crew-b"],
            preferredLevels: ["Varsity"]
          }
        },
        {
          id: "crew-b",
          firstName: "Blake",
          lastName: "Partner"
        }
      ]
    });

    const result = await page.evaluate(() =>
      recommendationService.scoreCrewForGame(
        crewService.getById("crew-a"),
        games[0],
        {
          assignedCrewIds: ["crew-b"]
        }
      )
    );

    expect(result.eligible).toBe(true);
    expect(result.conflict).toBe(false);
    expect(result.preferenceScore).toBe(-20);
  });

test("avoided partners remain manually assignable", async ({
  page
}) => {
  await seedScenario(page, {
    crewMembers: [
      {
        id: "crew-a",
        firstName: "Alex",
        lastName: "Assigned"
      },
      {
        id: "crew-b",
        firstName: "Blake",
        lastName: "Avoids Alex",
        preferences: {
          avoidedCrewIds: ["crew-a"]
        }
      }
    ],
    game: {
      id: "manual-preference-game",
      date: "2099-06-15",
      time: "18:00",
      level: "Varsity",
      gameType: "single",
      crewSize: 2,
      assignments: [
        {
          id: "manual-plate",
          gameId: "manual-preference-game",
          position: "Plate",
          crewId: "crew-a",
          status: "assigned"
        },
        {
          id: "manual-base",
          gameId: "manual-preference-game",
          position: "Base",
          crewId: "",
          status: "needs_assignment"
        }
      ]
    }
  });

  const result = await page.evaluate(() =>
    assignmentService.assignToAssignment(
      "manual-preference-game",
      "manual-base",
      "crew-b"
    )
  );

  expect(result.success).toBe(true);

  const assignedCrewId = await page.evaluate(() => {
    const game = games.find(
      game => String(game.id) === "manual-preference-game"
    );

    if (!game || !Array.isArray(game.assignments)) {
      return null;
    }

    const assignment = game.assignments.find(
      assignment => assignment.id === "manual-base"
    );

    return assignment ? assignment.crewId : null;
  });

  expect(assignedCrewId).toBe("crew-b");
});


  test("auto-fill prefers a candidate matching a locked partner", async ({
    page
  }) => {
    await seedScenario(page, {
      crewMembers: [
        {
          id: "crew-alpha",
          firstName: "Alpha",
          lastName: "Locked"
        },
        {
          id: "crew-neutral",
          firstName: "Able",
          lastName: "Neutral"
        },
        {
          id: "crew-preferred",
          firstName: "Beta",
          lastName: "Preferred",
          preferences: {
            preferredCrewIds: [
              "crew-alpha"
            ]
          }
        }
      ]
    });

    const result = await page.evaluate(() => {
      const game = games[0];

      crewBuilderService.createDraft(game);

      const draft =
        crewBuilderService.getDraft();

      draft.assignments = [
        {
          id: "locked-slot",
          gameId: game.id,
          position: "Plate",
          crewId: "crew-alpha",
          status: "locked",
          locked: true,
          claimedBy: ""
        },
        {
          id: "open-slot",
          gameId: game.id,
          position: "Base",
          crewId: "",
          status: "needs_assignment",
          locked: false,
          claimedBy: ""
        }
      ];

      crewBuilderService.autoFill();

      return draft.assignments;
    });

    expect(
      result.find(
        assignment =>
          assignment.id === "open-slot"
      ).crewId
    ).toBe("crew-preferred");

    expect(
      result.find(
        assignment =>
          assignment.id === "locked-slot"
      ).crewId
    ).toBe("crew-alpha");
  });

  test("auto-fill discourages an avoided pairing", async ({
    page
  }) => {
    await seedScenario(page, {
      crewMembers: [
        {
          id: "crew-alpha",
          firstName: "Alpha",
          lastName: "Locked"
        },
        {
          id: "crew-neutral",
          firstName: "Able",
          lastName: "Neutral"
        },
        {
          id: "crew-avoids",
          firstName: "Aaron",
          lastName: "Avoids Alpha",
          preferences: {
            avoidedCrewIds: [
              "crew-alpha"
            ]
          }
        }
      ]
    });

    const result = await page.evaluate(() => {
      const game = games[0];

      crewBuilderService.createDraft(game);

      const draft =
        crewBuilderService.getDraft();

      draft.assignments = [
        {
          id: "locked-slot",
          gameId: game.id,
          position: "Plate",
          crewId: "crew-alpha",
          status: "locked",
          locked: true,
          claimedBy: ""
        },
        {
          id: "open-slot",
          gameId: game.id,
          position: "Base",
          crewId: "",
          status: "needs_assignment",
          locked: false,
          claimedBy: ""
        }
      ];

      crewBuilderService.autoFill();

      return draft.assignments;
    });

    expect(
      result.find(
        assignment =>
          assignment.id === "open-slot"
      ).crewId
    ).toBe("crew-neutral");
  });

  test("auto-fill still uses an avoided pairing when it is the only valid option", async ({
    page
  }) => {
    await seedScenario(page, {
      crewMembers: [
        {
          id: "crew-alpha",
          firstName: "Alpha",
          lastName: "Locked"
        },
        {
          id: "crew-avoids",
          firstName: "Beta",
          lastName: "Avoids Alpha",
          preferences: {
            avoidedCrewIds: [
              "crew-alpha"
            ]
          }
        }
      ]
    });

    const result = await page.evaluate(() => {
      const game = games[0];

      crewBuilderService.createDraft(game);

      const draft =
        crewBuilderService.getDraft();

      draft.assignments = [
        {
          id: "locked-slot",
          gameId: game.id,
          position: "Plate",
          crewId: "crew-alpha",
          status: "locked",
          locked: true,
          claimedBy: ""
        },
        {
          id: "open-slot",
          gameId: game.id,
          position: "Base",
          crewId: "",
          status: "needs_assignment",
          locked: false,
          claimedBy: ""
        }
      ];

      crewBuilderService.autoFill();

      return draft.assignments;
    });

    expect(
      result.find(
        assignment =>
          assignment.id === "open-slot"
      ).crewId
    ).toBe("crew-avoids");
  });

  test("auto-fill reevaluates partner context after filling each slot", async ({
    page
  }) => {
    await seedScenario(page, {
      crewMembers: [
        {
          id: "crew-first",
          firstName: "Zed",
          lastName: "First",
          preferences: {
            preferredLevels: ["Varsity"]
          }
        },
        {
          id: "crew-neutral",
          firstName: "Able",
          lastName: "Neutral"
        },
        {
          id: "crew-partner",
          firstName: "Beta",
          lastName: "Partner",
          preferences: {
            preferredCrewIds: [
              "crew-first"
            ]
          }
        }
      ]
    });

    const result = await page.evaluate(() => {
      const game = games[0];

      crewBuilderService.createDraft(game);

      const draft =
        crewBuilderService.getDraft();

      draft.assignments = [
        {
          id: "slot-one",
          gameId: game.id,
          position: "Plate",
          crewId: "",
          status: "needs_assignment",
          locked: false,
          claimedBy: ""
        },
        {
          id: "slot-two",
          gameId: game.id,
          position: "Base",
          crewId: "",
          status: "needs_assignment",
          locked: false,
          claimedBy: ""
        }
      ];

      crewBuilderService.autoFill();

      return draft.assignments.map(
        assignment => assignment.crewId
      );
    });

    /*
     * Initial ranking:
     *   crew-first +10
     *   crew-neutral  0
     *   crew-partner  0
     *
     * After crew-first fills slot one:
     *   crew-partner receives +20 and must move
     *   ahead of crew-neutral.
     */
    expect(result).toEqual([
      "crew-first",
      "crew-partner"
    ]);
  });
});