export function buildAccount(overrides = {}) {
  const id = Date.now();

  return {
    firstName: "Test",
    lastName: "Umpire",
    email: `umpire${id}@test.com`,
    ...overrides
  };
}