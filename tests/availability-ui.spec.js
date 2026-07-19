import {
  test,
  expect
} from "./fixtures/app.fixture.js";

const {
  AvailabilityPage
} = require("./pages/AvailabilityPage.js");

test.describe("Availability Management UI", () => {
  test.beforeEach(async ({ app }) => {
    await app.page.evaluate(() => {
      crewService.getAll().forEach(member => {
        delete member.dateAvailability;
        delete member.availabilityTimeWindows;
      });

      if (typeof saveCrew === "function") {
        saveCrew();
      }

      authService.loginAsUmpire();
      document.body.dataset.role = "umpire";
    });
  });

  test("creates availability", async ({ app }) => {
    const availabilityPage =
      new AvailabilityPage(app.page);

    const crewMember =
      await app.page.evaluate(() => {
        return crewService.getAll()[0];
      });

    await availabilityPage.open();

    await availabilityPage.save({
      crewId: crewMember.id,
      date: "2026-09-10",
      status: "unavailable"
    });

    await availabilityPage.expectEntry({
      date: "2026-09-10",
      status: "unavailable"
    });

    const savedStatus =
      await app.page.evaluate(
        ({ crewId, date }) => {
          return availabilityService
            .getAvailability(crewId, date);
        },
        {
          crewId: crewMember.id,
          date: "2026-09-10"
        }
      );

    expect(savedStatus).toBe("unavailable");
  });

  test("admin sees a read-only availability finder with optional filters", async ({ app }) => {
    await app.page.evaluate(() => {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
      renderPage("availability");
    });
    await expect(app.page.getByTestId("availability-form")).toHaveCount(0);
    await expect(app.page.getByTestId("availability-finder")).toBeVisible();
    await app.page.getByTestId("identify-available-crew").click();
    await expect(app.page.getByTestId("availability-finder-card").first()).toBeVisible();
  });

  test("creates a granular availability time window", async ({ app }) => {
    const crewId = await app.page.evaluate(() => crewService.getAll()[0].id);
    await app.page.evaluate(() => navigateTo("availability"));
    await app.page.getByTestId("availability-crew-select").selectOption(String(crewId));
    await app.page.getByTestId("availability-date-input").fill("2026-09-12");
    await app.page.getByTestId("availability-start-time").fill("13:00");
    await app.page.getByTestId("availability-end-time").fill("17:30");
    await app.page.getByTestId("availability-save").click();
    await expect(app.page.getByTestId("availability-entry-window")).toHaveText("1:00 PM–5:30 PM");
  });

  test("edits availability", async ({ app }) => {
    const availabilityPage =
      new AvailabilityPage(app.page);

    const crewMember =
      await app.page.evaluate(() => {
        const member =
          crewService.getAll()[0];

        availabilityService.setAvailability({
          crewId: member.id,
          date: "2026-09-11",
          status: "maybe"
        });

        return member;
      });

    await availabilityPage.open();

    await availabilityPage.selectCrew(
      crewMember.id
    );

    await availabilityPage.edit(
      "2026-09-11"
    );

    await expect(
      availabilityPage.dateInput
    ).toHaveValue("2026-09-11");

    await expect(
      app.page.getByTestId(
        "availability-status-maybe"
      )
    ).toBeChecked();

    await availabilityPage.chooseStatus(
      "available"
    );

    await availabilityPage.saveButton.click();

    await availabilityPage.expectEntry({
      date: "2026-09-11",
      status: "available"
    });

    await expect(
      availabilityPage.entryForDate(
        "2026-09-11"
      )
    ).toHaveCount(1);
  });

  test("removes availability", async ({ app }) => {
    const availabilityPage =
      new AvailabilityPage(app.page);

    await app.page.evaluate(() => {
      const member =
        crewService.getAll()[0];

      availabilityService.setAvailability({
        crewId: member.id,
        date: "2026-09-12",
        status: "unavailable"
      });
    });

    await availabilityPage.open();

    await expect(
      availabilityPage.entryForDate(
        "2026-09-12"
      )
    ).toBeVisible();

    await availabilityPage.remove(
      "2026-09-12"
    );

    await expect(
      availabilityPage.entryForDate(
        "2026-09-12"
      )
    ).toHaveCount(0);

    await expect(
      app.page.getByTestId(
        "availability-empty"
      )
    ).toBeVisible();
  });

  test("displays each availability status correctly", async ({ app }) => {
    const availabilityPage =
      new AvailabilityPage(app.page);

    await app.page.evaluate(() => {
      const member =
        crewService.getAll()[0];

      availabilityService.setAvailability({
        crewId: member.id,
        date: "2026-09-13",
        status: "available"
      });

      availabilityService.setAvailability({
        crewId: member.id,
        date: "2026-09-14",
        status: "maybe"
      });

      availabilityService.setAvailability({
        crewId: member.id,
        date: "2026-09-15",
        status: "unavailable"
      });
    });

    await availabilityPage.open();

    await availabilityPage.expectEntry({
      date: "2026-09-13",
      status: "available"
    });

    await availabilityPage.expectEntry({
      date: "2026-09-14",
      status: "maybe"
    });

    await availabilityPage.expectEntry({
      date: "2026-09-15",
      status: "unavailable"
    });
  });

  test("persists availability after reload", async ({ app }) => {
    const availabilityPage =
      new AvailabilityPage(app.page);

    const crewMember =
      await app.page.evaluate(() => {
        return crewService.getAll()[0];
      });

    await availabilityPage.open();

    await availabilityPage.save({
      crewId: crewMember.id,
      date: "2026-09-16",
      status: "maybe"
    });

    await app.page.reload();

    await app.page.evaluate(crewId => {
      authService.loginAsCrew(crewId);
      document.body.dataset.role = "umpire";
      if (window.BlueCrew?.test) window.BlueCrew.test.currentRole = "umpire";
      if (window.qaService) window.qaService.setRole("umpire");
      if (typeof refreshNavigationAuthorization === "function") refreshNavigationAuthorization();
    }, crewMember.id);

    await availabilityPage.open();

    await availabilityPage.selectCrew(
      crewMember.id
    );

    await availabilityPage.expectEntry({
      date: "2026-09-16",
      status: "maybe"
    });

    const persistedStatus =
      await app.page.evaluate(
        ({ crewId, date }) => {
          return availabilityService
            .getAvailability(crewId, date);
        },
        {
          crewId: crewMember.id,
          date: "2026-09-16"
        }
      );

    expect(persistedStatus).toBe("maybe");
  });
});
