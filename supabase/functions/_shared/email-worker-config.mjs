export const SLATE_PRODUCTION_EMAIL_FROM = "The Slate <notifications@worktheslate.com>";

export function resolveSlateEmailFrom(value) {
  const configured = String(value || "").trim();
  if (!configured) {
    throw new Error("SLATE_EMAIL_FROM is required and must use the verified worktheslate.com sender.");
  }
  if (configured !== SLATE_PRODUCTION_EMAIL_FROM) {
    throw new Error("SLATE_EMAIL_FROM must be The Slate <notifications@worktheslate.com>.");
  }
  return configured;
}
