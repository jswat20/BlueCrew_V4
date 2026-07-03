async function waitForUi(page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(100);
}

module.exports = {
  waitForUi
};