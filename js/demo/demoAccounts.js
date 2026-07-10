// js/demo/demoAccounts.js

const demoAccountData = (() => {
  const accounts = [
    {
      firstName: "Sarah",
      lastName: "Johnson",
      email: "sarah.johnson@example.com",
      status: "approved",
      crewId: "demo-crew-1"
    },
    {
      firstName: "Mike",
      lastName: "Andrews",
      email: "mike.andrews@example.com",
      status: "approved",
      crewId: "demo-crew-2"
    },
    {
      firstName: "Emily",
      lastName: "Brown",
      email: "emily.brown@example.com",
      status: "pending",
      crewId: null
    },
    {
      firstName: "Kevin",
      lastName: "Davis",
      email: "kevin.davis@example.com",
      status: "pending",
      crewId: null
    },
    {
      firstName: "Chris",
      lastName: "Walker",
      email: "chris.walker@example.com",
      status: "rejected",
      crewId: null
    },
    {
      firstName: "Alex",
      lastName: "Wilson",
      email: "alex.wilson@example.com",
      status: "inactive",
      crewId: null
    }
  ];

  function getAll() {
    return structuredClone(accounts);
  }

  return {
    getAll
  };
})();