// js/demo/demoAccounts.js

const demoAccountData = (() => {
  const accounts = [
    {
      id: "demo-account-001",
      firstName: "Ethan",
      lastName: "Parker",
      email: "ethan@demo.test",
      phone: "555-0101",
      status: "approved",
      crewId: "demo-crew-1",
      createdAt: "2026-01-10T14:00:00.000Z"
    },
    {
      id: "demo-account-002",
      firstName: "Noah",
      lastName: "Brooks",
      email: "noah@demo.test",
      phone: "555-0102",
      status: "approved",
      crewId: "demo-crew-2",
      createdAt: "2026-01-12T15:30:00.000Z"
    },
    {
      id: "demo-account-003",
      firstName: "Maya",
      lastName: "Chen",
      email: "maya.chen@demo.test",
      phone: "555-0103",
      status: "pending",
      crewId: null,
      createdAt: "2026-02-03T18:15:00.000Z"
    },
    {
      id: "demo-account-004",
      firstName: "Olivia",
      lastName: "Grant",
      email: "olivia.grant@demo.test",
      phone: "555-0104",
      status: "pending",
      crewId: null,
      createdAt: "2026-02-05T19:20:00.000Z"
    },
    {
      id: "demo-account-005",
      firstName: "Daniel",
      lastName: "Ruiz",
      email: "daniel.ruiz@demo.test",
      phone: "555-0105",
      status: "rejected",
      crewId: null,
      createdAt: "2026-01-22T16:45:00.000Z"
    },
    {
      id: "demo-account-006",
      firstName: "Priya",
      lastName: "Shah",
      email: "priya.shah@demo.test",
      phone: "555-0106",
      status: "inactive",
      crewId: null,
      createdAt: "2025-12-18T13:10:00.000Z"
    }
  ];

  function getAll() {
    return structuredClone(accounts);
  }

  return {
    getAll
  };
})();