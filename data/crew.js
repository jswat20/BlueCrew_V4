let crew = [
  {
    id: 1,
    firstName: "Mike",
    lastName: "Johnson",
    email: "mike.johnson@example.com",
    phone: "410-555-1001",
    levels: ["10U", "12U"],
    active: true,
    notes: ""
  },
  {
    id: 2,
    firstName: "Chris",
    lastName: "Smith",
    email: "chris.smith@example.com",
    phone: "410-555-1002",
    levels: ["8U", "10U", "12U", "14U"],
    active: true,
    notes: ""
  },
  {
    id: 3,
    firstName: "Steve",
    lastName: "Brown",
    email: "steve.brown@example.com",
    phone: "410-555-1003",
    levels: ["14U", "Juniors", "Seniors"],
    active: false,
    notes: "Inactive for now."
  }
];

function getCrewFullName(member) {
  return `${member.firstName} ${member.lastName}`;
}