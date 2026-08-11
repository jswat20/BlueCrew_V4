import {
  expect,
  test
} from "./fixtures/app.fixture.js";

test("fall-season umpire workflow persists across roles and refresh", async ({ app }) => {
  const seeded = await app.page.evaluate(() => {
    localStorage.removeItem("bluecrew_accounts");
    localStorage.removeItem("bluecrew_session");
    notificationService.clearAll();

    authService.loginAsAdmin();

    const registration = accountService.createAccount({
      firstName: "Fall",
      lastName: "Umpire",
      email: "fall-pilot-umpire@test.com",
      phone: "5551112222"
    });

    const pendingAccount = accountService
      .getPendingAccounts()
      .find(account => account.id === registration.data.id);

    const crewMember = crewService.getAll()[0];
    const approval = accountService.approveAccount(
      registration.data.id,
      crewMember.id
    );

    const login = loginService.login(
      registration.data.email
    );
    authService.loginAsCrew(crewMember.id);

    const profile = accountService.updateProfile(
      registration.data.id,
      {
        email: registration.data.email,
        phone: "5553334444",
        address: "42 Fall Ball Lane",
        emergencyContact: "Pilot Contact",
        emergencyContactPhone: "5557778888"
      }
    );

    const availability = availabilityService.setAvailability({
      crewId: crewMember.id,
      date: "2099-10-10",
      status: "available",
      startTime: "12:00",
      endTime: "22:00"
    });

    authService.loginAsAdmin();

    const csv = [
      "date,time,awayTeam,homeTeam,locationComplex,locationField,level,gameType",
      "2099-10-10,6:00 PM,Fall Away,Fall Home,Riverside Park,Field 2,12U,single",
      "2099-10-11,7:00 PM,Decline Away,Decline Home,East Complex,Field 1,14U,single"
    ].join("\n");

    const preview = scheduleImportService.preview(csv);
    const importedGames = preview.games.map(
      (game, index) => gameService.create({ ...game, id: `fall-release-game-${index + 1}` }).data
    );
    const claimGame = importedGames[0];
    const declineGame = importedGames[1];

    const opened = assignmentService.openForClaims(
      claimGame.id
    );
    const directAssignment = assignmentService.assignCrew(
      declineGame.id,
      crewMember.id
    );

    authService.loginAsCrew(crewMember.id);
    const visibleOpenGame = portalService
      .getClaimableGames()
      .find(game => String(game.id) === String(claimGame.id));
    const claim = portalService.claimGame(claimGame.id);

    authService.loginAsAdmin();
    const approvalResult = claimsQueueService.approveClaim(
      claimGame.id
    );

    authService.loginAsCrew(crewMember.id);
    const scheduleBeforeReload = portalService.getMySchedule();
    const missingReason = portalService.declineAssignment(
      declineGame.id,
      "   "
    );
    const decline = portalService.declineAssignment(
      declineGame.id,
      "School event conflict"
    );

    const firstReminder = notificationService
      .generateUpcomingGameReminders(
        new Date("2099-10-10T06:00:00")
      );
    const secondReminder = notificationService
      .generateUpcomingGameReminders(
        new Date("2099-10-10T06:00:00")
      );

    authService.loginAsAdmin();
    const declineNotification = notificationService
      .getNotifications()
      .find(notification =>
        notification.type === "assignment-declined" &&
        String(notification.relatedId) === String(declineGame.id)
      );

    authService.loginAsCrew(crewMember.id);

    return {
      accountId: registration.data.id,
      email: registration.data.email,
      crewId: crewMember.id,
      pendingSeen: Boolean(pendingAccount),
      approval,
      login,
      profile,
      availability,
      preview,
      claimGameId: claimGame.id,
      declineGameId: declineGame.id,
      importedLocation: {
        complex: claimGame.locationComplex,
        field: claimGame.locationField
      },
      opened,
      directAssignment,
      visibleOpenGame: Boolean(visibleOpenGame),
      claim,
      approvalResult,
      scheduleBeforeReload,
      missingReason,
      decline,
      declinedAssignment: assignmentService
        .getAssignments(gameService.getById(declineGame.id))[0],
      declineNotification,
      firstReminder,
      secondReminder
    };
  });

  expect(seeded.pendingSeen).toBe(true);
  expect(seeded.approval.success).toBe(true);
  expect(seeded.login.success).toBe(true);
  expect(seeded.profile.success).toBe(true);
  expect(seeded.profile.data.phone).toBe("(555) 333-4444");
  expect(seeded.availability.status).toBe("available");
  expect(seeded.preview).toEqual(
    expect.objectContaining({
      success: true,
      validRows: 2,
      invalidRows: 0
    })
  );
  expect(seeded.importedLocation).toEqual({
    complex: "Riverside Park",
    field: "Field 2"
  });
  expect(seeded.opened.success).toBe(true);
  expect(seeded.directAssignment.success).toBe(true);
  expect(seeded.visibleOpenGame).toBe(true);
  expect(seeded.claim.success).toBe(true);
  expect(seeded.approvalResult.success).toBe(true);
  expect(
    seeded.scheduleBeforeReload.some(
      game => String(game.id) === String(seeded.claimGameId)
    )
  ).toBe(true);
  expect(seeded.missingReason).toEqual(
    expect.objectContaining({
      success: false,
      message: "Enter a reason for declining the assignment."
    })
  );
  expect(seeded.decline.success).toBe(true);
  expect(seeded.declinedAssignment).toEqual(
    expect.objectContaining({
      crewId: "",
      status: "needs_assignment",
      declineReason: "School event conflict"
    })
  );
  expect(seeded.declineNotification).toEqual(
    expect.objectContaining({
      audience: "admin",
      relatedId: seeded.declineGameId
    })
  );
  expect(seeded.firstReminder.createdCount).toBe(1);
  expect(seeded.secondReminder).toEqual(
    expect.objectContaining({
      createdCount: 0,
      duplicateCount: 1
    })
  );

  await app.page.evaluate(() => renderPage("my-schedule"));
  await expect(
    app.page.getByTestId(`my-schedule-row-${seeded.claimGameId}`)
  ).toBeVisible();

  await app.page.evaluate(() => renderPage("accounts"));
  await expect(app.page.getByTestId("access-denied")).toBeVisible();

  await app.page.reload();

  const persisted = await app.page.evaluate(({ accountId, crewId, email, claimGameId, declineGameId }) => {
    loginService.logout();
    const login = loginService.login(email);
    authService.loginAsCrew(crewId);

    const account = accountService.getById(accountId);
    const claimGame = gameService.getById(claimGameId);
    const declineGame = gameService.getById(declineGameId);

    return {
      login,
      account,
      availability: availabilityService.getAvailability(
        crewId,
        "2099-10-10",
        "6:00 PM"
      ),
      schedule: portalService.getMySchedule(),
      claimAssignment: assignmentService.getAssignments(claimGame)[0],
      declineAssignment: assignmentService.getAssignments(declineGame)[0],
      declineRecord: declineGame.assignmentDeclines.at(-1),
      reminders: notificationService.getAll().filter(
        notification =>
          String(notification.relatedId) === String(claimGameId) &&
          String(notification.reminderKey || "").startsWith("game-reminder-24-hour:")
      )
    };
  }, seeded);

  expect(persisted.login.success).toBe(true);
  expect(persisted.account).toEqual(
    expect.objectContaining({
      phone: "(555) 333-4444",
      address: "42 Fall Ball Lane",
      emergencyContact: "Pilot Contact"
    })
  );
  expect(persisted.availability).toBe("available");
  expect(persisted.claimAssignment).toEqual(
    expect.objectContaining({
      crewId: seeded.crewId,
      status: "assigned"
    })
  );
  expect(persisted.declineAssignment).toEqual(
    expect.objectContaining({
      crewId: "",
      status: "needs_assignment"
    })
  );
  expect(persisted.declineRecord.reason).toBe(
    "School event conflict"
  );
  expect(persisted.reminders).toHaveLength(1);
  expect(
    persisted.schedule.some(
      game => String(game.id) === String(seeded.claimGameId)
    )
  ).toBe(true);
});
