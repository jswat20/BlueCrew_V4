import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const ownNotification = {
  id: "notification-own-1",
  organization_id: "organization-1",
  type: "claim-approved",
  audience: "account",
  recipient_profile_id: "profile-umpire-1",
  title: "Claim Approved",
  message: "Your claim was approved.",
  related_legacy_id: "legacy-game-1",
  destination_page: "my-schedule",
  destination_context: { gameId: "legacy-game-1" },
  reminder_key: null,
  read_at: null,
  created_at: "2026-08-05T15:00:00Z"
};

test.describe("Supabase authenticated notifications", () => {
  test.use({ supabaseScenario: { notifications: [
    { ...ownNotification, id: "notification-a", created_at: "2026-08-05T14:00:00Z" },
    { ...ownNotification, id: "notification-c", title: "Newest C", created_at: "2026-08-05T15:00:00Z" },
    { ...ownNotification, id: "notification-b", title: "Newest B", created_at: "2026-08-05T15:00:00Z" }
  ] } });

  test("hydrates during login with explicit projection, deterministic ordering, and no duplication", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      const login = await loginService.loginWithPassword("linked@example.com", "password1234");
      const first = notificationService.getAll();
      await notificationService.refreshAuthenticatedNotifications();
      const second = notificationService.getAll();
      return { login, first, second, state: notificationService.getNotificationHydrationState() };
    });
    expect(result.login.success).toBe(true);
    expect(result.first.map(item => item.id)).toEqual(["notification-c", "notification-b", "notification-a"]);
    expect(result.second.map(item => item.id)).toEqual(result.first.map(item => item.id));
    expect(result.state.status).toBe("ready");
    expect(result.first[0]).toMatchObject({
      recipientProfileId: "profile-umpire-1",
      recipientAccountId: "profile-umpire-1",
      relatedId: "legacy-game-1",
      destination: { page: "my-schedule", context: { gameId: "legacy-game-1" } },
      read: false
    });
    const calls = await supabaseAuthApp.calls();
    expect(calls.find(call => call.operation === "selectColumns" && call.table === "notifications")?.columns).toBe("id,organization_id,type,audience,recipient_profile_id,title,message,related_legacy_id,destination_page,destination_context,reminder_key,read_at,created_at");
    expect(calls.filter(call => call.operation === "order" && call.table === "notifications").map(call => call.column)).toEqual(["created_at", "id", "created_at", "id"]);
  });

  test("returned collections cannot mutate the canonical snapshot", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("linked@example.com", "password1234");
      const first = notificationService.getAll();
      first[0].title = "Tampered";
      first.push({ id: "injected" });
      const queried = notificationService.getNotifications();
      queried[0].message = "Changed";
      return notificationService.getAll();
    });
    expect(result).toHaveLength(3);
    expect(result[0].title).toBe("Newest C");
    expect(result[0].message).toBe("Your claim was approved.");
  });

  test("unread badge and notification center reflect persisted rows", async ({ supabaseAuthApp }) => {
    await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("linked@example.com", "password1234");
      renderPage("notifications");
    });
    await expect(supabaseAuthApp.page.getByTestId("notifications-unread-count")).toHaveText("3 unread");
    await expect(supabaseAuthApp.page.getByTestId("notifications-badge")).toHaveText("3");
    await expect(supabaseAuthApp.page.getByTestId("notification-card")).toHaveCount(3);
  });
});

test.describe("Supabase notification read persistence", () => {
  test.use({ supabaseScenario: { notifications: [ownNotification, { ...ownNotification, id: "notification-own-2", title: "Second", created_at: "2026-08-05T14:00:00Z" }] } });

  test("marks one notification read through the RPC and refreshes the UI and badge", async ({ supabaseAuthApp }) => {
    await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("linked@example.com", "password1234");
      renderPage("notifications");
    });
    await supabaseAuthApp.page.getByTestId("notification-mark-read").first().click();
    await expect(supabaseAuthApp.page.getByTestId("notifications-badge")).toHaveText("1");
    const persisted = await supabaseAuthApp.page.evaluate(() => ({
      rows: window.__supabaseFixture.settings.notifications,
      snapshot: notificationService.getAll()
    }));
    expect(persisted.rows.filter(item => item.read_at)).toHaveLength(1);
    expect(persisted.snapshot.filter(item => item.read)).toHaveLength(1);
  });

  test("marks all notifications read through one RPC", async ({ supabaseAuthApp }) => {
    await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("linked@example.com", "password1234");
      renderPage("notifications");
    });
    await supabaseAuthApp.page.getByTestId("notifications-select-visible").click();
    await supabaseAuthApp.page.getByTestId("notifications-mark-selected-read").click();
    await expect(supabaseAuthApp.page.getByTestId("notifications-badge")).toBeHidden();
    const persisted = await supabaseAuthApp.page.evaluate(() => window.__supabaseFixture.settings.notifications.filter(item => item.read_at).length);
    expect(persisted).toBe(2);
  });

  test("failed read mutation preserves the previous snapshot", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("linked@example.com", "password1234");
      const before = notificationService.getAll();
      window.__supabaseFixture.settings.failedRpc = "mark_notification_read";
      const mutation = await notificationService.markAsRead("notification-own-1");
      return { before, after: notificationService.getAll(), mutation };
    });
    expect(result.mutation.success).toBe(false);
    expect(result.after).toEqual(result.before);
  });
});

test.describe("Supabase notification lifecycle isolation", () => {
  test.use({ supabaseScenario: {
    notifications: [ownNotification],
    locations: [{ id: "location-1", organization_id: "organization-1", name: "Complex", active: true }],
    fields: [{ id: "field-1", organization_id: "organization-1", location_id: "location-1", name: "Field", active: true }],
    games: [{ id: "game-1", organization_id: "organization-1", season_id: "season-1", location_id: "location-1", field_id: "field-1", game_date: "2099-08-20", game_time: "18:00:00", home_team: "Home", away_team: "Away", level: "12U", game_type: "single", lifecycle_status: "scheduled", review: {}, report: {}, source_metadata: {} }],
    assignments: [{ id: "assignment-1", organization_id: "organization-1", game_id: "game-1", position: "Plate", status: "open_for_claim", assigned_crew_member_id: null, locked: false }]
  } });

  test("logout clears private notification state", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("linked@example.com", "password1234");
      const before = notificationService.getAll().length;
      await loginService.logoutAuthenticated();
      return { before, after: notificationService.getAll(), state: notificationService.getNotificationHydrationState() };
    });
    expect(result.before).toBe(1);
    expect(result.after).toEqual([]);
    expect(result.state.status).toBe("idle");
  });

  test("notification hydration failure retains authenticated schedule and exposes a recoverable error", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      window.__supabaseFixture.settings.deniedTable = "notifications";
      const login = await loginService.loginWithPassword("linked@example.com", "password1234");
      renderPage("notifications");
      return { login, account: loginService.getCurrentAccount(), games: gameService.getAll(), notificationState: notificationService.getNotificationHydrationState(), scheduleState: supabaseAuthService.getHydrationState() };
    });
    expect(result.login.success).toBe(true);
    expect(result.account.id).toBe("profile-umpire-1");
    expect(result.games.map(game => game.id)).toEqual(["game-1"]);
    expect(result.notificationState.status).toBe("error");
    expect(result.scheduleState.status).toBe("ready");
    await expect(supabaseAuthApp.page.getByTestId("notification-hydration-error")).toBeVisible();
  });
});

test.describe("Supabase role and recipient visibility", () => {
  test.use({ supabaseScenario: {
    profile: { id: "profile-admin-1", auth_user_id: "auth-admin-1", organization_id: "organization-1", first_name: "Ada", last_name: "Admin", email: "admin@example.com", role: "administrator", status: "approved", communication_preferences: {} },
    crewId: null,
    notifications: [{ ...ownNotification, id: "notification-admin", audience: "admin", recipient_profile_id: "profile-admin-1", title: "Pending Claim" }]
  } });

  test("administrator hydrates private notifications and can open the center", async ({ supabaseAuthApp }) => {
    await supabaseAuthApp.page.evaluate(async () => {
      await loginService.loginWithPassword("admin@example.com", "password1234");
      renderPage("notifications");
    });
    await expect(supabaseAuthApp.page.getByTestId("nav-notifications")).toBeVisible();
    await expect(supabaseAuthApp.page.getByText("Pending Claim")).toBeVisible();
  });
});

test("independent authenticated contexts isolate recipients and organizations", async ({ supabaseAuthApp }) => {
  const notifications = [
    ownNotification,
    { ...ownNotification, id: "notification-other", recipient_profile_id: "profile-umpire-2", title: "Other Recipient" },
    { ...ownNotification, id: "notification-other-org", organization_id: "organization-2", recipient_profile_id: "profile-umpire-3", title: "Other Organization" }
  ];
  const first = await supabaseAuthApp.openContext({ notifications });
  const second = await supabaseAuthApp.openContext({
    notifications,
    profile: { id: "profile-umpire-2", auth_user_id: "auth-umpire-2", organization_id: "organization-1", first_name: "Second", last_name: "Umpire", email: "second@example.com", role: "umpire", status: "approved", communication_preferences: {} },
    crewId: "crew-umpire-2"
  });
  const third = await supabaseAuthApp.openContext({
    notifications,
    profile: { id: "profile-umpire-3", auth_user_id: "auth-umpire-3", organization_id: "organization-2", first_name: "Third", last_name: "Umpire", email: "third@example.com", role: "umpire", status: "approved", communication_preferences: {} },
    crewId: "crew-umpire-3"
  });
  const loginAndRead = page => page.evaluate(async () => {
    await loginService.loginWithPassword(window.__supabaseFixture.settings.profile.email, "password1234");
    return notificationService.getAll().map(item => item.title);
  });
  expect(await loginAndRead(first.page)).toEqual(["Claim Approved"]);
  expect(await loginAndRead(second.page)).toEqual(["Other Recipient"]);
  expect(await loginAndRead(third.page)).toEqual(["Other Organization"]);
  await first.context.close();
  await second.context.close();
  await third.context.close();
});
