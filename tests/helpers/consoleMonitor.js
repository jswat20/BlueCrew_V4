import { expect } from "@playwright/test";

export function createConsoleMonitor(page) {
  const errors = [];

  page.on("pageerror", error => {
    errors.push(error.message);
  });

  page.on("console", message => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  return {
    errors,

    async expectClean() {
      expect(errors).toEqual([]);
    }
  };
}