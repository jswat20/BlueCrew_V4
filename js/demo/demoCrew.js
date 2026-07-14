
const demoCrewData = (() => {
  const FIRST_NAMES = [
    "Ethan", "Noah", "Caleb", "Logan", "Marcus",
    "Daniel", "Owen", "Lucas", "Henry", "Miles",
    "Jordan", "Connor", "Isaac", "Nathan", "Aaron",
    "Samuel", "Derek", "Victor", "Wesley", "Cole",
    "Elijah", "Gavin", "Ryan", "Adam", "Blake",
    "Trevor", "Cameron", "Jason", "Matthew", "Tyler",
    "Eric", "Anthony", "Brandon", "Kevin", "Justin",
    "Andrew", "Charles", "Dominic", "Ian", "Peter"
  ];

  const LAST_NAMES = [
    "Parker", "Brooks", "Turner", "Mitchell", "Reed",
    "Bennett", "Cooper", "Sullivan", "Foster", "Hayes",
    "Morgan", "Griffin", "Ward", "Price", "Powell",
    "Russell", "Perry", "Butler", "Barnes", "Fisher",
    "Henderson", "Coleman", "Simmons", "Patterson",
    "Bryant", "Alexander", "Hamilton", "Graham",
    "Reynolds", "Wallace", "Woods", "West", "Jordan",
    "Owens", "Murray", "Freeman", "Wells", "Webb",
    "Simpson", "Stevens"
  ];

  const LEVEL_SETS = [
    ["8U", "10U"],
    ["8U", "10U", "12U"],
    ["10U", "12U"],
    ["10U", "12U", "14U"],
    ["12U", "14U", "16U"],
    ["14U", "16U", "18U"]
  ];

  function buildCrewMember(index) {
    const firstName = FIRST_NAMES[index];
    const lastName = LAST_NAMES[index];
    const number = String(index + 1).padStart(3, "0");

    return {
      id: `showcase-crew-${number}`,
      firstName,
      lastName,
      email:
        `${firstName}.${lastName}`
          .toLowerCase() +
        "@showcase.theslate.test",
      phone:
        `555-${String(200 + index).padStart(3, "0")}-${String(
          1000 + index
        )}`,
      levels:
        LEVEL_SETS[index % LEVEL_SETS.length],
      active: index < 37,
      experienceYears:
        index < 8
          ? 12 + index
          : index < 24
            ? 4 + (index % 8)
            : 1 + (index % 4),
      certification:
        index < 10
          ? "Senior"
          : index < 28
            ? "Certified"
            : "Developing",
      preferredPosition:
        index % 3 === 0 ? "Plate" : "Bases",
      demoData: true,
      showcaseData: true
    };
  }

  const crew = Array.from(
    { length: 40 },
    (_, index) => buildCrewMember(index)
  );

  function getAll() {
    return structuredClone(crew);
  }

  return {
    getAll
  };
})();
