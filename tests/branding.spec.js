import { expect, test } from "@playwright/test";

test.describe("The Slate Branding", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("presents The Slate as the product and SwatWorks as the company", async ({
    page
  }) => {
    await expect(page).toHaveTitle(
      "The Slate | SwatWorks"
    );

    const brand = page.getByTestId("brand");

    await expect(
      brand.getByRole("heading", {
        name: "The Slate"
      })
    ).toBeVisible();

    const companyBrand =
      brand.locator(".brand-company");

    await expect(companyBrand).toHaveText(
      "by SwatWorks"
    );

    await expect(companyBrand).toHaveCSS(
      "text-transform",
      "none"
    );

    await expect(
      page.getByTestId("page-subtitle")
    ).not.toContainText("BlueCrew");
  });

  test("does not present BlueCrew as the visible application name", async ({
    page
  }) => {
    await expect(
      page.getByTestId("brand")
    ).not.toContainText("BlueCrew");
  });
});
