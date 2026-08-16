import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=", "base64");
const WEBP = Buffer.from("UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAA==", "base64");

async function openPhotoEditor(page) {
  await page.evaluate(async () => { await loginService.loginWithPassword("linked@example.com", "password"); renderPage("profile"); });
  await page.getByTestId("profile-card-back").click();
  await page.getByTestId("profile-edit-crew-card").click();
  await expect(page.getByTestId("profile-photo-input")).toBeVisible();
}

async function chooseAndUpload(page, name, mimeType, buffer) {
  await page.getByTestId("profile-photo-input").setInputFiles({ name, mimeType, buffer });
  await page.getByTestId("profile-photo-upload").click();
}

test("user with no photo sees the existing fallback", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  await openPhotoEditor(page);
  await expect(page.getByTestId("profile-photo-preview").locator(".crew-credential-photo-fallback")).toBeVisible();
});

test("valid photo upload succeeds at the deterministic own path", async ({ supabaseAuthApp }) => {
  const { page, calls } = supabaseAuthApp;
  await openPhotoEditor(page);
  await chooseAndUpload(page, "portrait.png", "image/png", PNG);
  await expect(page.getByTestId("profile-photo-status")).toContainText("Profile photo updated");
  const upload = (await calls()).find(call => call.operation === "storage.upload");
  expect(upload).toMatchObject({ bucket: "profile-photos", path: "auth-umpire-1/profile", type: "image/png" });
  expect(await page.evaluate(() => window.__supabaseFixture.settings.profile.photo_path)).toBe("auth-umpire-1/profile");
});

test("uploaded photo appears on Profile Crew Card", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  await openPhotoEditor(page);
  await chooseAndUpload(page, "portrait.png", "image/png", PNG);
  await page.getByRole("button", { name: "Cancel" }).first().click();
  await expect(page.getByTestId("profile-crew-card-experience").locator(".crew-credential-photo").first()).toHaveAttribute("src", /profile-photos\/auth-umpire-1\/profile/);
});

test("replacement reuses one deterministic object path", async ({ supabaseAuthApp }) => {
  const { page, calls } = supabaseAuthApp;
  await openPhotoEditor(page);
  await chooseAndUpload(page, "first.png", "image/png", PNG);
  await chooseAndUpload(page, "second.webp", "image/webp", WEBP);
  const uploads = (await calls()).filter(call => call.operation === "storage.upload");
  expect(uploads).toHaveLength(2);
  expect(new Set(uploads.map(call => call.path))).toEqual(new Set(["auth-umpire-1/profile"]));
  expect(await page.evaluate(() => Object.keys(window.__supabaseFixture.settings.profilePhotoObjects))).toEqual(["auth-umpire-1/profile"]);
});

test("removal clears photo_path and restores fallback", async ({ supabaseAuthApp }) => {
  const { page } = supabaseAuthApp;
  await openPhotoEditor(page);
  await chooseAndUpload(page, "portrait.png", "image/png", PNG);
  await page.getByTestId("profile-photo-remove").click();
  await expect(page.getByTestId("profile-photo-preview").locator(".crew-credential-photo-fallback")).toBeVisible();
  expect(await page.evaluate(() => window.__supabaseFixture.settings.profile.photo_path)).toBeNull();
});

test("oversized photo is rejected with an accessible error", async ({ supabaseAuthApp }) => {
  const { page, calls } = supabaseAuthApp;
  await openPhotoEditor(page);
  await page.getByTestId("profile-photo-input").setInputFiles({ name: "large.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(page.getByTestId("profile-photo-error")).toHaveText("Profile photos must be 5 MB or smaller.");
  expect((await calls()).some(call => call.operation === "storage.upload")).toBe(false);
});

test("unsupported type is rejected with an accessible error", async ({ supabaseAuthApp }) => {
  const { page, calls } = supabaseAuthApp;
  await openPhotoEditor(page);
  await page.getByTestId("profile-photo-input").setInputFiles({ name: "portrait.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await expect(page.getByTestId("profile-photo-error")).toHaveText("Choose a JPEG, PNG, or WebP image.");
  expect((await calls()).some(call => call.operation === "storage.upload")).toBe(false);
});

test("one umpire cannot write another umpire's photo path", async ({ supabaseAuthApp }) => {
  const result = await supabaseAuthApp.page.evaluate(async () => {
    await loginService.loginWithPassword("linked@example.com", "password");
    const client = await supabaseClientService.getClient();
    return client.storage.from("profile-photos").upload("auth-other/profile", new Blob(["x"], { type: "image/png" }), { upsert: true });
  });
  expect(result.error?.message).toBe("Storage policy denied");
});

test("migration contract scopes private storage writes to auth.uid own canonical path", async () => {
  const sql = readFileSync("supabase/migrations/202608150002_profile_photo_storage.sql", "utf8");
  expect(sql).toContain("'profile-photos', 'profile-photos', false, 5242880");
  expect(sql.match(/name = auth\.uid\(\)::text \|\| '\/profile'/g)).toHaveLength(5);
  expect(sql).toContain("profiles.organization_id = public.current_organization_id()");
  expect(sql).not.toMatch(/for (insert|update|delete) to authenticated\s+(using|with check) \(bucket_id = 'profile-photos'\)/i);
});
