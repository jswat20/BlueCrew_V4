let selectedRulesDivision = "clinic";

function escapeRulesHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function renderRuleItem(rule) {
  const item = typeof rule === "string" ? { text: rule } : rule;
  const subrules = item.subrules?.length
    ? `<ol type="i" class="rules-sublist">${item.subrules.map(subrule => `<li>${escapeRulesHtml(subrule)}</li>`).join("")}</ol>`
    : "";
  return `<li><p>${escapeRulesHtml(item.text)}</p>${subrules}</li>`;
}

function selectRulesDivision(divisionId) {
  if (!RULES_AND_REGULATIONS.divisions.some(division => division.id === divisionId)) return;
  selectedRulesDivision = divisionId;
  renderPage("rules-and-regulations");
}

function renderRulesAndRegulations() {
  const division = RULES_AND_REGULATIONS.divisions.find(item => item.id === selectedRulesDivision) || RULES_AND_REGULATIONS.divisions[0];
  return `
    <div class="page-wrapper rules-page" data-testid="rules-and-regulations-content">
      <section class="rules-introduction" aria-labelledby="rules-page-heading">
        <div><p class="rules-eyebrow">Lake Shore Youth Baseball</p><h2 id="rules-page-heading" data-page-heading tabindex="-1">Rules &amp; Regulations</h2><p class="rules-revised">Revised ${escapeRulesHtml(RULES_AND_REGULATIONS.revised)}</p></div>
        <a class="button button-secondary rules-source-link" href="${escapeRulesHtml(RULES_AND_REGULATIONS.sourceUrl)}" target="_blank" rel="noopener noreferrer" data-testid="rules-source-link">View Official PDF</a>
      </section>
      <div class="rules-tabs" role="tablist" aria-label="Division rules">
        ${RULES_AND_REGULATIONS.divisions.map(item => `<button type="button" role="tab" class="rules-tab${item.id === division.id ? " active" : ""}" aria-selected="${item.id === division.id}" aria-controls="rules-panel" data-testid="rules-tab-${item.id}" onclick="selectRulesDivision('${item.id}')">${escapeRulesHtml(item.name)}</button>`).join("")}
      </div>
      <section id="rules-panel" class="rules-panel" role="tabpanel" aria-labelledby="rules-division-heading" data-testid="rules-panel-${division.id}">
        <header class="rules-division-header"><h3 id="rules-division-heading">${escapeRulesHtml(division.name)} Division</h3><p>${escapeRulesHtml(division.subtitle)}</p></header>
        <aside class="rules-coop-notice" aria-label="Co-Op game notice" data-testid="rules-coop-notice"><strong>Co-Op game notice</strong><p>${escapeRulesHtml(RULES_AND_REGULATIONS.coOpNotice)}</p></aside>
        <div class="rules-sections">
          ${division.sections.map((section, index) => `<article class="rules-section" data-testid="rules-section-${index + 1}"><h4><span>${index + 1}</span>${escapeRulesHtml(section.title)}</h4><ol type="a" class="rules-list">${section.rules.map(renderRuleItem).join("")}</ol></article>`).join("")}
        </div>
        <footer class="rules-source-note">${escapeRulesHtml(RULES_AND_REGULATIONS.sourceNote)}</footer>
      </section>
    </div>`;
}
