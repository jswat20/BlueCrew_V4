import fs from "node:fs";
import vm from "node:vm";
import { test, expect } from "@playwright/test";

test("an existing browser cache converges to the current release on activation", async () => {
  const listeners = {};
  const deleted = [];
  const stored = new Map([
    ["the-slate-shell-v2", new Map([["/", new Response("old release")]])],
    ["unrelated-cache", new Map()]
  ]);
  let skipped = false;
  let claimed = false;
  const caches = {
    open: async name => {
      if (!stored.has(name)) stored.set(name, new Map());
      const entries = stored.get(name);
      return {
        addAll: async paths => paths.forEach(path => entries.set(path, new Response(`precache ${path}`))),
        put: async (path, response) => entries.set(path, response),
        match: async path => entries.get(typeof path === "string" ? path : path.url)
      };
    },
    keys: async () => [...stored.keys()],
    delete: async name => { deleted.push(name); return stored.delete(name); },
    match: async request => {
      const key = typeof request === "string" ? request : request.url;
      for (const entries of stored.values()) if (entries.has(key)) return entries.get(key);
      return undefined;
    }
  };
  const self = {
    addEventListener: (name, handler) => { listeners[name] = handler; },
    skipWaiting: () => { skipped = true; },
    clients: { claim: async () => { claimed = true; } }
  };
  const source = fs.readFileSync("service-worker.js", "utf8").replaceAll("__SLATE_RELEASE__", "abc123def456");
  vm.runInNewContext(source, { self, caches, fetch: async () => new Response("new release"), Response });

  let installPromise;
  listeners.install({ waitUntil: promise => { installPromise = promise; } });
  await installPromise;
  let activatePromise;
  listeners.activate({ waitUntil: promise => { activatePromise = promise; } });
  await activatePromise;

  expect(skipped).toBe(true);
  expect(claimed).toBe(true);
  expect(deleted).toContain("the-slate-shell-v2");
  expect(stored.has("the-slate-shell-v3-abc123def456")).toBe(true);
  expect(stored.has("unrelated-cache")).toBe(true);

  const waits = [];
  let navigationResponse;
  listeners.fetch({
    request: { method: "GET", mode: "navigate", url: "https://app.worktheslate.com/" },
    respondWith: promise => { navigationResponse = promise; },
    waitUntil: promise => waits.push(promise)
  });
  expect(await (await navigationResponse).text()).toBe("new release");
  await Promise.all(waits);
  expect(await (await stored.get("the-slate-shell-v3-abc123def456").get("/")).text()).toBe("new release");
});
