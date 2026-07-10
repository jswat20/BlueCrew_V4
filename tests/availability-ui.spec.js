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
      });

      if (typeof saveCrew === "function") {
        saveCrew();
      }

      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
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
