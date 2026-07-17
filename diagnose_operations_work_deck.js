const { chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on("pageerror", error => {
    console.log(
      "PAGE ERROR:",
      error.stack || error.message
    );
  });

  page.on("console", message => {
    if (message.type() === "error") {
      console.log(
        "CONSOLE ERROR:",
        message.text()
      );
    }
  });

  await page.goto("http://localhost:3000");

  const result = await page.evaluate(() => {
    try {
      authService.loginAsAdmin();
      document.body.dataset.role = "admin";
      renderPage("operations-center");

      return {
        success: true,
        page: currentPage,
        bodyPage:
          document.body.dataset.page,
        operationsCenter:
          Boolean(
            document.querySelector(
              '[data-testid="operations-center"]'
            )
          ),
        workQueue:
          Boolean(
            document.querySelector(
              '[data-testid="operations-work-queue"]'
            )
          ),
        html:
          document.querySelector("main")
            ?.innerHTML
            ?.slice(0, 1000)
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        stack: error.stack
      };
    }
  });

  console.log(
    JSON.stringify(result, null, 2)
  );

  await browser.close();
})();
