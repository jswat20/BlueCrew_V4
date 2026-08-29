import { test, expect } from "./fixtures/app.fixture.js";

async function seedPresentationCrew(page) {
  return page.evaluate(async () => {
    localStorage.removeItem("bluecrew_accounts");
    authService.loginAsAdmin();
    const member = crewService.getAll()[0];
    await crewService.updateMember(member.id, {
      firstName: "Alexandria",
      lastName: "Montgomery-Worthington",
      levels: ["6U", "8U", "10U", "12U", "14U", "16U", "Juniors", "Seniors"]
    });
    const refreshed = crewService.getById(member.id);
    const account = accountService.createAccount({
      firstName: refreshed.firstName,
      lastName: refreshed.lastName,
      email: "alexandria.montgomery-worthington@example.com",
      phone: "(410) 555-0100",
      address: "123 Extremely Long Municipal Recreation Boulevard, Chesapeake Beach, Maryland 20732",
      emergencyContact: "A Very Long Emergency Contact Name",
      birthdate: "1990-07-14",
      officialHistory: [{ year: 2025, label: "First Year" }, { year: 2026, label: "Second Year" }]
    }).data;
    accountService.approveAccount(account.id, refreshed.id);
    return refreshed.id;
  });
}

async function becomeViewerAndOpenCard(page, crewId) {
  await page.evaluate(id => {
    authService.useAuthenticatedAccount({
      id: "viewer-presentation",
      role: "league_viewer",
      firstName: "League",
      lastName: "Viewer",
      organizationId: "organization-1"
    });
    loginService.isLoggedIn = () => true;
    document.body.dataset.role = "league_viewer";
    renderPage("crew");
    openCrewCard(id);
  }, crewId);
}

async function visibleGeometry(page) {
  return page.getByTestId("crew-card-dialog").evaluate(dialog => {
    const visible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const rectFor = selector => {
      const element = dialog.querySelector(selector);
      if (!element || !visible(element)) return null;
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    };
    const overlaps = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
    const dialogRect = dialog.getBoundingClientRect();
    const visibleElements = [...dialog.querySelectorAll(".crew-credential-face:not([aria-hidden='true']) *, .crew-credential-modal-footer")].filter(visible);
    return {
      viewportOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      descendantOverflow: visibleElements.some(element => {
        const rect = element.getBoundingClientRect();
        return rect.left < dialogRect.left - 1 || rect.right > dialogRect.right + 1;
      }),
      photoNameOverlap: overlaps(rectFor(".crew-credential-face-back .crew-credential-photo-column"), rectFor(".crew-credential-face-back .crew-credential-identity-details")),
      identityContactOverlap: overlaps(rectFor(".crew-credential-face-back .crew-credential-identity-panel"), rectFor(".crew-credential-face-back .crew-credential-contact")),
      footerContentOverlap: [".crew-credential-identity-panel", ".crew-credential-contact", ".crew-credential-notes"].some(selector =>
        overlaps(rectFor(".crew-credential-modal-footer"), rectFor(`.crew-credential-face-back ${selector}`))
      )
    };
  });
}

test.describe("Crew Card presentation hardening", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/"); });

  test("shared assignment badges retain labels and colors without decorative dots", async ({ page }) => {
    const badges = await page.evaluate(() => {
      const statuses = ["needs_assignment", "open_for_claim", "pending_approval", "assigned", "locked"];
      return statuses.map(status => {
        const original = assignmentService.getStatusInfo;
        assignmentService.getStatusInfo = () => ({
          label: status.replaceAll("_", " "),
          className: `status-${status.replaceAll("_", "-")}`,
          icon: "🔴"
        });
        const html = renderAssignmentStatusBadge({ status });
        assignmentService.getStatusInfo = original;
        return html;
      });
    });
    for (const badge of badges) {
      expect(badge).not.toMatch(/[🔴🟡🟠🟢]/u);
      expect(badge).toContain("assignment-status-badge");
      expect(badge).toMatch(/needs assignment|open for claim|pending approval|assigned|locked/);
    }
  });

  for (const width of [320, 360, 390, 430, 768, 1280]) {
    test(`front name fitting preserves sensible name parts at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width >= 1000 ? 800 : 900 });
      for (const name of [
        { firstName: "Pam", lastName: "Blades" },
        { firstName: "Ryan", lastName: "Shaughnessy" },
        { firstName: "Alexandria", lastName: "Montgomery-Worthington" }
      ]) {
        for (const role of ["administrator", "umpire", "league_viewer"]) {
          const measurement = await page.evaluate(({ requestedName, viewerRole }) => {
            document.body.dataset.page = "profile";
            document.body.dataset.role = viewerRole;
            const model = getCrewCardModel({
              id: `name-fit-${viewerRole}`,
              role: viewerRole === "administrator" ? "administrator" : "umpire",
              firstName: requestedName.firstName,
              lastName: requestedName.lastName,
              status: "approved"
            });
            document.querySelector("main").innerHTML = `<section class="unified-profile-page"><div class="unified-profile-card profile-baseball-card is-front"><div class="profile-card-stage"><div class="profile-card-orientation"><div class="crew-credential-flipper">${renderCrewCredentialFrontFace(model, { profileDesign: true })}</div></div></div></div></section>`;
            const element = document.querySelector('[data-testid="profile-card-name"]');
            const block = element.closest(".profile-card-name-block");
            const words = [...element.querySelectorAll(":scope > span")].map(word => {
              const rects = [...word.getClientRects()];
              return { text: word.textContent, lineCount: rects.length, left: rects[0]?.left || 0, right: rects.at(-1)?.right || 0 };
            });
            const blockRect = block.getBoundingClientRect();
            const photoRect = block.previousElementSibling.getBoundingClientRect();
            return {
              words,
              noHorizontalOverflow: words.every(word => word.left >= blockRect.left - 1 && word.right <= blockRect.right + 1),
              noPhotoCollision: blockRect.top >= photoRect.bottom - 1,
              viewportOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
            };
          }, { requestedName: name, viewerRole: role });
          expect(measurement.noHorizontalOverflow).toBe(true);
          expect(measurement.noPhotoCollision).toBe(true);
          expect(measurement.viewportOverflow).toBe(false);
          if (name.lastName === "Shaughnessy") {
            expect(measurement.words).toEqual([
              expect.objectContaining({ text: "Ryan", lineCount: 1 }),
              expect.objectContaining({ text: "Shaughnessy", lineCount: 1 })
            ]);
          }
        }
      }
    });

    test(`front and back remain contained without collisions at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width >= 1000 ? 800 : 900 });
      const crewId = await seedPresentationCrew(page);
      await becomeViewerAndOpenCard(page, crewId);
      await expect(page.getByTestId("crew-card-view-information")).toBeVisible();
      expect(await visibleGeometry(page)).toEqual({
        viewportOverflow: false,
        descendantOverflow: false,
        photoNameOverlap: false,
        identityContactOverlap: false,
        footerContentOverlap: false
      });
      await page.getByTestId("crew-card-view-information").click();
      await expect(page.getByTestId("crew-card-back")).toBeVisible();
      await expect(page.getByTestId("crew-card-view-front")).toBeVisible();
      expect(await visibleGeometry(page)).toEqual({
        viewportOverflow: false,
        descendantOverflow: false,
        photoNameOverlap: false,
        identityContactOverlap: false,
        footerContentOverlap: false
      });
    });
  }
});
