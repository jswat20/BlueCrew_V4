import { providerNetworkFailure } from "./resend-adapter.mjs";
import { renderCommunicationEmail } from "./communication-template.mjs";

export async function processCommunicationEmails({ store, provider, appUrl = "", limit = 10 } = {}) {
  const claimed = await store.claim(limit); const summary = { claimed: claimed.length, sent: 0, failed: 0, skipped: 0 };
  for (const delivery of claimed) {
    const message = renderCommunicationEmail(delivery, { appUrl });
    if (!await store.beginAttempt(delivery.delivery_id, delivery.lease_token)) { summary.skipped += 1; continue; }
    let result; try { result = await provider.sendEmail({ to: delivery.recipient_email, ...message, idempotencyKey: delivery.idempotency_key }); }
    catch (error) { result = providerNetworkFailure(error); }
    await store.complete(delivery.delivery_id, delivery.lease_token, result);
    if (result.success) summary.sent += 1; else summary.failed += 1;
  }
  return summary;
}
