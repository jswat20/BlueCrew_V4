// tests/helpers/screenshots.js

async function takeNamedScreenshot(page, name) {
  await page.screenshot({
    path: `test-results/${name}.png`,
    fullPage: true
  });
}

module.exports = {
  takeNamedScreenshot
};