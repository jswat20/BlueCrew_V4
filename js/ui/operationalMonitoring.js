function escapeOperationalMonitoringHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function renderOperationalMonitoring() {
  return `
    <section class="page-section operational-monitoring" aria-labelledby="operational-monitoring-title">
      <div class="section-header">
        <div>
          <h2 id="operational-monitoring-title">Operations Health</h2>
          <p>Tenant-scoped, privacy-safe diagnostics from the last 24 hours.</p>
        </div>
        <div class="button-row">
          <button type="button" class="button button-secondary" data-testid="monitoring-refresh">Refresh</button>
          <button type="button" class="button button-secondary" data-testid="monitoring-controlled-failure">Run safe diagnostic</button>
          <button type="button" class="button button-secondary" data-testid="monitoring-evaluate-alerts">Evaluate alerts</button>
        </div>
      </div>
      <p class="form-help">Business-rule conflicts are tracked separately and do not count as outages. Diagnostics never include tokens, email bodies, invitation links, passwords, or user-entered form content.</p>
      <div data-testid="monitoring-content" aria-live="polite" aria-busy="true">
        <p>Loading operational health…</p>
      </div>
      <div data-testid="incident-content" aria-live="polite"><p>Loading internal alerts…</p></div>
    </section>`;
}

function monitoringStatusLabel(status) {
  return status === "critical" ? "Action required" : status === "warning" ? "Review recommended" : "Healthy";
}

function renderMonitoringEvent(event) {
  const context = event.diagnostic_context || {};
  const details = [context.workflow, context.page, event.error_code].filter(Boolean).join(" · ");
  return `<tr>
    <td><time datetime="${escapeOperationalMonitoringHtml(event.occurred_at)}">${escapeOperationalMonitoringHtml(new Date(event.occurred_at).toLocaleString())}</time></td>
    <td>${escapeOperationalMonitoringHtml(event.module_code)}</td>
    <td>${escapeOperationalMonitoringHtml(event.operation)}</td>
    <td>${escapeOperationalMonitoringHtml(event.classification.replaceAll("_", " "))}</td>
    <td>${escapeOperationalMonitoringHtml(event.severity)}</td>
    <td>${escapeOperationalMonitoringHtml(details || "No additional context")}</td>
    <td><code>${escapeOperationalMonitoringHtml(event.correlation_id)}</code></td>
  </tr>`;
}

async function refreshOperationalMonitoring() {
  const root = document.querySelector('[data-testid="monitoring-content"]');
  if (!root) return;
  root.setAttribute("aria-busy", "true");
  try {
    const health = await operationalMonitoringService.loadHealth(24);
    const summary = operationalMonitoringService.thresholds(health.events, health.email);
    root.innerHTML = `
      <div class="monitoring-status" data-status="${summary.status}" data-testid="monitoring-status">
        <strong>${monitoringStatusLabel(summary.status)}</strong>
        <span>${summary.operationalFailures} operational failures · ${summary.criticalSignals} security-critical signals · ${summary.expectedRejections} expected rejections</span>
      </div>
      <div class="monitoring-metrics" aria-label="Operational monitoring summary">
        <article><strong>${summary.authFailures}</strong><span>Auth failures, 15 min</span></article>
        <article><strong>${summary.failedEmail}</strong><span>Failed email deliveries</span></article>
        <article><strong>${Number(health.email.pending_count || 0)}</strong><span>Pending email deliveries</span></article>
        <article><strong>${Number(health.email.retrying_count || 0)}</strong><span>Email deliveries retrying</span></article>
      </div>
      <p class="form-help">Alert thresholds: any critical security signal, five operational failures in 15 minutes, three authentication failures in 15 minutes, or ten failed email deliveries requires immediate operator review.</p>
      <div class="table-wrapper" tabindex="0" role="region" aria-label="Recent operational events">
        <table><thead><tr><th>Time</th><th>Module</th><th>Operation</th><th>Classification</th><th>Severity</th><th>Safe context</th><th>Correlation</th></tr></thead>
        <tbody>${health.events.length ? health.events.map(renderMonitoringEvent).join("") : '<tr><td colspan="7">No diagnostic events were recorded in this period.</td></tr>'}</tbody></table>
      </div>`;
    await refreshOperationalIncidents();
  } catch (error) {
    root.innerHTML = '<div role="alert" tabindex="-1" data-testid="monitoring-load-error">Operational health could not be loaded. Customer operations are unaffected. Retry or follow the incident runbook.</div>';
    root.querySelector('[role="alert"]')?.focus();
  } finally {
    root.setAttribute("aria-busy", "false");
  }
}

function renderOperationalIncident(incident) {
  const controls = incident.status === "open"
    ? `<button type="button" class="button button-secondary" data-incident-action="acknowledge" data-incident-id="${escapeOperationalMonitoringHtml(incident.id)}">Acknowledge</button>`
    : incident.status === "acknowledged"
      ? `<button type="button" class="button button-secondary" data-incident-action="recover" data-incident-id="${escapeOperationalMonitoringHtml(incident.id)}">Mark recovered</button>` : "—";
  return `<tr><td>${escapeOperationalMonitoringHtml(incident.safe_summary)}</td><td>${escapeOperationalMonitoringHtml(incident.severity)}</td><td>${escapeOperationalMonitoringHtml(incident.status)}</td><td>${Number(incident.source_event_count || 0)}</td><td><code>${escapeOperationalMonitoringHtml(incident.correlation_id)}</code></td><td>${controls}</td></tr>`;
}

async function refreshOperationalIncidents() {
  const root = document.querySelector('[data-testid="incident-content"]');
  if (!root) return;
  const incidents = await operationalMonitoringService.loadIncidents(50);
  root.innerHTML = `<h3>Internal alerts</h3><p class="form-help">External alert delivery is disabled pending explicit destination approval. Repeated signals update one active incident.</p><div class="table-wrapper" tabindex="0" role="region" aria-label="Internal operational alerts"><table><thead><tr><th>Signal</th><th>Severity</th><th>Status</th><th>Events</th><th>Correlation</th><th>Action</th></tr></thead><tbody>${incidents.length ? incidents.map(renderOperationalIncident).join("") : '<tr><td colspan="6">No internal alerts.</td></tr>'}</tbody></table></div>`;
  root.querySelectorAll("[data-incident-action]").forEach(button => button.addEventListener("click", handleIncidentAction));
}

async function evaluateOperationalAlerts() {
  const incidentId = await operationalMonitoringService.evaluateAlerts();
  if (!incidentId) toastService.success("No actionable operational signal crossed the internal alert threshold.");
  else toastService.success("Internal alert evaluated. External delivery remains disabled.");
  await refreshOperationalIncidents();
}

async function handleIncidentAction(event) {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const changed = button.dataset.incidentAction === "acknowledge"
      ? await operationalMonitoringService.acknowledgeIncident(button.dataset.incidentId)
      : await operationalMonitoringService.recoverIncident(button.dataset.incidentId);
    if (!changed) throw new Error("incident_state_changed");
    toastService.success(button.dataset.incidentAction === "acknowledge" ? "Incident acknowledged." : "Incident marked recovered.");
    await refreshOperationalIncidents();
  } catch (error) {
    toastService.error("The incident state changed or could not be updated. Refresh and try again.");
    button.focus();
  } finally { button.disabled = false; }
}

async function runControlledOperationalDiagnostic() {
  const correlationId = operationalMonitoringService.correlationId();
  const event = await operationalMonitoringService.capture({
    correlationId,
    moduleCode: "platform",
    operation: "diagnostic.controlled_failure",
    classification: "operational_failure",
    severity: "warning",
    errorCode: "controlled_diagnostic",
    retryable: false,
    context: { workflow: "hosted_acceptance", source: "operator_diagnostic" }
  });
  if (!event) return toastService.error("The safe diagnostic signal was not captured. Customer operations were not interrupted.");
  toastService.success(`Safe diagnostic captured. Correlation ${correlationId}.`);
  await refreshOperationalMonitoring();
}

function setupOperationalMonitoring() {
  document.querySelector('[data-testid="monitoring-refresh"]')?.addEventListener("click", refreshOperationalMonitoring);
  document.querySelector('[data-testid="monitoring-controlled-failure"]')?.addEventListener("click", runControlledOperationalDiagnostic);
  document.querySelector('[data-testid="monitoring-evaluate-alerts"]')?.addEventListener("click", evaluateOperationalAlerts);
  refreshOperationalMonitoring();
}
