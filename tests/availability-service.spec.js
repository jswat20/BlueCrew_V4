const { test, expect } = require("@playwright/test");

test.describe("Availability Service", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    await page.evaluate(() => {
      crewService.getAll().forEach(member => {
        delete member.dateAvailability;
        delete member.availabilityTimeWindows;
      });

      if (typeof saveCrew === "function") {
        saveCrew();
      }
    });
  });

  test("sets and gets availability", async ({ page }) => {
    const result = await page.evaluate(() => {
      const member = crewService.getAll()[0];

      const saved = availabilityService.setAvailability({
        crewId: member.id,
        date: "2026-08-14",
        status: "unavailable"
      });

      return {
        saved,
        status: availabilityService.getAvailability(
          member.id,
          "2026-08-14"
        ),
        entries: availabilityService.getCrewAvailability(member.id)
      };
    });

    expect(result.saved).toEqual({
      crewId: result.saved.crewId,
      date: "2026-08-14",
      status: "unavailable"
    });

    expect(result.status).toBe("unavailable");

    expect(result.entries).toEqual([
      {
        crewId: result.saved.crewId,
        date: "2026-08-14",
        status: "unavailable"
      }
    ]);
  });

  test("resolves availability against a saved time window", async ({ page }) => {
    const result = await page.evaluate(() => {
      const member = crewService.getAll()[0];
      const saved = availabilityService.setAvailability({ crewId: member.id, date: "2026-08-20", status: "available", startTime: "13:00", endTime: "17:00" });
      return {
        saved,
        during: availabilityService.getAvailability(member.id, "2026-08-20", "3:00 PM"),
        before: availabilityService.getAvailability(member.id, "2026-08-20", "10:00 AM"),
        entries: availabilityService.getCrewAvailability(member.id)
      };
    });
    expect(result.saved.startTime).toBe("13:00");
    expect(result.during).toBe("available");
    expect(result.before).toBe("unavailable");
    expect(result.entries[0]).toEqual(expect.objectContaining({ startTime: "13:00", endTime: "17:00" }));
  });

  test("overwrites existing availability", async ({ page }) => {
    const result = await page.evaluate(() => {
      const member = crewService.getAll()[0];

      availabilityService.setAvailability({
        crewId: member.id,
        date: "2026-08-15",
        status: "unavailable"
      });

      availabilityService.setAvailability({
        crewId: member.id,
        date: "2026-08-15",
        status: "maybe"
      });

      return {
        status: availabilityService.getAvailability(
          member.id,
          "2026-08-15"
        ),
        entries: availabilityService.getCrewAvailability(member.id)
      };
    });

    expect(result.status).toBe("maybe");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].status).toBe("maybe");
  });

  test("clears availability", async ({ page }) => {
    const result = await page.evaluate(() => {
      const member = crewService.getAll()[0];

      availabilityService.setAvailability({
        crewId: member.id,
        date: "2026-08-16",
        status: "unavailable"
      });

      const cleared = availabilityService.clearAvailability(
        member.id,
        "2026-08-16"
      );

      return {
        cleared,
        status: availabilityService.getAvailability(
          member.id,
          "2026-08-16"
        ),
        entries: availabilityService.getCrewAvailability(member.id)
      };
    });

    expect(result.cleared).toBe(true);
    expect(result.status).toBe("available");
    expect(result.entries).toEqual([]);
  });

  test("defaults unknown dates to available", async ({ page }) => {
    const status = await page.evaluate(() => {
      const member = crewService.getAll()[0];

      return availabilityService.getAvailability(
        member.id,
        "2026-08-17"
      );
    });

    expect(status).toBe("available");
  });

  test("returns available crew for a date", async ({ page }) => {
    const result = await page.evaluate(() => {
      const members = crewService.getAll();
      const first = members[0];
      const second = members[1];

      availabilityService.setAvailability({
        crewId: first.id,
        date: "2026-08-18",
        status: "unavailable"
      });

      availabilityService.setAvailability({
        crewId: second.id,
        date: "2026-08-18",
        status: "available"
      });

      return {
        firstId: first.id,
        secondId: second.id,
        availableIds: availabilityService
          .getAvailableCrew("2026-08-18")
          .map(member => member.id)
      };
    });

    expect(result.availableIds).not.toContain(result.firstId);
    expect(result.availableIds).toContain(result.secondId);
  });

  test("returns unavailable crew for a date", async ({ page }) => {
    const result = await page.evaluate(() => {
      const members = crewService.getAll();
      const first = members[0];
      const second = members[1];

      availabilityService.setAvailability({
        crewId: first.id,
        date: "2026-08-19",
        status: "unavailable"
      });

      availabilityService.setAvailability({
        crewId: second.id,
        date: "2026-08-19",
        status: "maybe"
      });

      return {
        firstId: first.id,
        secondId: second.id,
        unavailableIds: availabilityService
          .getUnavailableCrew("2026-08-19")
          .map(member => member.id)
      };
    });

    expect(result.unavailableIds).toContain(result.firstId);
    expect(result.unavailableIds).not.toContain(result.secondId);
  });
});
