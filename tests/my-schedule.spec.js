import { test, expect } from "./fixtures/app.fixture.js";

test.describe("My Schedule", () => {
  test("shows an empty state when the umpire has no assigned games", async ({ app }) => {
    await app.page.evaluate(() => {
      const accountResult = accountService.createAccount({
        firstName: "Empty",
        lastName: "Schedule",
        email: "empty.schedule@example.com",
        password: "password123"
      });

      accountService.approveAccount(accountResult.data.id);

      loginService.login(
        "empty.schedule@example.com",
        "password123"
      );

      authService.loginAsUmpire();

      renderPage("my-schedule");
    });

    await expect(app.page.getByTestId("my-schedule")).toBeVisible();
    await expect(app.page.getByTestId("my-schedule-empty")).toBeVisible();
  });

  test("shows assigned games for the logged in umpire", async ({ app }) => {
    const game = await app.page.evaluate(() => {
      const accountResult = accountService.createAccount({
        firstName: "My",
        lastName: "Schedule",
        email: "my.schedule@example.com",
        password: "password123"
      });

      const crew = crewService.getAll()[0];

      accountService.approveAccount(accountResult.data.id);

      accountService.updateAccount(accountResult.data.id, {
        crewId: crew.id
      });

      loginService.login(
        "my.schedule@example.com",
        "password123"
      );

      authService.loginAsUmpire();

      const gameResult = gameService.create({
        date: "2099-01-15",
        time: "6:00 PM",
        field: "Field 1",
        level: "12U",
        homeTeam: "My Schedule Home",
        awayTeam: "My Schedule Away",
        gameType: "single"
      });

      const savedGame = gameService
        .getAll()
        .find(item => item.id === gameResult.data.id);

      savedGame.crewId = crew.id;
      savedGame.assignmentStatus = AssignmentStatus.ASSIGNED;

      renderPage("my-schedule");

      return savedGame;
    });

    await expect(app.page.getByTestId("my-schedule")).toBeVisible();
    await expect(app.page.getByTestId("my-schedule-table")).toBeVisible();

    await expect(
      app.page.getByTestId(`my-schedule-row-${game.id}`)
    ).toBeVisible();

    const row = app.page.getByTestId(`my-schedule-row-${game.id}`);

await expect(row).toContainText("My Schedule Away @ My Schedule Home");
await expect(row).toContainText("2099-01-15");
await expect(row).toContainText("6:00 PM");
await expect(row).toContainText("Field 1");
await expect(row).toContainText("12U");
  });
});

async function setupEnhancedMySchedule(
  app,
  {
    status = "assigned",
    locked = false
  } = {}
) {
  return app.page.evaluate(
    ({ assignmentStatus, isLocked }) => {
      const accountResult =
        accountService.createAccount({
          firstName: "Junior",
          lastName: "Umpire",
          email:
            `junior.schedule.${Date.now()}@example.com`,
          password: "password123"
        });

      const crewMembers =
        crewService.getAll();

      const junior = crewMembers[0];
      const partner = crewMembers.find(
        member =>
          String(member.id) !==
          String(junior.id)
      );

      if (!partner) {
        throw new Error(
          "Enhanced My Schedule tests require at least two crew members."
        );
      }

      accountService.approveAccount(
        accountResult.data.id
      );

      accountService.updateAccount(
        accountResult.data.id,
        {
          crewId: junior.id
        }
      );

      loginService.login(
        accountResult.data.email,
        "password123"
      );

      authService.loginAsUmpire();

      const gameResult = gameService.create({
        date: "2099-02-20",
        time: "6:00 PM",
        field: "Junior Field",
        level: "12U",
        homeTeam: "Junior Home",
        awayTeam: "Junior Away",
        gameType: "single"
      });

      const game = gameService
        .getAll()
        .find(
          item =>
            String(item.id) ===
            String(gameResult.data.id)
        );

      const assignments =
        assignmentService.getAssignments(game);

      const juniorAssignment =
        assignments[0];

      juniorAssignment.crewId =
        junior.id;

      juniorAssignment.position =
        "Plate";

      juniorAssignment.status =
        assignmentStatus;

      juniorAssignment.locked =
        isLocked;

      let partnerAssignment =
        assignments[1];

      if (!partnerAssignment) {
        partnerAssignment = {
          id: `${game.id}-base`,
          gameId: game.id,
          position: "Base",
          crewId: "",
          status: "needs_assignment",
          locked: false,
          claimedBy: ""
        };

        game.assignments.push(
          partnerAssignment
        );
      }

      partnerAssignment.crewId =
        partner.id;

      partnerAssignment.position =
        "Base";

      partnerAssignment.status =
        "assigned";

      partnerAssignment.locked =
        false;

      game.crewId = junior.id;
      game.assignmentStatus =
        assignmentStatus;

      if (
        typeof gameService.save ===
        "function"
      ) {
        gameService.save();
      }

      renderPage("my-schedule");

      return {
        gameId: game.id,
        partnerName:
          crewService.getDisplayName(
            partner.id
          )
      };
    },
    {
      assignmentStatus: status,
      isLocked: locked
    }
  );
}

test.describe(
  "Enhanced My Schedule assignment cards",
  () => {
    test(
      "renders the enhanced assignment information",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        const row = app.page.getByTestId(
          `my-schedule-row-${result.gameId}`
        );

        await expect(row).toBeVisible();
        await expect(row).toContainText(
          "Junior Away @ Junior Home"
        );
        await expect(row).toContainText(
          "Junior Field"
        );
        await expect(row).toContainText(
          "12U"
        );
      }
    );

    test(
      "displays the umpire position",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        await expect(
          app.page.getByTestId(
            `my-schedule-position-${result.gameId}`
          )
        ).toHaveText("Plate");
      }
    );

    test(
      "displays assigned partners and their positions",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        const partners =
          app.page.getByTestId(
            `my-schedule-partners-${result.gameId}`
          );

        await expect(partners).toContainText(
          result.partnerName
        );

        await expect(partners).toContainText(
          "Base"
        );
      }
    );

    test(
      "displays the arrival recommendation",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        const arrival =
          app.page.getByTestId(
            `my-schedule-arrival-${result.gameId}`
          );

        await expect(arrival).toContainText(
          "Arrive by 5:30 PM"
        );

        await expect(arrival).toContainText(
          "30 minutes before game time"
        );
      }
    );

    test(
      "displays the assigned status badge",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        await expect(
          app.page.getByTestId(
            `my-schedule-badge-${result.gameId}-assigned`
          )
        ).toHaveText("Assigned");
      }
    );

    test(
      "displays the locked status badge",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(
            app,
            {
              status: "locked",
              locked: true
            }
          );

        await expect(
          app.page.getByTestId(
            `my-schedule-badge-${result.gameId}-locked`
          )
        ).toHaveText("Locked");
      }
    );
  }
);

test.describe(
  "My Schedule game day guidance",
  () => {
    test(
      "shows that an assigned umpire is ready for game day",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(
            app,
            {
              status: "assigned"
            }
          );

        const gameDay =
          app.page.getByTestId(
            `my-schedule-game-day-${result.gameId}`
          );

        await expect(gameDay).toContainText(
          "Ready for game day"
        );

        await expect(gameDay).toContainText(
          "No action needed."
        );

        await expect(
          gameDay.locator(
            "[data-requires-attention]"
          )
        ).toHaveAttribute(
          "data-requires-attention",
          "false"
        );
      }
    );

    test(
      "shows that a claimed assignment is waiting for approval",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(
            app,
            {
              status: "pending_approval"
            }
          );

        const gameDay =
          app.page.getByTestId(
            `my-schedule-game-day-${result.gameId}`
          );

        await expect(gameDay).toContainText(
          "Waiting for approval"
        );

        await expect(gameDay).toContainText(
          "Your claim has been submitted."
        );
      }
    );

    test(
      "shows that a locked assignment is confirmed",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(
            app,
            {
              status: "locked",
              locked: true
            }
          );

        const gameDay =
          app.page.getByTestId(
            `my-schedule-game-day-${result.gameId}`
          );

        await expect(gameDay).toContainText(
          "Assignment confirmed"
        );

        await expect(gameDay).toContainText(
          "Everything is finalized."
        );

        await expect(
          gameDay.locator(
            "[data-requires-attention]"
          )
        ).toHaveAttribute(
          "data-requires-attention",
          "false"
        );
      }
    );
  }
);

test.describe(
  "My Schedule game day checklist",
  () => {
    test(
      "renders the game day checklist",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        const checklist =
          app.page.getByTestId(
            `my-schedule-checklist-${result.gameId}`
          );

        await expect(checklist).toBeVisible();

        await expect(checklist).toContainText(
          "Uniform ready"
        );

        await expect(checklist).toContainText(
          "Equipment packed"
        );

        await expect(checklist).toContainText(
          "Arrive by 5:30 PM"
        );

        await expect(checklist).toContainText(
          "Assignment confirmed"
        );
      }
    );

    test(
      "shows plate-specific equipment guidance",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        await expect(
          app.page.getByTestId(
            `my-schedule-checklist-item-${result.gameId}-equipment`
          )
        ).toContainText(
          "plate protective gear"
        );
      }
    );

    test(
      "includes the assigned position in the checklist",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        await expect(
          app.page.getByTestId(
            `my-schedule-checklist-item-${result.gameId}-assignment`
          )
        ).toContainText(
          "You are working Plate."
        );
      }
    );

    test(
      "marks confirmed assignments as complete",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        await expect(
          app.page.getByTestId(
            `my-schedule-checklist-item-${result.gameId}-assignment`
          )
        ).toHaveAttribute(
          "data-checklist-status",
          "complete"
        );
      }
    );
  }
);

async function setupMyScheduleGameInformation(
  app,
  gameInformation = {}
) {
  return app.page.evaluate(
    information => {
      const accountResult =
        accountService.createAccount({
          firstName: "Game",
          lastName: "Information",
          email:
            `game.information.${Date.now()}@example.com`,
          password: "password123"
        });

      const crew = crewService.getAll()[0];

      accountService.approveAccount(
        accountResult.data.id
      );

      accountService.updateAccount(
        accountResult.data.id,
        {
          crewId: crew.id
        }
      );

      loginService.login(
        accountResult.data.email,
        "password123"
      );

      authService.loginAsUmpire();

      const gameResult = gameService.create({
        date: "2099-03-15",
        time: "7:00 PM",
        field: information.field || "Field 7",
        level: "13U",
        homeTeam: "Information Home",
        awayTeam: "Information Away",
        gameType: "single"
      });

      const game = gameService
        .getAll()
        .find(
          item =>
            String(item.id) ===
            String(gameResult.data.id)
        );

      game.crewId = crew.id;
      game.assignmentStatus = "assigned";

      Object.assign(game, information);

      if (
        typeof gameService.save ===
        "function"
      ) {
        gameService.save();
      }

      renderPage("my-schedule");

      return {
        gameId: game.id
      };
    },
    gameInformation
  );
}

test.describe(
  "My Schedule game information",
  () => {
    test(
      "renders enhanced game information",
      async ({ app }) => {
        const result =
          await setupMyScheduleGameInformation(
            app,
            {
              field: "Championship Field",
              venue: "BlueCrew Sports Complex",
              address: "100 Umpire Way",
              notes: "Tournament semifinal",
              specialInstructions:
                "Enter through the east gate"
            }
          );

        const information =
          app.page.getByTestId(
            `my-schedule-game-information-${result.gameId}`
          );

        await expect(information).toContainText(
          "Championship Field"
        );

        await expect(information).toContainText(
          "BlueCrew Sports Complex"
        );

        await expect(information).toContainText(
          "100 Umpire Way"
        );

        await expect(information).toContainText(
          "Tournament semifinal"
        );

        await expect(information).toContainText(
          "Enter through the east gate"
        );
      }
    );

    test(
      "renders the optional venue and address",
      async ({ app }) => {
        const result =
          await setupMyScheduleGameInformation(
            app,
            {
              venue: "Junior Baseball Park",
              address: "25 Main Street"
            }
          );

        await expect(
          app.page.getByTestId(
            `my-schedule-venue-${result.gameId}`
          )
        ).toHaveText(
          "Junior Baseball Park"
        );

        await expect(
          app.page.getByTestId(
            `my-schedule-address-${result.gameId}`
          )
        ).toHaveText(
          "25 Main Street"
        );
      }
    );

    test(
      "renders optional game notes",
      async ({ app }) => {
        const result =
          await setupMyScheduleGameInformation(
            app,
            {
              notes:
                "Meet the crew behind home plate."
            }
          );

        await expect(
          app.page.getByTestId(
            `my-schedule-notes-${result.gameId}`
          )
        ).toContainText(
          "Meet the crew behind home plate."
        );
      }
    );

    test(
      "omits unavailable optional game information",
      async ({ app }) => {
        const result =
          await setupMyScheduleGameInformation(
            app,
            {
              field: "Field 7",
              venue: "",
              address: "",
              notes: "",
              specialInstructions: ""
            }
          );

        const information =
          app.page.getByTestId(
            `my-schedule-game-information-${result.gameId}`
          );

        await expect(information).toContainText(
          "Field 7"
        );

        await expect(
          app.page.getByTestId(
            `my-schedule-venue-${result.gameId}`
          )
        ).toHaveCount(0);

        await expect(
          app.page.getByTestId(
            `my-schedule-address-${result.gameId}`
          )
        ).toHaveCount(0);

        await expect(
          app.page.getByTestId(
            `my-schedule-notes-${result.gameId}`
          )
        ).toHaveCount(0);

        await expect(
          app.page.getByTestId(
            `my-schedule-special-instructions-${result.gameId}`
          )
        ).toHaveCount(0);

        await expect(information).not.toContainText(
          "Unavailable"
        );

        await expect(information).not.toContainText(
          "N/A"
        );
      }
    );
  }
);

async function setupMyScheduleContacts(
  app,
  {
    primaryContact = null,
    partnerContact = null
  } = {}
) {
  return app.page.evaluate(
    ({
      configuredPrimaryContact,
      configuredPartnerContact
    }) => {
      const accountResult =
        accountService.createAccount({
          firstName: "Contact",
          lastName: "Junior",
          email:
            `contact.junior.${Date.now()}@example.com`,
          password: "password123"
        });

      const crewMembers =
        crewService.getAll();

      const junior = crewMembers[0];

      const partner =
        crewMembers.find(
          member =>
            String(member.id) !==
            String(junior.id)
        );

      if (!partner) {
        throw new Error(
          "Contact tests require two crew members."
        );
      }

      accountService.approveAccount(
        accountResult.data.id
      );

      accountService.updateAccount(
        accountResult.data.id,
        {
          crewId: junior.id
        }
      );

      loginService.login(
        accountResult.data.email,
        "password123"
      );

      authService.loginAsUmpire();

      if (configuredPartnerContact) {
        partner.phone =
          configuredPartnerContact.phone || "";

        partner.email =
          configuredPartnerContact.email || "";
      } else {
        partner.phone = "";
        partner.email = "";
      }

      const gameResult =
        gameService.create({
          date: "2099-04-10",
          time: "6:30 PM",
          field: "Contact Field",
          level: "12U",
          homeTeam: "Contact Home",
          awayTeam: "Contact Away",
          gameType: "single"
        });

      const game = gameService
        .getAll()
        .find(
          item =>
            String(item.id) ===
            String(gameResult.data.id)
        );

      const assignments =
        assignmentService.getAssignments(
          game
        );

      assignments[0].crewId =
        junior.id;

      assignments[0].position =
        "Plate";

      assignments[0].status =
        "assigned";

      let partnerAssignment =
        assignments[1];

      if (!partnerAssignment) {
        partnerAssignment = {
          id: `${game.id}-base`,
          gameId: game.id,
          position: "Base",
          crewId: partner.id,
          status: "assigned",
          locked: false,
          claimedBy: ""
        };

        game.assignments.push(
          partnerAssignment
        );
      } else {
        partnerAssignment.crewId =
          partner.id;

        partnerAssignment.position =
          "Base";

        partnerAssignment.status =
          "assigned";
      }

      game.crewId = junior.id;
      game.assignmentStatus =
        "assigned";

      if (configuredPrimaryContact) {
        game.contact = {
          name:
            configuredPrimaryContact.name,
          role:
            configuredPrimaryContact.role,
          phone:
            configuredPrimaryContact.phone,
          email:
            configuredPrimaryContact.email
        };
      }

      if (
        typeof gameService.save ===
        "function"
      ) {
        gameService.save();
      }

      renderPage("my-schedule");

      return {
        gameId: game.id,
        partnerId: partner.id,
        partnerName:
          crewService.getDisplayName(
            partner.id
          )
      };
    },
    {
      configuredPrimaryContact:
        primaryContact,
      configuredPartnerContact:
        partnerContact
    }
  );
}

test.describe(
  "My Schedule game day contacts",
  () => {
    test(
      "renders the configured game contact",
      async ({ app }) => {
        const result =
          await setupMyScheduleContacts(
            app,
            {
              primaryContact: {
                name: "Alex Assignor",
                role: "Assignor",
                phone: "555-0100",
                email:
                  "alex.assignor@example.com"
              }
            }
          );

        const contact =
          app.page.getByTestId(
            `my-schedule-contact-${result.gameId}-primary`
          );

        await expect(contact).toContainText(
          "Alex Assignor"
        );

        await expect(contact).toContainText(
          "Assignor"
        );

        await expect(contact).toContainText(
          "555-0100"
        );

        await expect(contact).toContainText(
          "alex.assignor@example.com"
        );
      }
    );

    test(
      "renders partner contact details",
      async ({ app }) => {
        const result =
          await setupMyScheduleContacts(
            app,
            {
              partnerContact: {
                phone: "555-0111",
                email:
                  "partner@example.com"
              }
            }
          );

        const contact =
          app.page.getByTestId(
            `my-schedule-contact-${result.gameId}-partner-${result.partnerId}`
          );

        await expect(contact).toContainText(
          result.partnerName
        );

        await expect(contact).toContainText(
          "Base"
        );

        await expect(contact).toContainText(
          "555-0111"
        );

        await expect(contact).toContainText(
          "partner@example.com"
        );
      }
    );

    test(
      "renders clickable phone and email links",
      async ({ app }) => {
        const result =
          await setupMyScheduleContacts(
            app,
            {
              primaryContact: {
                name: "Game Contact",
                phone: "555-0122",
                email:
                  "contact@example.com"
              }
            }
          );

        await expect(
          app.page.getByTestId(
            `my-schedule-contact-phone-${result.gameId}-primary`
          )
        ).toHaveAttribute(
          "href",
          "tel:555-0122"
        );

        await expect(
          app.page.getByTestId(
            `my-schedule-contact-email-${result.gameId}-primary`
          )
        ).toHaveAttribute(
          "href",
          "mailto:contact@example.com"
        );
      }
    );

    test(
      "omits contacts when no contact details are available",
      async ({ app }) => {
        const result =
          await setupMyScheduleContacts(
            app
          );

        const contacts =
          app.page.getByTestId(
            `my-schedule-contacts-${result.gameId}`
          );

        await expect(contacts).toBeAttached();

        await expect(
          contacts.locator(
            ".my-schedule-contact"
          )
        ).toHaveCount(0);

        await expect(contacts).not.toContainText(
          "Unavailable"
        );

        await expect(contacts).not.toContainText(
          "N/A"
        );
      }
    );
  }
);

async function setupMyScheduleConditions(
  app,
  conditions = {}
) {
  return app.page.evaluate(
    configuredConditions => {
      const accountResult =
        accountService.createAccount({
          firstName: "Conditions",
          lastName: "Junior",
          email:
            `conditions.junior.${Date.now()}@example.com`,
          password: "password123"
        });

      const crew = crewService.getAll()[0];

      accountService.approveAccount(
        accountResult.data.id
      );

      accountService.updateAccount(
        accountResult.data.id,
        {
          crewId: crew.id
        }
      );

      loginService.login(
        accountResult.data.email,
        "password123"
      );

      authService.loginAsUmpire();

      const gameResult =
        gameService.create({
          date: "2099-05-20",
          time: "6:00 PM",
          field: "Conditions Field",
          level: "12U",
          homeTeam: "Conditions Home",
          awayTeam: "Conditions Away",
          gameType: "single"
        });

      const game = gameService
        .getAll()
        .find(
          item =>
            String(item.id) ===
            String(gameResult.data.id)
        );

      game.crewId = crew.id;
      game.assignmentStatus =
        "assigned";

      game.conditions = {
        ...configuredConditions
      };

      if (
        typeof gameService.save ===
        "function"
      ) {
        gameService.save();
      }

      renderPage("my-schedule");

      return {
        gameId: game.id
      };
    },
    conditions
  );
}

test.describe(
  "My Schedule game conditions",
  () => {
    test(
      "renders structured weather and field conditions",
      async ({ app }) => {
        const result =
          await setupMyScheduleConditions(
            app,
            {
              summary: "Cloudy",
              temperature: "72°F",
              weatherAdvisory:
                "Light rain possible before game time.",
              fieldStatus: "Open",
              advisory:
                "Bring a light jacket."
            }
          );

        const conditions =
          app.page.getByTestId(
            `my-schedule-conditions-${result.gameId}`
          );

        await expect(conditions).toContainText(
          "Cloudy"
        );

        await expect(conditions).toContainText(
          "72°F"
        );

        await expect(conditions).toContainText(
          "Light rain possible before game time."
        );

        await expect(conditions).toContainText(
          "Open"
        );

        await expect(conditions).toContainText(
          "Bring a light jacket."
        );
      }
    );

    test(
      "renders a cancellation notice",
      async ({ app }) => {
        const result =
          await setupMyScheduleConditions(
            app,
            {
              cancellationNotice:
                "Game canceled due to field conditions."
            }
          );

        await expect(
          app.page.getByTestId(
            `my-schedule-cancellation-notice-${result.gameId}`
          )
        ).toContainText(
          "Game canceled due to field conditions."
        );
      }
    );

    test(
      "renders field status independently",
      async ({ app }) => {
        const result =
          await setupMyScheduleConditions(
            app,
            {
              fieldStatus:
                "Delayed pending field inspection."
            }
          );

        await expect(
          app.page.getByTestId(
            `my-schedule-field-status-${result.gameId}`
          )
        ).toContainText(
          "Delayed pending field inspection."
        );
      }
    );

    test(
      "omits unavailable condition details",
      async ({ app }) => {
        const result =
          await setupMyScheduleConditions(
            app
          );

        const conditions =
          app.page.getByTestId(
            `my-schedule-conditions-${result.gameId}`
          );

        await expect(conditions).toBeAttached();

        await expect(
          app.page.getByTestId(
            `my-schedule-weather-summary-${result.gameId}`
          )
        ).toHaveCount(0);

        await expect(
          app.page.getByTestId(
            `my-schedule-temperature-${result.gameId}`
          )
        ).toHaveCount(0);

        await expect(
          app.page.getByTestId(
            `my-schedule-weather-advisory-${result.gameId}`
          )
        ).toHaveCount(0);

        await expect(
          app.page.getByTestId(
            `my-schedule-field-status-${result.gameId}`
          )
        ).toHaveCount(0);

        await expect(
          app.page.getByTestId(
            `my-schedule-cancellation-notice-${result.gameId}`
          )
        ).toHaveCount(0);

        await expect(
          app.page.getByTestId(
            `my-schedule-game-day-advisory-${result.gameId}`
          )
        ).toHaveCount(0);

        await expect(conditions).not.toContainText(
          "Unavailable"
        );

        await expect(conditions).not.toContainText(
          "N/A"
        );
      }
    );
  }
);

test.describe(
  "My Schedule game day timeline",
  () => {
    test(
      "renders the complete game day timeline",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        const timeline =
          app.page.getByTestId(
            `my-schedule-timeline-${result.gameId}`
          );

        await expect(timeline).toBeVisible();

        await expect(timeline).toContainText(
          "Before leaving"
        );

        await expect(timeline).toContainText(
          "Arrival"
        );

        await expect(timeline).toContainText(
          "At the field"
        );

        await expect(timeline).toContainText(
          "Before first pitch"
        );

        await expect(timeline).toContainText(
          "During the game"
        );

        await expect(timeline).toContainText(
          "After the game"
        );
      }
    );

    test(
      "uses the arrival recommendation in the timeline",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        const arrival =
          app.page.getByTestId(
            `my-schedule-timeline-item-${result.gameId}-arrival`
          );

        await expect(arrival).toContainText(
          "Arrive by 5:30 PM"
        );

        await expect(arrival).toContainText(
          "Junior Field"
        );

        await expect(arrival).toContainText(
          "30 minutes before game time"
        );
      }
    );

    test(
      "includes partner guidance in the timeline",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        const meet =
          app.page.getByTestId(
            `my-schedule-timeline-item-${result.gameId}-meet`
          );

        await expect(meet).toContainText(
          result.partnerName
        );

        await expect(meet).toContainText(
          "Junior Field"
        );
      }
    );

    test(
      "includes plate-specific pregame guidance",
      async ({ app }) => {
        const result =
          await setupEnhancedMySchedule(app);

        const pregame =
          app.page.getByTestId(
            `my-schedule-timeline-item-${result.gameId}-pregame`
          );

        await expect(pregame).toContainText(
          "Meet with the coaches"
        );

        await expect(pregame).toContainText(
          "review ground rules"
        );

        await expect(pregame).toContainText(
          "confirm game balls"
        );
      }
    );
  }
);
