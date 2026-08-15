const TRANSIENT_STATUS = new Set([408, 409, 425, 429]);
function safeMessage(value) { return String(value || "Email provider request failed.").replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 500); }

export function createResendAdapter({ apiKey, from, replyTo = "", fetchImpl = fetch } = {}) {
  if (!apiKey || !from) throw new Error("Resend server configuration is incomplete.");
  return Object.freeze({
    async sendEmail({ to, subject, text, html, idempotencyKey }) {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ from, to: [to], subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) })
      });
      let body = {}; try { body = await response.json(); } catch { body = {}; }
      if (response.ok && body?.id) return { success: true, providerMessageId: String(body.id) };
      const retryable = TRANSIENT_STATUS.has(response.status) || response.status >= 500;
      return { success: false, retryable, failureCode: `resend_${response.status || "network"}`, failureMessage: safeMessage(body?.message) };
    }
  });
}

export function providerNetworkFailure(error) {
  return { success: false, retryable: true, failureCode: "provider_network_error", failureMessage: safeMessage(error?.message) };
}
