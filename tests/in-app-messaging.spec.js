import { test, expect } from "./fixtures/app.fixture.js";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/202609030001_in_app_messaging.sql"), "utf8");

test.beforeEach(async ({ app }) => {
  const page = app.page;
  await page.evaluate(() => {
    localStorage.removeItem("bluecrew_messages_v1");
    authService.loginAsAdmin();
    document.body.dataset.role = "administrator";
    messagingService.hydrate();
    refreshNavigationAuthorization();
    renderPage("messages");
  });
});

test("administrator sends a private message and the selected umpire can reply", async ({ app }) => {
  const page = app.page;
  await page.getByTestId("new-message").click();
  await page.locator('[name="umpireProfileId"]').selectOption("2");
  await page.locator('[name="subject"]').fill("Saturday coverage");
  await page.locator('[data-testid="message-compose-form"] textarea').fill("Can you cover the 10:00 game?");
  await page.locator('[data-testid="message-compose-form"] button[type="submit"]').click();
  await expect(page.getByText("Can you cover the 10:00 game?").first()).toBeVisible();

  const hiddenFromOtherUmpire = await page.evaluate(async () => {
    authService.loginAsCrew(1); await messagingService.hydrate();
    return messagingService.getCenter().conversations.length;
  });
  expect(hiddenFromOtherUmpire).toBe(0);

  await page.evaluate(() => {
    authService.loginAsCrew(2);
    document.body.dataset.role = "umpire";
    messagingService.hydrate();
    renderPage("messages");
  });
  await expect(page.getByText("Can you cover the 10:00 game?").first()).toBeVisible();
  await page.locator(".message-reply-form textarea").fill("Yes, I can work it.");
  await page.locator('.message-reply-form button[type="submit"]').click();
  await expect(page.getByText("Yes, I can work it.")).toBeVisible();
});

test("group announcement snapshots only currently eligible active umpires", async ({ app }) => {
  const page = app.page;
  await page.getByTestId("new-message").click();
  await page.locator('input[name="kind"][value="group"]').check();
  await page.locator('[name="group"]').selectOption("level:8U");
  await page.locator('[name="subject"]').fill("8U schedule update");
  await page.locator('[data-testid="message-compose-form"] textarea').fill("Two games were added.");
  await page.locator('[data-testid="message-compose-form"] button[type="submit"]').click();
  await expect(page.getByText("0 of 1 viewed")).toBeVisible();

  const visibility = await page.evaluate(async () => {
    authService.loginAsCrew(1); await messagingService.hydrate(); const unrelated = messagingService.getCenter().announcements.length;
    authService.loginAsCrew(2); await messagingService.hydrate(); const eligible = messagingService.getCenter().announcements.length;
    return { unrelated, eligible };
  });
  expect(visibility).toEqual({ unrelated: 0, eligible: 1 });
});

test("6U, 8U, and All recipient snapshots and private announcement replies remain isolated", async ({ app }) => {
  const result = await app.page.evaluate(async () => {
    crew.push({ id: 6, firstName: "Six", lastName: "Eight", levels: ["6U", "8U"], active: true });
    authService.loginAsAdmin();
    await messagingService.hydrate();
    const six = await messagingService.sendAnnouncement({ targetType: "eligible_level", targetValue: "6U", subject: "6U", body: "Six only" });
    const eight = await messagingService.sendAnnouncement({ targetType: "eligible_level", targetValue: "8U", subject: "8U", body: "Eight group" });
    const all = await messagingService.sendAnnouncement({ targetType: "all_umpires", subject: "All", body: "All active umpires" });
    const adminCenter = messagingService.getCenter();
    const counts = Object.fromEntries(adminCenter.announcements.map(item => [item.subject, item.recipientCount]));
    crew.find(item => item.id === 6).levels = [];

    authService.loginAsCrew(6); await messagingService.hydrate();
    const ownAnnouncements = messagingService.getCenter().announcements;
    const announcementId = ownAnnouncements.find(item => item.subject === "8U").id;
    await messagingService.markRead({ announcementId });
    await messagingService.sendDirect({ umpireProfileId: 2, announcementId, body: "Private response" });
    const ownConversation = messagingService.getCenter().conversations;

    authService.loginAsCrew(2); await messagingService.hydrate();
    const otherCenter = messagingService.getCenter();
    return {
      success: [six.success, eight.success, all.success], counts,
      ownAnnouncementCount: ownAnnouncements.length,
      ownConversationUmpire: ownConversation[0]?.umpireProfileId,
      otherSawReply: otherCenter.conversations.some(item => item.messages.some(message => message.body === "Private response")),
      otherEightRead: otherCenter.announcements.find(item => item.subject === "8U")?.read
    };
  });
  expect(result).toEqual({
    success: [true, true, true], counts: { All: 3, "8U": 2, "6U": 1 },
    ownAnnouncementCount: 3, ownConversationUmpire: 6, otherSawReply: false, otherEightRead: false
  });
});

test("umpire initiation always resolves to the caller's own private conversation", async ({ app }) => {
  const result = await app.page.evaluate(async () => {
    authService.loginAsCrew(1); await messagingService.hydrate();
    const sent = await messagingService.sendDirect({ umpireProfileId: 2, body: "Initiated by umpire" });
    const center = messagingService.getCenter();
    return { sent, umpireProfileId: center.conversations[0]?.umpireProfileId };
  });
  expect(result.sent.success).toBe(true);
  expect(result.umpireProfileId).toBe(1);
});

test("navigation excludes assigners and League Viewers while allowing administrators and umpires", async ({ app }) => {
  const page = app.page;
  const result = await page.evaluate(() => ({
    admin: authorizationService.canView("messages", "administrator"),
    assigner: authorizationService.canView("messages", "assigner"),
    leagueViewer: authorizationService.canView("messages", "league_viewer"),
    umpire: authorizationService.canView("messages", "umpire")
  }));
  expect(result).toEqual({ admin: true, assigner: false, leagueViewer: false, umpire: true });
});

test("League Viewer cannot call messaging mutations through the client service", async ({ app }) => {
  const result = await app.page.evaluate(async () => {
    authService.useAuthenticatedAccount({ id: "viewer-1", role: "league_viewer", name: "League Viewer" });
    document.body.dataset.role = "league_viewer";
    const direct = await messagingService.sendDirect({ umpireProfileId: "2", body: "Forbidden" });
    const announcement = await messagingService.sendAnnouncement({ targetType: "all_umpires", subject: "Forbidden", body: "Forbidden" });
    renderPage("messages");
    return { direct, announcement, page: document.body.dataset.page, denied: Boolean(document.querySelector('[data-testid="access-denied"]')) };
  });
  expect(result.direct.success).toBe(false);
  expect(result.announcement.success).toBe(false);
  expect(result.denied).toBe(true);
});

test("migration enforces RPC-only writes, organization isolation, private replies, and snapshotted recipients", () => {
  expect(migration).toContain("revoke all on public.message_conversations, public.messages, public.message_receipts");
  expect(migration).toContain("organization_id = public.current_organization_id()");
  expect(migration).toContain("v_role not in ('administrator', 'umpire')");
  expect(migration).toContain("public.current_account_role() not in ('administrator', 'umpire')");
  expect(migration).toContain("v_umpire := case when v_role = 'umpire' then v_actor else p_umpire_profile_id end");
  expect(migration).toContain("p.role = 'umpire' and p.status = 'approved' and c.active");
  expect(migration).toContain("insert into public.message_announcement_recipients");
  expect(migration).toContain("r.recipient_profile_id = v_umpire");
  expect(migration).toContain("and (public.is_administrator() or c.umpire_profile_id = public.current_profile_id())");
  expect(migration).toContain("grant execute on function public.send_direct_message");
  expect(migration).not.toMatch(/grant\s+(insert|update|delete)\s+on\s+public\.message_/i);
  expect(migration.match(/set search_path = pg_catalog, public, pg_temp/g)?.length).toBe(4);
  expect(migration.match(/and r\.read_at is null/g)?.length).toBeGreaterThanOrEqual(1);
  expect(migration).toContain("recipient_profile_id = v_actor and read_at is null");
});
