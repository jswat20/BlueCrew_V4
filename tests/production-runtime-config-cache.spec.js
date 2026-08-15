const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");

test("production runtime config is content-fingerprinted and the stable URL is absent", () => {
  const index = fs.readFileSync("dist/index.html", "utf8");
  const reference = index.match(/config\/(supabase\.([a-f0-9]{12})\.js)/);
  expect(reference).toBeTruthy();
  expect(index).not.toMatch(/config\/supabase\.js(?:["'?])/);
  expect(fs.existsSync("dist/config/supabase.js")).toBe(false);

  const content = fs.readFileSync(path.join("dist/config", reference[1]), "utf8");
  const sourceIndex = fs.readFileSync("index.html", "utf8");
  const fingerprint = crypto.createHash("sha256").update(content).update(sourceIndex).digest("hex").slice(0, 12);
  expect(fingerprint).toBe(reference[2]);
});

test("a changed runtime credential or application entry necessarily changes the browser asset URL", () => {
  const filename = (content, entry = "entry-a") => `supabase.${crypto.createHash("sha256").update(content).update(entry).digest("hex").slice(0, 12)}.js`;
  const versionA = 'window.BLUECREW_SUPABASE_CONFIG={"publishableKey":"version-a"};';
  const versionB = 'window.BLUECREW_SUPABASE_CONFIG={"publishableKey":"version-b"};';
  expect(filename(versionA)).not.toBe(filename(versionB));
  expect(filename(versionA, "entry-a")).not.toBe(filename(versionA, "entry-b"));
});

test("fingerprinted runtime config has an immutable cache contract", () => {
  const headers = fs.readFileSync("dist/_headers", "utf8");
  expect(headers).toMatch(/\/config\/\*[\s\S]*Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/i);
  const verifier = fs.readFileSync("scripts/verify-production-artifact.cjs", "utf8");
  expect(verifier).toContain("stale-prone unversioned runtime config");
});

test("production Crew interaction scripts use content-addressed physical paths", () => {
  const index = fs.readFileSync("dist/index.html", "utf8");
  for (const source of ["components/crew", "js/schedule/workloadPanel", "js/ui/crewCard"]) {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const reference = index.match(new RegExp(`${escaped}\\.([a-f0-9]{12})\\.js`));
    expect(reference).toBeTruthy();
    const asset = `${source}.${reference[1]}.js`;
    const content = fs.readFileSync(`dist/${asset}`);
    expect(crypto.createHash("sha256").update(content).digest("hex").slice(0, 12)).toBe(reference[1]);
    expect(index).toContain(`${asset}?v=${reference[1]}`);
  }
});

test("production Crew editor is independent of the helper removed with demo Crew data", () => {
  const index = fs.readFileSync("dist/index.html", "utf8");
  const reference = index.match(/components\/crew\.([a-f0-9]{12})\.js/);
  expect(reference).toBeTruthy();
  const component = fs.readFileSync(`dist/components/crew.${reference[1]}.js`, "utf8");
  const productionCrewData = fs.readFileSync("dist/data/crew.js", "utf8");
  expect(productionCrewData).not.toContain("getCrewFullName");
  expect(component).not.toContain("getCrewFullName");
  expect(component).toContain("function getCrewComponentFullName");
});

test("a persisted browser that cached version A recovers to version B on normal reload", async ({ browser }) => {
  const productionIndex = fs.readFileSync("dist/index.html", "utf8");
  const productionReference = productionIndex.match(/config\/(supabase\.[a-f0-9]{12}\.js)/)[1];
  const productionConfig = fs.readFileSync(path.join("dist/config", productionReference), "utf8");
  let phase = "A";
  const requests = [];
  const server = http.createServer((request, response) => {
    if (request.url === "/") {
      const script = phase === "A" ? "supabase.js" : productionReference;
      response.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-cache" });
      response.end(`<script src="/config/${script}"></script>`);
      return;
    }
    if (request.url?.startsWith("/config/")) {
      requests.push(request.url);
      response.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "public, max-age=31536000, immutable" });
      response.end(phase === "A" ? "window.RUNTIME_CONFIG_VERSION='A';" : `${productionConfig}\nwindow.RUNTIME_CONFIG_VERSION='B';`);
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.goto(origin);
    expect(await page.evaluate(() => window.RUNTIME_CONFIG_VERSION)).toBe("A");
    phase = "B";
    await page.reload();
    expect(await page.evaluate(() => window.RUNTIME_CONFIG_VERSION)).toBe("B");
    expect(requests).toEqual(["/config/supabase.js", `/config/${productionReference}`]);
  } finally {
    await context.close();
    await new Promise(resolve => server.close(resolve));
  }
});
