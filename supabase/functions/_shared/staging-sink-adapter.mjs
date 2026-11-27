export function createStagingSinkAdapter({ capture } = {}) {
  if (typeof capture !== "function") throw new Error("Staging sink capture function is required.");
  return Object.freeze({
    async sendEmail({ to, subject, idempotencyKey }) {
      if (!/@slate\.invalid$/i.test(String(to || ""))) {
        return {
          success: false,
          retryable: false,
          failureCode: "staging_recipient_not_allowed",
          failureMessage: "Staging email recipient is outside the reserved sink domain."
        };
      }
      return capture({ idempotencyKey, subject });
    }
  });
}
