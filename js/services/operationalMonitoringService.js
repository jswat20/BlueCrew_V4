// Privacy-safe, best-effort operational diagnostics. Monitoring failures are
// intentionally swallowed so they can never interrupt customer operations.
const operationalMonitoringService = (() => {
  const BUSINESS_REJECTIONS = new Set([
    "field_reservation_conflict", "reservation_conflict", "reservation_blocked_by_closure",
    "reservation_outside_availability", "field_outside_availability", "field_unavailable", "league_team_conflict",
    "workspace_membership_required", "workspace_entitlement_required",
    "workspace_administrator_required", "assignment_position_filled",
    "duplicate_game", "tournament_tie_unresolved"
  ]);
  const BUSINESS_REJECTION_MESSAGES = [
    /already reserved during this time/i,
    /reservation conflict/i,
    /blocked by (?:a )?(?:maintenance |blackout |weather )?closure/i,
    /outside (?:the )?(?:configured )?availability/i,
    /team (?:schedule )?conflict/i,
    /already scheduled/i
  ];
  const SAFE_MODULES = new Set([
    "platform", "auth", "security", "league", "umpire", "tournament",
    "facility", "email", "edge_function"
  ]);

  function correlationId() {
    const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `slate-${String(value).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 72)}`;
  }

  function errorCode(error) {
    const raw = String(error?.code || error?.details || error?.message || "unknown_failure");
    const candidate = raw.split(/\s|\n|\?|#/)[0].replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80);
    return candidate || "unknown_failure";
  }

  function safeContext(context = {}) {
    return {
      page: String(context.page || window.BlueCrew?.test?.currentPage || "unknown").slice(0, 60),
      runtime: String(context.runtime || (typeof supabaseClientService !== "undefined" ? supabaseClientService.getRuntimeMode?.() : "unknown") || "unknown").slice(0, 20),
      workflow: String(context.workflow || "").slice(0, 60),
      record_kind: String(context.recordKind || "").slice(0, 40),
      attempt: Number.isInteger(context.attempt) ? context.attempt : undefined,
      duration_ms: Number.isInteger(context.durationMs) ? context.durationMs : undefined,
      source: String(context.source || "browser").slice(0, 40)
    };
  }

  function isExpectedRejection(error, code = errorCode(error)) {
    if (BUSINESS_REJECTIONS.has(code)) return true;
    const message = String(error?.message || error?.details || "");
    return BUSINESS_REJECTION_MESSAGES.some(pattern => pattern.test(message));
  }

  async function capture(input = {}) {
    if (typeof supabaseClientService === "undefined" || !supabaseClientService.isConfigured?.()) return null;
    try {
      const event = {
        correlationId: input.correlationId || correlationId(),
        moduleCode: SAFE_MODULES.has(input.moduleCode) ? input.moduleCode : "platform",
        operation: String(input.operation || "client.unknown").toLowerCase().replace(/[^a-z0-9_.-]/g, "_").slice(0, 80),
        classification: input.classification || "operational_failure",
        severity: input.severity || "error",
        errorCode: input.errorCode || null,
        httpStatus: Number(input.httpStatus) || null,
        retryable: input.retryable === true,
        context: safeContext(input.context)
      };
      const result = await supabaseSharedRepository.recordOperationalEvent(event);
      if (result.error) throw result.error;
      return { ...event, id: result.data };
    } catch (monitoringError) {
      console.warn("Operational monitoring signal could not be recorded.", {
        code: errorCode(monitoringError)
      });
      return null;
    }
  }

  function captureFailure(moduleCode, operation, error, context = {}) {
    const code = errorCode(error);
    const expected = isExpectedRejection(error, code);
    return capture({
      moduleCode,
      operation,
      classification: expected ? "expected_rejection" : "operational_failure",
      severity: expected ? "info" : "error",
      errorCode: code,
      httpStatus: Number(error?.status || error?.statusCode) || null,
      retryable: !expected && [408, 429, 500, 502, 503, 504].includes(Number(error?.status || error?.statusCode)),
      context
    });
  }

  function captureSecurity(operation, error, context = {}) {
    return capture({
      moduleCode: "security",
      operation,
      classification: "security_signal",
      severity: "critical",
      errorCode: errorCode(error),
      context
    });
  }

  async function loadHealth(hours = 24) {
    const since = new Date(Date.now() - Math.max(1, Math.min(Number(hours) || 24, 720)) * 3600000).toISOString();
    const [events, email] = await Promise.all([
      supabaseSharedRepository.getOperationalHealth(since, 150),
      supabaseSharedRepository.getCommunicationDeliveryHealth()
    ]);
    if (events.error) throw events.error;
    if (email.error) throw email.error;
    return { events: events.data || [], email: email.data?.[0] || {} };
  }

  function thresholds(events = [], email = {}) {
    const recent = events.filter(event => Date.now() - new Date(event.occurred_at).getTime() <= 15 * 60000);
    const operationalFailures = recent.filter(event => event.classification === "operational_failure");
    const critical = recent.filter(event => event.severity === "critical");
    const authFailures = recent.filter(event => event.module_code === "auth" && event.classification === "operational_failure");
    const failedEmail = Number(email.failed_count || 0);
    return {
      status: critical.length || operationalFailures.length >= 5 || failedEmail >= 10 ? "critical"
        : operationalFailures.length || authFailures.length >= 3 || failedEmail ? "warning" : "healthy",
      operationalFailures: operationalFailures.length,
      criticalSignals: critical.length,
      authFailures: authFailures.length,
      failedEmail,
      expectedRejections: recent.filter(event => event.classification === "expected_rejection").length
    };
  }

  return { capture, captureFailure, captureSecurity, loadHealth, thresholds, correlationId, errorCode, isExpectedRejection };
})();
