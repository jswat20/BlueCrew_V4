import {
  test,
  expect
} from "@playwright/test";

test.describe("Profile Self-Service", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    await page.evaluate(() => {
      localStorage.removeItem(
        "bluecrew_accounts"
      );
      localStorage.removeItem(
        "bluecrew_session"
      );

      const crewMember =
        crewService.getAll()[0];

      const created =
        accountService.createAccount({
          firstName: "Test",
          lastName: "Umpire",
          email: "profile@test.com",
          phone: "5551112222",
          address: "100 Main Street",
          emergencyContact: "Pat Umpire",
          emergencyContactPhone:
            "5553334444",
          role: "umpire"
        });

      accountService.approveAccount(
        created.data.id,
        crewMember?.id || null
      );

      loginService.login(
        created.data.email
      );

      authService.loginAsUmpire(
        crewMember?.id
      );

      document.body.dataset.role =
        "umpire";

      renderPage("profile");
    });
  });

  test("renders existing profile data", async ({
    page
  }) => {
    await expect(
      page.getByTestId("profile")
    ).toBeVisible();

    await expect(
      page.getByTestId("profile-name")
    ).toHaveValue("Test Umpire");

    await expect(
      page.getByTestId("profile-email")
    ).toHaveValue("profile@test.com");

    await expect(
      page.getByTestId("profile-phone")
    ).toHaveValue("5551112222");

    await expect(
      page.getByTestId(
        "profile-emergency-contact"
      )
    ).toHaveValue("Pat Umpire");
  });

  test("shows protected Crew Card facts as read-only", async ({ page }) => {
    await expect(page.getByTestId("profile-crew-card")).toBeVisible();
    await expect(page.getByTestId("profile-crew-id")).toBeDisabled();
    await expect(page.getByTestId("profile-birthdate")).toBeDisabled();
    await expect(page.getByTestId("profile-age")).toBeDisabled();
    await expect(page.getByTestId("profile-home-phone")).toBeEditable();
    await expect(page.getByTestId("profile-contact-preference")).toBeEditable();
  });

  test("edits phone", async ({ page }) => {
    await page
      .getByTestId("profile-phone")
      .fill("5559998888");

    await page
      .getByTestId("profile-save")
      .click();

    await expect(
      page.getByTestId("profile-phone")
    ).toHaveValue("(555) 999-8888");

    await expect(
      page.getByTestId("profile-success")
    ).toHaveText("Profile saved.");
  });

  test("edits email", async ({ page }) => {
    await page
      .getByTestId("profile-email")
      .fill("updated@test.com");

    await page
      .getByTestId("profile-save")
      .click();

    await expect(
      page.getByTestId("profile-email")
    ).toHaveValue("updated@test.com");
  });

  test("edits emergency contact", async ({
    page
  }) => {
    await page
      .getByTestId(
        "profile-emergency-contact"
      )
      .fill("Jordan Umpire");

    await page
      .getByTestId(
        "profile-emergency-phone"
      )
      .fill("5557776666");

    await page
      .getByTestId("profile-save")
      .click();

    await expect(
      page.getByTestId(
        "profile-emergency-contact"
      )
    ).toHaveValue("Jordan Umpire");

    await expect(
      page.getByTestId(
        "profile-emergency-phone"
      )
    ).toHaveValue("(555) 777-6666");
  });

  test("cancel restores saved values", async ({
    page
  }) => {
    await page
      .getByTestId("profile-phone")
      .fill("5550000000");

    await page
      .getByTestId("profile-email")
      .fill("discard@test.com");

    await page
      .getByTestId("profile-cancel")
      .click();

    await expect(
      page.getByTestId("profile-phone")
    ).toHaveValue("5551112222");

    await expect(
      page.getByTestId("profile-email")
    ).toHaveValue("profile@test.com");
  });

  test("shows validation failure", async ({
    page
  }) => {
    await page
      .getByTestId("profile-email")
      .fill("invalid-email");

    await page
      .getByTestId("profile-save")
      .click();

    await expect(
      page.getByTestId("profile-error")
    ).toHaveText(
      "Enter a valid email address."
    );
  });

  test("persists after reload", async ({
    page
  }) => {
    await page
      .getByTestId("profile-address")
      .fill("250 Updated Avenue");

    await page
      .getByTestId("profile-save")
      .click();

    await page.reload();

    await page.evaluate(() => {
      const account =
        loginService.getCurrentAccount();

      authService.loginAsUmpire(
        account?.crewId
      );

      document.body.dataset.role =
        "umpire";

      renderPage("profile");
    });

    await expect(
      page.getByTestId("profile-address")
    ).toHaveValue(
      "250 Updated Avenue"
    );
  });
});
