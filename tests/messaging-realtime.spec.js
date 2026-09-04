import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const administrator = {
  id: "profile-admin-1",
  auth_user_id: "auth-admin-1",
  organization_id: "organization-1",
  first_name: "Fixture",
  last_name: "Administrator",
  email: "admin@example.com",
  phone: "",
  role: "administrator",
  status: "approved",
  communication_preferences: {}
};

test.describe("authorized messaging Realtime lifecycle", () => {
  test.use({ supabaseScenario: { profile: administrator, crewId: null } });

  test("subscribes after authenticated identity is applied and a current event refreshes", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      const login = await supabaseAuthService.login("admin@example.com", "valid-password");
      const fixture = window.__supabaseFixture;
      const channel = fixture.realtimeChannels[0];
      const realtimeAuth = fixture.calls.some(call => call.operation === "realtime.setAuth" && call.authenticated);
      fixture.calls.length = 0;
      await channel.handlers[0].callback({ eventType: "INSERT" });
      return {
        login: login.success,
        role: authorizationService.currentRole(),
        channelName: channel.name,
        handlerTables: channel.handlers.map(item => item.filter.table),
        subscription: messagingService.getSubscriptionState(),
        realtimeAuth,
        refreshes: fixture.calls.filter(call => call.operation === "rpc" && call.name === "get_message_center").length,
        channelCount: fixture.realtimeChannels.length
      };
    });

    expect(result).toEqual({
      login: true,
      role: "administrator",
      channelName: "message-center-profile-admin-1",
      handlerTables: ["messages", "message_receipts", "message_announcements", "message_announcement_recipients"],
      subscription: { status: "subscribed", message: "" },
      realtimeAuth: true,
      refreshes: 1,
      channelCount: 1
    });
  });

  test("Realtime refresh preserves the active tab and expanded conversation", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await supabaseAuthService.login("admin@example.com", "valid-password");
      currentPage = "messages";
      document.body.dataset.page = "messages";
      currentPageContext = { tab: "sent", expandedConversationId: "conversation-1", composerOpen: false };
      const fixture = window.__supabaseFixture;
      await fixture.realtimeChannels[0].handlers[0].callback({ eventType: "INSERT" });
      return {
        context: currentPageContext,
        activeTab: document.querySelector('[data-testid="message-center"]')?.dataset.activeTab
      };
    });

    expect(result).toEqual({
      context: { tab: "sent", expandedConversationId: "conversation-1", composerOpen: false },
      activeTab: "sent"
    });
  });

  test("logout invalidates stale callbacks and re-login creates exactly one channel", async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async () => {
      await supabaseAuthService.login("admin@example.com", "valid-password");
      const fixture = window.__supabaseFixture;
      const staleCallback = fixture.realtimeChannels[0].handlers[0].callback;
      await supabaseAuthService.logout();
      fixture.calls.length = 0;
      await staleCallback({ eventType: "INSERT" });
      const staleRefreshes = fixture.calls.filter(call => call.operation === "rpc" && call.name === "get_message_center").length;
      await supabaseAuthService.login("admin@example.com", "valid-password");
      await messagingService.subscribe();
      return {
        staleRefreshes,
        channelCount: fixture.realtimeChannels.length,
        subscriptions: fixture.calls.filter(call => call.operation === "realtime.subscribe").length,
        status: messagingService.getSubscriptionState().status
      };
    });

    expect(result).toEqual({ staleRefreshes: 0, channelCount: 1, subscriptions: 1, status: "subscribed" });
  });
});

for (const role of ["league_viewer", "assigner"]) {
  test(`${role} does not create a messaging subscription`, async ({ supabaseAuthApp }) => {
    const result = await supabaseAuthApp.page.evaluate(async roleName => {
      const fixture = window.__supabaseFixture;
      fixture.settings.profile.role = roleName;
      fixture.settings.crewId = null;
      const login = await supabaseAuthService.login(fixture.settings.profile.email, "valid-password");
      return {
        login: login.success,
        channels: fixture.realtimeChannels.length,
        channelCalls: fixture.calls.filter(call => call.operation === "realtime.channel").length
      };
    }, role);
    expect(result).toEqual({ login: true, channels: 0, channelCalls: 0 });
  });
}
