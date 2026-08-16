import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const productionArtifactRun = process.env.PLAYWRIGHT_STATIC_ROOT === "dist";

test.describe("curated production Profile artifact", () => {
  test.skip(!productionArtifactRun, "Run with PLAYWRIGHT_STATIC_ROOT=dist after npm run build:production.");

  test.use({
    supabaseScenario: {
      profile: {
        id: "profile-production-artifact",
        auth_user_id: "auth-production-artifact",
        organization_id: "organization-1",
        first_name: "Artifact",
        last_name: "Umpire",
        email: "artifact.umpire@example.com",
        phone: "5550102000",
        personnel_id: "CREW-ARTIFACT-1",
        role: "umpire",
        status: "approved",
        communication_preferences: {}
      },
      crewId: "crew-production-artifact",
      crewMembers: [{
        id: "crew-production-artifact",
        organization_id: "organization-1",
        profile_id: "profile-production-artifact",
        first_name: "Artifact",
        last_name: "Umpire",
        email: "artifact.umpire@example.com",
        phone: "5550102000",
        active: true,
        eligible_levels: ["12U"],
        preferences: {},
        notes: ""
      }]
    }
  });

  test("exact deployed script order renders the approved umpire self-service Crew Card", async ({ supabaseAuthApp }) => {
    const { page } = supabaseAuthApp;
    const artifact = await page.evaluate(() => ({
      projectRef: new URL(window.BLUECREW_SUPABASE_CONFIG.url).hostname.split(".")[0],
      scripts: [...document.scripts].map(script => script.getAttribute("src") || "")
    }));

    expect(artifact.projectRef).toBe("dynxjiqrdlhfhrjnhvgn");
    expect(artifact.scripts.filter(source => source.includes("js/ui/profile")))
      .toEqual([expect.stringMatching(/^js\/ui\/profile\.[a-f0-9]{12}\.js\?v=[a-f0-9]{12}$/)]);
    expect(artifact.scripts.filter(source => source.includes("js/ui/crewCard")))
      .toEqual([expect.stringMatching(/^js\/ui\/crewCard\.[a-f0-9]{12}\.js\?v=[a-f0-9]{12}$/)]);
    expect(artifact.scripts.findIndex(source => source.includes("js/ui/profile")))
      .toBeLessThan(artifact.scripts.findIndex(source => source.includes("js/ui/crewCard")));
    expect(artifact.scripts.findIndex(source => source.includes("js/ui/crewCard")))
      .toBeLessThan(artifact.scripts.findIndex(source => /^app\.js(?:\?|$)/.test(source)));

    await page.evaluate(async () => {
      await loginService.loginWithPassword("artifact.umpire@example.com", "password1234");
      renderPage("profile");
    });

    await expect(page.getByTestId("profile-card-flipper")).toBeVisible();
    await expect(page.getByTestId("profile-card-flipper")).not.toHaveClass(/is-flipped/);
    await expect(page.getByTestId("crew-card-back")).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByTestId("profile-front-eligibility").locator(".settings-pill")).toHaveText(["12U"]);
    await expect(page.locator(".unified-profile-card .crew-credential-face-front")).toBeVisible();
    expect(await page.locator(".unified-profile-card").evaluate(card => {
      const front = card.querySelector(".crew-credential-face-front");
      const bounds = front.getBoundingClientRect();
      return front.contains(document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2));
    })).toBe(true);
    await expect(page.getByTestId("profile-card-back")).toHaveText("View My Information");
    await page.getByTestId("profile-card-back").click();
    await expect(page.getByTestId("crew-card-back")).toBeVisible();
    await expect(page.getByTestId("profile-edit-crew-card")).toBeVisible();
  });
});
