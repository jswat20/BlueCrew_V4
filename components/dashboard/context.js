
// components/dashboard/context.js

function getDashboardAccount() {
  if (
    typeof loginService !== "undefined" &&
    typeof loginService.getCurrentAccount ===
      "function"
  ) {
    return loginService.getCurrentAccount();
  }

  return null;
}

function getDashboardUserName() {
  const account = getDashboardAccount();

  return (
    account?.firstName ||
    account?.name ||
    "Administrator"
  );
}

function getDashboardGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function formatDashboardCurrentDate() {
  return new Date().toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    }
  );
}

function getDashboardTodayGames() {
  if (
    typeof dashboardService
      .getTodaysSchedule === "function"
  ) {
    return dashboardService
      .getTodaysSchedule();
  }

  const today =
    new Date()
      .toISOString()
      .split("T")[0];

  return dashboardService
    .getUpcomingGames()
    .filter(game => game.date === today);
}

function getDashboardBrief() {
  const todayGames =
    getDashboardTodayGames();

  const openAssignments =
    typeof dashboardService
      .getOpenAssignments === "function"
      ? dashboardService
          .getOpenAssignments()
      : [];

  const pendingClaims =
    typeof dashboardService
      .getPendingClaims === "function"
      ? dashboardService
          .getPendingClaims()
      : [];

  const pendingAccounts =
    typeof dashboardService
      .getPendingAccounts === "function"
      ? dashboardService
          .getPendingAccounts()
      : [];

  const reviews =
    typeof reviewService !== "undefined" &&
    typeof reviewService
      .getReviewCounts === "function"
      ? reviewService.getReviewCounts()
      : {
          needsReview: 0
        };

  const notifications =
    typeof dashboardService
      .getNotificationsSummary === "function"
      ? dashboardService
          .getNotificationsSummary()
      : {
          unreadCount: 0
        };

  return {
    todayGames:
      todayGames.length,

    openAssignments:
      openAssignments.length,

    pendingClaims:
      pendingClaims.length,

    pendingReviews:
      reviews.needsReview || 0,

    pendingAccounts:
      pendingAccounts.length,

    unreadNotifications:
      notifications.unreadCount || 0
  };
}

function getDashboardOutstandingCount(
  brief
) {
  return (
    brief.openAssignments +
    brief.pendingClaims +
    brief.pendingReviews +
    brief.pendingAccounts
  );
}

function openDashboardOperations(
  queue = "all"
) {
  const queueAliases = {
    needsAssignment: "assignments",
    pendingClaims: "claims",
    awaitingReview: "reviews",
    returnedReviews: "reviews",
    pendingAccounts: "accounts"
  };

  const operationsQueue =
    queueAliases[queue] || queue;

  navigateTo(
    "operations-center",
    {
      operationsQueue
    }
  );
}
