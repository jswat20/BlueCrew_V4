
const demoAccountData = (() => {
  function account({
    id,
    firstName,
    lastName,
    email,
    role = "umpire",
    status = "approved",
    crewId = null,
    createdOffset = -60,
    approvedOffset = -55,
    rejectedOffset = null
  }) {
    return {
      id,
      firstName,
      lastName,
      email,
      phone: "555-010-1000",
      role,
      status,
      crewId,
      createdOffset,
      approvedOffset,
      rejectedOffset,
      communicationPreferences: {
        assignments: true,
        claims: true,
        reviews: true,
        availability: true,
        accounts: true,
        activityDigest: true,
        soundEnabled: true,
        desktopNotifications: false
      },
      demoData: true,
      showcaseData: true
    };
  }

  const leadership = [
    account({
      id: "showcase-account-admin-001",
      firstName: "Morgan",
      lastName: "Ellis",
      email: "admin@showcase.theslate.test",
      role: "administrator"
    }),
    account({
      id: "showcase-account-admin-002",
      firstName: "Taylor",
      lastName: "Grant",
      email: "operations@showcase.theslate.test",
      role: "administrator"
    }),
    account({
      id: "showcase-account-assigner-001",
      firstName: "Jamie",
      lastName: "Carter",
      email: "assigner1@showcase.theslate.test",
      role: "assigner"
    }),
    account({
      id: "showcase-account-assigner-002",
      firstName: "Casey",
      lastName: "Monroe",
      email: "assigner2@showcase.theslate.test",
      role: "assigner"
    }),
    account({
      id: "showcase-account-assigner-003",
      firstName: "Riley",
      lastName: "Douglas",
      email: "assigner3@showcase.theslate.test",
      role: "assigner"
    })
  ];

  const umpireAccounts = demoCrewData
    .getAll()
    .map((member, index) =>
      account({
        id:
          `showcase-account-umpire-${String(
            index + 1
          ).padStart(3, "0")}`,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        role: "umpire",
        status: "approved",
        crewId: member.id,
        createdOffset: -120 + index,
        approvedOffset: -115 + index
      })
    );

  const pendingAccounts = [
    ["Avery", "Stone"],
    ["Quinn", "Marshall"],
    ["Dylan", "Porter"],
    ["Reese", "Franklin"]
  ].map(([firstName, lastName], index) =>
    account({
      id:
        `showcase-account-pending-${String(
          index + 1
        ).padStart(3, "0")}`,
      firstName,
      lastName,
      email:
        `${firstName}.${lastName}`
          .toLowerCase() +
        "@showcase.theslate.test",
      status: "pending",
      crewId: null,
      createdOffset: -(index + 1),
      approvedOffset: null
    })
  );

  const rejectedAccounts = [
    account({
      id: "showcase-account-rejected-001",
      firstName: "Harper",
      lastName: "Lane",
      email: "harper.lane@showcase.theslate.test",
      status: "rejected",
      createdOffset: -18,
      approvedOffset: null,
      rejectedOffset: -16
    }),
    account({
      id: "showcase-account-rejected-002",
      firstName: "Peyton",
      lastName: "Cross",
      email: "peyton.cross@showcase.theslate.test",
      status: "rejected",
      createdOffset: -9,
      approvedOffset: null,
      rejectedOffset: -7
    })
  ];

  const accounts = [
    ...leadership,
    ...umpireAccounts,
    ...pendingAccounts,
    ...rejectedAccounts
  ];

  function getAll() {
    return structuredClone(accounts);
  }

  return {
    getAll
  };
})();

if (typeof window !== "undefined") {
  window.demoAccounts = demoAccountData.getAll();
}
