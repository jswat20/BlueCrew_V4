let selectedRulesTab = "umpire-responsibilities";

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

function getRulesTabs() {
  return [
    RULES_AND_REGULATIONS.responsibilities,
    ...RULES_AND_REGULATIONS.divisions
  ];
}

function resetRulesDivision() {
  selectedRulesTab = RULES_AND_REGULATIONS.responsibilities.id;
}

function selectRulesDivision(tabId, restoreFocus = true) {
  if (!getRulesTabs().some(tab => tab.id === tabId)) return;
  selectedRulesTab = tabId;
  renderPage("rules-and-regulations");
  if (restoreFocus) {
    requestAnimationFrame(() => document.querySelector(`[data-testid="rules-tab-${tabId}"]`)?.focus());
  }
}

function handleRulesTabKeydown(event, tabId) {
  const tabs = getRulesTabs();
  const currentIndex = tabs.findIndex(tab => tab.id === tabId);
  let nextIndex = currentIndex;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % tabs.length;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = tabs.length - 1;
  else return;
  event.preventDefault();
  selectRulesDivision(tabs[nextIndex].id, true);
}

function renderResponsibilitiesItem(item) {
  const note = item.note ? `<p class="responsibilities-item-note">${escapeRulesHtml(item.note)}</p>` : "";
  const children = item.children?.length
    ? `<ul class="responsibilities-list responsibilities-list-nested">${item.children.map(child => renderResponsibilitiesItem(child)).join("")}</ul>`
    : "";
  return `<li><p>${escapeRulesHtml(item.text)}</p>${note}${children}</li>`;
}

function renderSignalGrid() {
  return `
    <section class="responsibilities-section responsibilities-signals" aria-labelledby="responsibilities-signals-heading" data-testid="responsibilities-signals">
      <h4 id="responsibilities-signals-heading">Proper Hand Signals</h4>
      <div class="responsibilities-signal-grid">
        ${RULES_AND_REGULATIONS.responsibilities.signals.map(signal => `
          <figure class="responsibilities-signal" data-testid="responsibilities-signal-${signal.id}">
            <img src="${escapeRulesHtml(signal.image)}" alt="${escapeRulesHtml(`${signal.title}: ${signal.description}`)}" loading="lazy">
            <figcaption><strong>${escapeRulesHtml(signal.title)}</strong><span>${escapeRulesHtml(signal.description)}</span></figcaption>
          </figure>`).join("")}
      </div>
    </section>`;
}

function renderResponsibilitiesPanel() {
  const responsibilities = RULES_AND_REGULATIONS.responsibilities;
  return `
    <section id="rules-panel-${responsibilities.id}" class="rules-panel responsibilities-panel" role="tabpanel" aria-labelledby="rules-tab-${responsibilities.id}" data-testid="rules-panel-${responsibilities.id}">
      <header class="rules-division-header responsibilities-header"><h3>${escapeRulesHtml(responsibilities.title)}</h3><p>${escapeRulesHtml(responsibilities.revised)}</p></header>
      <div class="responsibilities-sections">
        ${responsibilities.sections.map(section => `
          <section class="responsibilities-section" aria-labelledby="responsibilities-${section.id}-heading" data-testid="responsibilities-section-${section.id}">
            <h4 id="responsibilities-${section.id}-heading">${escapeRulesHtml(section.title)}</h4>
            ${section.subheading ? `<h5>${escapeRulesHtml(section.subheading)}</h5>` : ""}
            ${section.note ? `<p class="responsibilities-section-note">${escapeRulesHtml(section.note)}</p>` : ""}
            <ul class="responsibilities-list">${section.items.map(renderResponsibilitiesItem).join("")}</ul>
          </section>
          ${section.id === "uniform" ? renderSignalGrid() : ""}`).join("")}
      </div>
      <section class="responsibilities-closing" aria-label="Closing message and contact information" data-testid="responsibilities-closing">
        ${responsibilities.closing.map(paragraph => `<p>${escapeRulesHtml(paragraph)}</p>`).join("")}
        <address><strong>${escapeRulesHtml(responsibilities.contact.name)}</strong><br>${escapeRulesHtml(responsibilities.contact.phone)}<br>${escapeRulesHtml(responsibilities.contact.email)}</address>
      </section>
      <footer class="rules-source-note responsibilities-source-note">
        <a href="${escapeRulesHtml(responsibilities.sourceUrl)}" target="_blank" rel="noopener noreferrer" data-testid="responsibilities-pdf-link">View/Download Umpire Responsibilities PDF</a>
      </footer>
    </section>`;
}

function renderDivisionPanel(division) {
  return `
    <section id="rules-panel-${division.id}" class="rules-panel" role="tabpanel" aria-labelledby="rules-tab-${division.id}" data-testid="rules-panel-${division.id}">
      <header class="rules-division-header"><h3 id="rules-division-heading">${escapeRulesHtml(division.name)} Division</h3><p>${escapeRulesHtml(division.subtitle)}</p></header>
      <aside class="rules-coop-notice" aria-label="Co-Op game notice" data-testid="rules-coop-notice"><strong>Co-Op game notice</strong><p>${escapeRulesHtml(RULES_AND_REGULATIONS.coOpNotice)}</p></aside>
      <div class="rules-sections">
        ${division.sections.map((section, index) => `<article class="rules-section" data-testid="rules-section-${index + 1}"><h4><span>${index + 1}</span>${escapeRulesHtml(section.title)}</h4><ol type="a" class="rules-list">${section.rules.map(renderRuleItem).join("")}</ol></article>`).join("")}
      </div>
      <footer class="rules-source-note">${escapeRulesHtml(RULES_AND_REGULATIONS.sourceNote)}</footer>
    </section>`;
}

function renderRulesAndRegulations() {
  const tabs = getRulesTabs();
  const selectedTab = tabs.find(item => item.id === selectedRulesTab) || tabs[0];
  const isResponsibilities = selectedTab.id === RULES_AND_REGULATIONS.responsibilities.id;
  return `
    <div class="page-wrapper rules-page" data-testid="rules-and-regulations-content">
      <section class="rules-introduction" aria-labelledby="rules-page-heading">
        <div><p class="rules-eyebrow">Lake Shore Youth Baseball</p><h2 id="rules-page-heading" data-page-heading tabindex="-1">Rules &amp; Regulations</h2><p class="rules-revised">${isResponsibilities ? escapeRulesHtml(selectedTab.revised) : `Revised ${escapeRulesHtml(RULES_AND_REGULATIONS.revised)}`}</p></div>
        <a class="button button-secondary rules-source-link" href="${escapeRulesHtml(RULES_AND_REGULATIONS.sourceUrl)}" target="_blank" rel="noopener noreferrer" data-testid="rules-source-link">View Official PDF</a>
      </section>
      <div class="rules-tabs" role="tablist" aria-label="Rules and regulations topics">
        ${tabs.map(item => `<button type="button" id="rules-tab-${item.id}" role="tab" class="rules-tab${item.id === selectedTab.id ? " active" : ""}" aria-selected="${item.id === selectedTab.id}" aria-controls="rules-panel-${item.id}" tabindex="${item.id === selectedTab.id ? "0" : "-1"}" data-testid="rules-tab-${item.id}" onclick="selectRulesDivision('${item.id}')" onkeydown="handleRulesTabKeydown(event, '${item.id}')">${escapeRulesHtml(item.name)}</button>`).join("")}
      </div>
      ${isResponsibilities ? renderResponsibilitiesPanel() : renderDivisionPanel(selectedTab)}
    </div>`;
}
