let tournamentManagerOverlay = null;
let tournamentManagerReturnFocus = null;
const tournamentEscape = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const tournamentOption = (value, label, selected = false) =>
  `<option value="${tournamentEscape(value)}" ${selected ? "selected" : ""}>${tournamentEscape(label)}</option>`;
const tournamentCanManage = () => authorizationService.canEditSchedule();
async function openTournamentManager() {
  if (!workspaceService.hasModule("tournament")) return false;
  const trigger = document.activeElement;
  await Promise.all([
    tournamentManagementService.load(),
    facilityService.load(),
  ]);
  closeTournamentManager(false);
  tournamentManagerReturnFocus = trigger;
  tournamentManagerOverlay = document.createElement("div");
  tournamentManagerOverlay.innerHTML = `<div class="assign-drawer-backdrop" onclick="closeTournamentManager()"></div><aside class="assign-drawer game-editor-modal tournament-manager" role="dialog" aria-modal="true" aria-labelledby="tournament-manager-title" data-testid="tournament-manager" tabindex="-1"><header class="assign-drawer-header"><h2 id="tournament-manager-title">Tournament Management</h2><button class="button button-link" aria-label="Close tournament manager" onclick="closeTournamentManager()">×</button></header><div id="tournament-manager-body"></div></aside>`;
  tournamentManagerOverlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeTournamentManager();
    }
  });
  document.body.appendChild(tournamentManagerOverlay);
  renderTournamentList();
  tournamentManagerOverlay.querySelector('[role="dialog"]')?.focus();
}
function closeTournamentManager(restoreFocus = true) {
  tournamentManagerOverlay?.remove();
  tournamentManagerOverlay = null;
  if (restoreFocus && tournamentManagerReturnFocus?.isConnected) tournamentManagerReturnFocus.focus();
  if (restoreFocus) tournamentManagerReturnFocus = null;
}
function tournamentBody() {
  return document.getElementById("tournament-manager-body");
}
function renderTournamentList() {
  const s = tournamentManagementService.snapshot();
  tournamentBody().innerHTML = `<section><div class="assign-drawer-actions">${tournamentCanManage() ? `<button class="button button-primary" onclick="renderTournamentForm()">Create Tournament</button>` : ""}</div><div class="tournament-card-grid">${s.tournaments.map((t) => `<article class="presentation-panel"><strong>${tournamentEscape(t.name)}</strong><span>${tournamentEscape(t.sport)} · ${t.starts_on}–${t.ends_on} · ${t.status}</span><button class="button button-link" onclick="openTournament('${t.id}')">${tournamentCanManage() ? "Manage" : "View"}</button></article>`).join("") || "<p>No tournaments yet.</p>"}</div></section>`;
}
function renderTournamentForm(t = {}) {
  tournamentBody().innerHTML = `<form class="game-editor-form" onsubmit="submitTournament(event)"><h3>${t.id ? "Edit" : "Create"} Tournament</h3><input type="hidden" name="id" value="${t.id || ""}"><label>Name<input name="name" value="${tournamentEscape(t.name || "")}" required></label><label>Sport<input name="sport" value="${tournamentEscape(t.sport || "Softball")}" required></label><div class="schedule-generator-grid"><label>Starts<input name="starts_on" type="date" value="${t.starts_on || ""}" required></label><label>Ends<input name="ends_on" type="date" value="${t.ends_on || ""}" required></label></div><label>Timezone<input name="timezone" value="${tournamentEscape(t.timezone || "America/New_York")}" required></label><label>Description<textarea name="description">${tournamentEscape(t.description || "")}</textarea></label><div class="assign-drawer-actions"><button class="button button-primary">Save Tournament</button><button type="button" class="button button-secondary" onclick="renderTournamentList()">Cancel</button></div><div role="alert" id="tournament-error"></div></form>`;
}
async function submitTournament(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const result = await tournamentManagementService.saveTournament(values);
  if (!result.success) return tournamentError(result.message);
  toastService.success("Tournament saved.");
  openTournament(result.data.id);
}
async function openTournament(id) {
  tournamentManagementService.selectTournament(id);
  renderTournamentDetail();
}
function tournamentLifecycleActions(status) {
  const transitions = {
    draft: [["registration", "Open Registration"]],
    registration: [
      ["draft", "Return to Draft"],
      ["scheduled", "Mark Scheduled"],
      ["cancelled", "Cancel Tournament"],
    ],
    scheduled: [
      ["active", "Start Tournament"],
      ["cancelled", "Cancel Tournament"],
    ],
    active: [
      ["completed", "Complete Tournament"],
      ["cancelled", "Cancel Tournament"],
    ],
    completed: [],
    cancelled: [],
  };
  return (transitions[status] || [])
    .map(
      ([next, label]) =>
        `<button class="button button-secondary" onclick="transitionTournamentStatus('${next}')">${label}</button>`,
    )
    .join("");
}
function editCurrentTournament() {
  const s = tournamentManagementService.snapshot();
  const tournament = s.tournaments.find(
    (item) => item.id === s.currentTournamentId,
  );
  if (tournament) renderTournamentForm(tournament);
}
function renderTournamentDetail() {
  const s = tournamentManagementService.snapshot(),
    t = s.tournaments.find((x) => x.id === s.currentTournamentId);
  if (!t) return renderTournamentList();
  const divisions = s.divisions.filter((x) => x.tournament_id === t.id),
    teams = s.teams.filter((x) => x.tournament_id === t.id && !x.withdrawn_at),
    pools = s.pools.filter((x) => x.tournament_id === t.id);
  tournamentBody().innerHTML = `<section data-testid="tournament-detail"><div class="presentation-panel"><strong>${tournamentEscape(t.name)}</strong><p>${tournamentEscape(t.sport)} · ${t.starts_on}–${t.ends_on} · ${t.status}</p><p>${tournamentEscape(t.description)}</p></div><div class="assign-drawer-actions"><button class="button button-secondary" onclick="editCurrentTournament()">Edit</button>${tournamentLifecycleActions(t.status)}<button class="button button-secondary" onclick="renderTournamentList()">All Tournaments</button></div>
  <h3>Divisions</h3><button class="button button-primary" onclick="renderTournamentDivisionForm()">Add Division</button>${divisions.map((d) => `<article class="presentation-panel"><strong>${tournamentEscape(d.name)}</strong><span>${tournamentEscape(d.age_group)} · ${d.game_duration_minutes} minutes</span></article>`).join("") || "<p>No divisions yet.</p>"}
  <h3>Registered Teams</h3><button class="button button-primary" ${divisions.length ? "" : "disabled"} onclick="renderTournamentTeamForm()">Register Team</button>${teams.map((team) => `<article class="presentation-panel"><strong>${tournamentEscape(team.name)}</strong><span>${tournamentEscape(divisions.find((d) => d.id === team.division_id)?.name || "")}${team.seed ? ` · Seed ${team.seed}` : ""}</span><button class="button button-link" onclick="renderTournamentTeamForm('${team.id}')">Edit</button><button class="button button-link" onclick="withdrawTournamentTeam('${team.id}')">Withdraw</button></article>`).join("") || "<p>No teams registered.</p>"}
  <h3>Pools</h3><button class="button button-primary" ${divisions.length ? "" : "disabled"} onclick="renderTournamentPoolForm()">Add Pool</button>${
    pools
      .map(
        (pool) =>
          `<article class="presentation-panel"><strong>${tournamentEscape(pool.name)}</strong><span>${tournamentEscape(divisions.find((d) => d.id === pool.division_id)?.name || "")}</span>${teams
            .filter((x) => x.division_id === pool.division_id)
            .map(
              (team) =>
                `<label>${tournamentEscape(team.name)}<input type="radio" name="pool-${team.id}" ${s.memberships.some((m) => m.team_id === team.id && m.pool_id === pool.id) ? "checked" : ""} onchange="assignTournamentPool('${team.id}','${pool.id}')"></label>`,
            )
            .join("")}</article>`,
      )
      .join("") || "<p>No pools yet.</p>"
  }
  <h3>Pool-play Scheduling</h3><div class="assign-drawer-actions"><button class="button button-primary" ${pools.length ? "" : "disabled"} onclick="renderTournamentScheduleForm()">Generate Schedule</button><button class="button button-secondary" onclick="renderTournamentProposalList()">Saved Proposals</button><button class="button button-primary" data-testid="tournament-results-button" onclick="openTournamentResults()">Game Day, Results & Bracket</button></div></section>`;
}
async function transitionTournamentStatus(status) {
  const id = tournamentManagementService.snapshot().currentTournamentId,
    result = await tournamentManagementService.transition(id, status);
  if (!result.success) return tournamentError(result.message);
  renderTournamentDetail();
}
function renderTournamentDivisionForm() {
  const id = tournamentManagementService.snapshot().currentTournamentId;
  tournamentBody().innerHTML = `<form class="game-editor-form" onsubmit="submitTournamentDivision(event)"><h3>Add Division</h3><input type="hidden" name="tournament_id" value="${id}"><label>Name<input name="name" required></label><label>Age group<input name="age_group"></label><label>Game minutes<input name="game_duration_minutes" type="number" min="15" max="1440" value="90" required></label><button class="button button-primary">Save Division</button><button type="button" class="button button-secondary" onclick="renderTournamentDetail()">Cancel</button><div role="alert" id="tournament-error"></div></form>`;
}
async function submitTournamentDivision(event) {
  event.preventDefault();
  const r = await tournamentManagementService.addDivision(
    Object.fromEntries(new FormData(event.currentTarget)),
  );
  if (!r.success) return tournamentError(r.message);
  renderTournamentDetail();
}
function renderTournamentTeamForm(id) {
  const s = tournamentManagementService.snapshot(),
    team = s.teams.find((x) => x.id === id) || {},
    divisions = s.divisions.filter(
      (x) => x.tournament_id === s.currentTournamentId,
    );
  tournamentBody().innerHTML = `<form class="game-editor-form" onsubmit="submitTournamentTeam(event)"><h3>${id ? "Edit" : "Register"} Team</h3><input type="hidden" name="id" value="${id || ""}"><input type="hidden" name="tournament_id" value="${s.currentTournamentId}"><label>Division<select name="division_id" required>${divisions.map((d) => tournamentOption(d.id, d.name, d.id === team.division_id)).join("")}</select></label><label>Team name<input name="name" value="${tournamentEscape(team.name || "")}" required></label><label>Contact name<input name="contact_name" value="${tournamentEscape(team.contact_name || "")}"></label><label>Contact email<input name="contact_email" type="email" value="${tournamentEscape(team.contact_email || "")}"></label><label>Contact phone<input name="contact_phone" value="${tournamentEscape(team.contact_phone || "")}"></label><label>Seed<input name="seed" type="number" min="1" value="${team.seed || ""}"></label><button class="button button-primary">Save Team</button><button type="button" class="button button-secondary" onclick="renderTournamentDetail()">Cancel</button><div role="alert" id="tournament-error"></div></form>`;
}
async function submitTournamentTeam(event) {
  event.preventDefault();
  const r = await tournamentManagementService.saveTeam(
    Object.fromEntries(new FormData(event.currentTarget)),
  );
  if (!r.success) return tournamentError(r.message);
  renderTournamentDetail();
}
async function withdrawTournamentTeam(id) {
  const r = await tournamentManagementService.withdrawTeam(id);
  if (!r.success) return tournamentError(r.message);
  renderTournamentDetail();
}
function renderTournamentPoolForm() {
  const s = tournamentManagementService.snapshot(),
    divisions = s.divisions.filter(
      (x) => x.tournament_id === s.currentTournamentId,
    );
  tournamentBody().innerHTML = `<form class="game-editor-form" onsubmit="submitTournamentPool(event)"><h3>Add Pool</h3><input type="hidden" name="tournament_id" value="${s.currentTournamentId}"><label>Division<select name="division_id">${divisions.map((d) => tournamentOption(d.id, d.name)).join("")}</select></label><label>Pool name<input name="name" placeholder="Pool A" required></label><button class="button button-primary">Save Pool</button><button type="button" class="button button-secondary" onclick="renderTournamentDetail()">Cancel</button><div role="alert" id="tournament-error"></div></form>`;
}
async function submitTournamentPool(event) {
  event.preventDefault();
  const r = await tournamentManagementService.addPool(
    Object.fromEntries(new FormData(event.currentTarget)),
  );
  if (!r.success) return tournamentError(r.message);
  renderTournamentDetail();
}
async function assignTournamentPool(team, pool) {
  const r = await tournamentManagementService.assignTeam(team, pool);
  if (!r.success) return tournamentError(r.message);
  renderTournamentDetail();
}
function renderTournamentScheduleForm() {
  const s = tournamentManagementService.snapshot(),
    t = s.tournaments.find((x) => x.id === s.currentTournamentId),
    f = facilityService.snapshot();
  tournamentBody().innerHTML = `<form class="game-editor-form" onsubmit="generateTournamentSchedule(event)"><h3>Generate Pool-play Schedule</h3><label>Proposal name<input name="name" value="${tournamentEscape(t.name)} Pool Play" required></label><label>Fields<select name="fields" multiple size="${Math.max(3, f.fields.length)}" required>${f.fields
    .filter((x) => x.active && x.status !== "closed")
    .map((x) =>
      tournamentOption(
        x.id,
        `${f.facilities.find((y) => y.id === x.location_id)?.name || "Complex"} — ${x.name}`,
        true,
      ),
    )
    .join(
      "",
    )}</select></label><div class="schedule-generator-grid"><label>Starts<input name="startDate" type="date" value="${t.starts_on}" required></label><label>Ends<input name="endDate" type="date" value="${t.ends_on}" required></label><label>Window opens<input name="windowStart" type="time" value="08:00" required></label><label>Window closes<input name="windowEnd" type="time" value="20:00" required></label><label>Buffer minutes<input name="bufferMinutes" type="number" min="0" max="180" value="15"></label></div><fieldset><legend>Playing days</legend>${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, i) => `<label><input type="checkbox" name="weekday" value="${i}" checked>${day}</label>`).join("")}</fieldset><button class="button button-primary">Generate Proposal</button><button type="button" class="button button-secondary" onclick="renderTournamentDetail()">Cancel</button><div role="alert" id="tournament-error"></div></form>`;
}
async function generateTournamentSchedule(event) {
  event.preventDefault();
  const form = event.currentTarget,
    value = (name) => form.querySelector(`[name="${name}"]`).value,
    config = {
      tournamentId: tournamentManagementService.snapshot().currentTournamentId,
      name: value("name"),
      fieldIds: [...form.querySelector('[name="fields"]').selectedOptions].map(
        (x) => x.value,
      ),
      startDate: value("startDate"),
      endDate: value("endDate"),
      windowStart: value("windowStart"),
      windowEnd: value("windowEnd"),
      bufferMinutes: Number(value("bufferMinutes") || 0),
      weekdays: [...form.querySelectorAll('[name="weekday"]:checked')].map(
        (x) => Number(x.value),
      ),
    };
  const r = await tournamentManagementService.saveProposal(config);
  if (!r.success) return tournamentError(r.message);
  toastService.success(r.message);
  renderTournamentProposal();
}
function renderTournamentProposalList() {
  const s = tournamentManagementService.snapshot(),
    items = s.proposals.filter(
      (x) => x.tournament_id === s.currentTournamentId,
    );
  tournamentBody().innerHTML = `<section><h3>Saved Proposals</h3>${items.map((x) => `<article class="presentation-panel"><strong>${tournamentEscape(x.name)}</strong><span>${x.status}</span><button class="button button-link" onclick="openTournamentProposal('${x.id}')">Open</button></article>`).join("") || "<p>No proposals yet.</p>"}<button class="button button-secondary" onclick="renderTournamentDetail()">Back</button></section>`;
}
async function openTournamentProposal(id) {
  const r = await tournamentManagementService.selectProposal(id);
  if (!r.success) return tournamentError(r.message);
  renderTournamentProposal();
}
function renderTournamentProposal() {
  const s = tournamentManagementService.snapshot(),
    proposal = s.proposals.find((x) => x.id === s.currentProposalId),
    f = facilityService.snapshot(),
    team = (id) => s.teams.find((x) => x.id === id)?.name || "Team",
    pool = (id) => s.pools.find((x) => x.id === id)?.name || "Pool";
  tournamentBody().innerHTML = `<section data-testid="tournament-proposal-preview"><h3>${tournamentEscape(proposal.name)}</h3><p>${proposal.status} · ${s.proposalGames.filter((x) => x.state === "scheduled").length} scheduled · ${s.proposalGames.filter((x) => x.state === "unscheduled").length} unscheduled</p><div class="table-responsive"><table><thead><tr><th>Pool</th><th>Matchup</th><th>Date</th><th>Time</th><th>Field</th><th>Status</th><th></th></tr></thead><tbody>${s.proposalGames.map((g) => `<tr><td>${tournamentEscape(pool(g.pool_id))}</td><td>${tournamentEscape(team(g.away_team_id))} @ ${tournamentEscape(team(g.home_team_id))}</td><td>${g.game_date || "—"}</td><td>${g.game_time?.slice(0, 5) || "—"}</td><td>${tournamentEscape(f.fields.find((x) => x.id === g.field_id)?.name || "Unscheduled")}</td><td>${g.state}${g.issue ? `: ${tournamentEscape(g.issue)}` : ""}</td><td>${proposal.status === "draft" ? `<button class="button button-link" onclick="editTournamentProposalGame('${g.id}')">Adjust</button>` : ""}</td></tr>`).join("")}</tbody></table></div><div class="assign-drawer-actions">${proposal.status === "draft" ? `<button class="button button-primary" onclick="publishTournamentSchedule()">Publish Atomically</button>` : `<button class="button button-primary" onclick="publishTournamentSchedule()">Verify Idempotent Publication</button>`}<button class="button button-secondary" onclick="renderTournamentProposalList()">All Proposals</button></div><div role="alert" id="tournament-error"></div></section>`;
}
function editTournamentProposalGame(id) {
  const s = tournamentManagementService.snapshot(),
    g = s.proposalGames.find((x) => x.id === id),
    f = facilityService.snapshot();
  tournamentBody().innerHTML = `<form class="game-editor-form" onsubmit="saveTournamentProposalGame(event,'${id}')"><h3>Adjust Proposed Game</h3><label>Date<input name="date" type="date" value="${g.game_date || ""}" required></label><label>Time<input name="time" type="time" value="${g.game_time?.slice(0, 5) || ""}" required></label><label>Field<select name="fieldId">${f.fields.map((x) => tournamentOption(x.id, `${f.facilities.find((y) => y.id === x.location_id)?.name || "Complex"} — ${x.name}`, x.id === g.field_id)).join("")}</select></label><label>Notes<textarea name="notes">${tournamentEscape(g.notes)}</textarea></label><button class="button button-primary">Save Adjustment</button><button type="button" class="button button-secondary" onclick="renderTournamentProposal()">Cancel</button><div role="alert" id="tournament-error"></div></form>`;
}
async function saveTournamentProposalGame(event, id) {
  event.preventDefault();
  const form = event.currentTarget,
    field = facilityService
      .snapshot()
      .fields.find((x) => x.id === form.fieldId.value),
    r = await tournamentManagementService.updateProposalGame({
      id,
      date: form.date.value,
      time: form.time.value,
      fieldId: field.id,
      locationId: field.location_id,
      notes: form.notes.value,
    });
  if (!r.success) return tournamentError(r.message);
  renderTournamentProposal();
}
async function publishTournamentSchedule() {
  const r = await tournamentManagementService.publishProposal();
  if (!r.success) return tournamentError(r.message);
  toastService.success(r.message);
  renderTournamentProposal();
  renderScheduleContent();
}
function tournamentError(message) {
  const el = document.getElementById("tournament-error");
  if (el) {
    el.textContent = message;
    el.tabIndex = -1;
    el.focus();
  }
  else toastService.error(message);
}

async function openTournamentResults() {
  const tournamentId = tournamentManagementService.snapshot().currentTournamentId;
  const result = await tournamentManagementService.loadTournamentStandings(tournamentId);
  if (!result.success) return tournamentError(result.message);
  renderTournamentResults();
}
function tournamentResultFor(gameId) {
  return tournamentManagementService.snapshot().results.find((item) => item.game_id === gameId);
}
function tournamentTeamName(teamId) {
  return tournamentManagementService.snapshot().teams.find((team) => team.id === teamId)?.name || "TBD";
}
function tournamentGameStatus(game) {
  const result = tournamentResultFor(game.id);
  return result ? result.result_status.replaceAll("_", " ") : game.lifecycle_status;
}
function renderTournamentResults() {
  const s = tournamentManagementService.snapshot(), tournamentId = s.currentTournamentId,
    pools = s.pools.filter((pool) => pool.tournament_id === tournamentId),
    games = s.games.filter((game) => game.tournament_id === tournamentId && game.tournament_pool_id),
    brackets = s.brackets.filter((bracket) => bracket.tournament_id === tournamentId), canManage=tournamentCanManage();
  const publication=s.publications.find((item)=>item.tournament_id===tournamentId), tournament=s.tournaments.find((item)=>item.id===tournamentId);
  tournamentBody().innerHTML = `<section data-testid="tournament-results-workspace"><div class="tournament-operations-header"><div><h3>${tournamentEscape(tournament?.name||"Tournament")} Game Day</h3><p>${publication?.published?"Public page is live":"Tournament is private"}</p></div><div class="assign-drawer-actions"><button class="button button-secondary" onclick="renderTournamentDetail()">Tournament Setup</button>${canManage ? `<button class="button button-secondary" onclick="renderTournamentScoringRules()">Scoring Rules</button><button class="button button-primary" onclick="generateCurrentTournamentBracket()">Generate Seeded Bracket</button><button class="button ${publication?.published?"button-secondary":"button-primary"}" data-testid="tournament-publish" onclick="toggleTournamentPublication(${!publication?.published})">${publication?.published?"Unpublish":"Publish"}</button>` : ""}${publication?.published?`<button class="button button-link" onclick="openPublicTournament('${publication.share_token}')">Public page</button>`:""}<button class="button button-link" onclick="printTournament()">Print</button><button class="button button-link" onclick="exportTournamentSchedule()">CSV</button></div></div>${renderTournamentGameDay(s,tournamentId,canManage)}<h3>Pool-play Results</h3>${pools.map((pool) => {
    const standings = s.standings[pool.id]?.rows || [], poolGames = games.filter((game) => game.tournament_pool_id === pool.id);
    return `<article class="presentation-panel" data-testid="pool-results-${pool.id}"><h4>${tournamentEscape(pool.name)}</h4><div class="table-responsive"><table><thead><tr><th>Game</th><th>Score</th><th>Status</th><th></th></tr></thead><tbody>${poolGames.map((game) => { const result=tournamentResultFor(game.id); return `<tr><td>${tournamentEscape(game.away_team)} @ ${tournamentEscape(game.home_team)}</td><td>${result?.away_score ?? "—"}–${result?.home_score ?? "—"}</td><td>${tournamentEscape(tournamentGameStatus(game))}</td><td>${canManage ? `<button class="button button-link" onclick="renderTournamentScoreForm('${game.id}')">${result ? "Correct" : "Enter score"}</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div><h4>Standings</h4>${renderTournamentStandingsTable(standings)}${canManage ? `<button class="button button-link" onclick="renderManualTiebreakForm('${pool.id}')">Record manual tiebreak</button>` : ""}</article>`;
  }).join("")}<h3>Elimination Bracket</h3>${brackets.length ? brackets.map(renderTournamentBracket).join("") : "<p>Finalize every pool game, then generate the seeded bracket.</p>"}<div role="alert" id="tournament-error"></div></section>`;
}
function renderTournamentStandingsTable(rows) {
  if (!rows.length) return "<p>No standings yet.</p>";
  return `<div class="table-responsive"><table data-testid="tournament-standings"><thead><tr><th>Seed</th><th>Team</th><th>GP</th><th>W-L-T</th><th>Pts</th><th>PF</th><th>PA</th><th>Diff</th><th>Tiebreak</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.unresolved_tie ? "T" : row.seed}</td><td>${tournamentEscape(row.name)}</td><td>${row.games_played}</td><td>${row.wins}-${row.losses}-${row.ties}</td><td>${row.standings_points}</td><td>${row.points_for}</td><td>${row.points_against}</td><td>${row.score_differential}</td><td>${row.unresolved_tie ? "Manual decision required" : row.manual_reason ? tournamentEscape(row.manual_reason) : row.head_to_head_points != null ? `Head-to-head ${row.head_to_head_points}` : "Standard order"}</td></tr>`).join("")}</tbody></table></div>`;
}
function renderTournamentScoreForm(gameId) {
  const s=tournamentManagementService.snapshot(), game=s.games.find((item)=>item.id===gameId), result=tournamentResultFor(gameId), elimination=s.bracketGames.some((item)=>item.canonical_game_id===gameId);
  tournamentBody().innerHTML=`<form class="game-editor-form" data-testid="tournament-score-form" onsubmit="submitTournamentScore(event,'${gameId}')"><h3>${result ? "Correct" : "Record"} Result</h3><p>${tournamentEscape(game.away_team)} at ${tournamentEscape(game.home_team)}</p><div class="schedule-generator-grid"><label>${tournamentEscape(game.away_team)} score<input name="awayScore" type="number" min="0" step="1" value="${result?.away_score ?? ""}" required></label><label>${tournamentEscape(game.home_team)} score<input name="homeScore" type="number" min="0" step="1" value="${result?.home_score ?? ""}" required></label></div><label>Status<select name="status"><option value="final">Final</option><option value="forfeited">Forfeited</option><option value="in_progress">In progress</option><option value="postponed">Postponed</option><option value="cancelled">Cancelled</option></select></label>${elimination ? `<label>Advancing winner for a tied score<select name="winnerTeamId"><option value="">Use score</option>${tournamentOption(game.tournament_home_team_id,game.home_team,result?.winner_team_id===game.tournament_home_team_id)}${tournamentOption(game.tournament_away_team_id,game.away_team,result?.winner_team_id===game.tournament_away_team_id)}</select></label>` : ""}<label>Decision/correction note<textarea name="note" required>${tournamentEscape(result?.decision_note || (result ? "Authorized score correction" : "Result confirmed"))}</textarea></label><button class="button button-primary">Confirm Result</button><button type="button" class="button button-secondary" onclick="openTournamentResults()">Cancel</button><div role="alert" id="tournament-error"></div></form>`;
}
async function submitTournamentScore(event,gameId) {
  event.preventDefault(); const form=event.currentTarget;
  const result=await tournamentManagementService.saveResult({gameId,status:form.status.value,homeScore:Number(form.homeScore.value),awayScore:Number(form.awayScore.value),winnerTeamId:form.winnerTeamId?.value||null,note:form.note.value});
  if(!result.success)return tournamentError(result.message); toastService.success("Tournament result saved and standings recalculated."); await openTournamentResults();
}
function renderTournamentScoringRules() {
  const s=tournamentManagementService.snapshot(), divisions=s.divisions.filter((item)=>item.tournament_id===s.currentTournamentId);
  tournamentBody().innerHTML=`<form class="game-editor-form" onsubmit="submitTournamentScoringRules(event)"><h3>Standings Rules</h3><label>Division<select name="divisionId">${divisions.map((division)=>tournamentOption(division.id,division.name)).join("")}</select></label><div class="schedule-generator-grid"><label>Win points<input name="winPoints" type="number" step="0.5" value="3"></label><label>Tie points<input name="tiePoints" type="number" step="0.5" value="1"></label><label>Loss points<input name="lossPoints" type="number" step="0.5" value="0"></label><label>Differential cap<input name="differentialCap" type="number" min="1" value="10"></label></div><label><input name="tiesAllowed" type="checkbox" checked> Pool-play ties allowed</label><p>Tiebreak order: standings points, win percentage, head-to-head only for a two-team tie, capped score differential, points for, then an audited director decision.</p><button class="button button-primary">Save Rules</button><button type="button" class="button button-secondary" onclick="openTournamentResults()">Cancel</button><div role="alert" id="tournament-error"></div></form>`;
}
async function submitTournamentScoringRules(event){event.preventDefault();const f=event.currentTarget,r=await tournamentManagementService.saveRules({division_id:f.divisionId.value,win_points:Number(f.winPoints.value),tie_points:Number(f.tiePoints.value),loss_points:Number(f.lossPoints.value),ties_allowed:f.tiesAllowed.checked,differential_cap:f.differentialCap.value,tiebreak_order:["points","win_percentage","head_to_head","score_differential","points_for","manual"]});if(!r.success)return tournamentError(r.message);toastService.success("Scoring rules saved.");await openTournamentResults();}
function renderManualTiebreakForm(poolId){const s=tournamentManagementService.snapshot(),members=s.memberships.filter((item)=>item.pool_id===poolId).map((item)=>s.teams.find((team)=>team.id===item.team_id)).filter(Boolean);tournamentBody().innerHTML=`<form class="game-editor-form" onsubmit="submitManualTiebreak(event,'${poolId}')"><h3>Director Tiebreak Decision</h3><label>Team<select name="teamId">${members.map((team)=>tournamentOption(team.id,team.name)).join("")}</select></label><label>Priority<input name="priority" type="number" min="1" required></label><label>Reason<textarea name="reason" required></textarea></label><button class="button button-primary">Record Decision</button><button type="button" class="button button-secondary" onclick="openTournamentResults()">Cancel</button><div role="alert" id="tournament-error"></div></form>`;}
async function submitManualTiebreak(event,poolId){event.preventDefault();const f=event.currentTarget,r=await tournamentManagementService.saveManualTiebreak({poolId,teamId:f.teamId.value,priority:Number(f.priority.value),reason:f.reason.value});if(!r.success)return tournamentError(r.message);await openTournamentResults();}
async function generateCurrentTournamentBracket(){const s=tournamentManagementService.snapshot(),division=s.divisions.find((item)=>item.tournament_id===s.currentTournamentId),pools=s.pools.filter((item)=>item.tournament_id===s.currentTournamentId),ranked=[];for(const pool of pools)for(const row of s.standings[pool.id]?.rows||[])ranked.push({...row,poolName:pool.name});if(ranked.some((row)=>row.unresolved_tie))return tournamentError("Resolve every standings tie before seeding.");ranked.sort((a,b)=>a.seed-b.seed||a.poolName.localeCompare(b.poolName));const qualifiers=ranked.slice(0,8).map((row,index)=>({team_id:row.team_id,seed:index+1,pool_id:pools.find((pool)=>pool.name===row.poolName)?.id,pool_seed:row.seed}));const r=await tournamentManagementService.generateBracket({divisionId:division.id,qualifiers,name:"Championship Bracket"});if(!r.success)return tournamentError(r.message);toastService.success("Seeded elimination bracket generated.");await openTournamentResults();}
function renderTournamentBracket(bracket){const s=tournamentManagementService.snapshot(),rounds=s.bracketRounds.filter((item)=>item.bracket_id===bracket.id),games=s.bracketGames.filter((item)=>item.bracket_id===bracket.id),canManage=tournamentCanManage();return `<article class="presentation-panel tournament-bracket" data-testid="tournament-bracket"><h4>${tournamentEscape(bracket.name)}</h4><p>${bracket.status}${bracket.champion_team_id?` · Champion: ${tournamentEscape(tournamentTeamName(bracket.champion_team_id))}`:""}</p><div class="tournament-bracket-grid">${rounds.map((round)=>`<section><h5>${tournamentEscape(round.name)}</h5>${games.filter((game)=>game.round_id===round.id).map((game)=>`<article class="presentation-panel"><strong>${tournamentEscape(tournamentTeamName(game.home_team_id))} vs ${tournamentEscape(tournamentTeamName(game.away_team_id))}</strong><span>${game.canonical_game_id?tournamentGameStatus(s.games.find((item)=>item.id===game.canonical_game_id)||{}):"Unscheduled"}</span>${canManage&&game.home_team_id&&game.away_team_id&&!game.canonical_game_id?`<button class="button button-link" onclick="renderBracketScheduleForm('${game.id}')">Schedule</button>`:""}${canManage&&game.canonical_game_id?`<button class="button button-link" onclick="renderTournamentScoreForm('${game.canonical_game_id}')">Record result</button>`:""}</article>`).join("")}</section>`).join("")}</div></article>`;}
function renderBracketScheduleForm(bracketGameId){const f=facilityService.snapshot();tournamentBody().innerHTML=`<form class="game-editor-form" onsubmit="submitBracketSchedule(event,'${bracketGameId}')"><h3>Schedule Elimination Game</h3><label>Date<input name="date" type="date" required></label><label>Time<input name="time" type="time" required></label><label>Field<select name="fieldId">${f.fields.map((field)=>tournamentOption(field.id,`${f.facilities.find((item)=>item.id===field.location_id)?.name||"Complex"} — ${field.name}`)).join("")}</select></label><button class="button button-primary">Schedule Game</button><button type="button" class="button button-secondary" onclick="openTournamentResults()">Cancel</button><div role="alert" id="tournament-error"></div></form>`;}
async function submitBracketSchedule(event,bracketGameId){event.preventDefault();const f=event.currentTarget,field=facilityService.snapshot().fields.find((item)=>item.id===f.fieldId.value),r=await tournamentManagementService.scheduleBracketGame({bracketGameId,date:f.date.value,time:f.time.value,fieldId:field.id,locationId:field.location_id});if(!r.success)return tournamentError(r.message);toastService.success("Elimination game scheduled with a field reservation.");await openTournamentResults();}

function renderTournamentGameDay(s,tournamentId,canManage){const today=new Date().toISOString().slice(0,10),games=s.games.filter((g)=>g.tournament_id===tournamentId),fields=facilityService.snapshot();const card=(g)=>`<article class="presentation-panel tournament-game-day-card"><strong>${tournamentEscape(g.away_team)} @ ${tournamentEscape(g.home_team)}</strong><span>${g.game_date} · ${String(g.game_time||"").slice(0,5)} · ${tournamentEscape(fields.facilities.find((x)=>x.id===g.location_id)?.name||"Venue TBD")} ${tournamentEscape(fields.fields.find((x)=>x.id===g.field_id)?.name||"")}</span><span>${tournamentEscape(tournamentGameStatus(g))}</span>${canManage?`<div class="assign-drawer-actions"><button class="button button-link" onclick="renderTournamentScoreForm('${g.id}')">Quick score</button>${!tournamentResultFor(g.id)||!['final','forfeited'].includes(tournamentResultFor(g.id).result_status)?`<button class="button button-link" onclick="renderTournamentRescheduleForm('${g.id}')">Reschedule</button><button class="button button-link" onclick="transitionTournamentGame('${g.id}','postpone')">Postpone</button><button class="button button-link" onclick="transitionTournamentGame('${g.id}','cancel')">Cancel</button>`:""}</div>`:""}</article>`;return `<section class="tournament-game-day" data-testid="tournament-game-day"><h3>Today's Operations</h3><div class="tournament-status-grid"><div><h4>Today</h4>${games.filter((g)=>g.game_date===today).map(card).join("")||"<p>No games today.</p>"}</div><div><h4>In progress</h4>${games.filter((g)=>tournamentResultFor(g.id)?.result_status==='in_progress').map(card).join("")||"<p>No games in progress.</p>"}</div><div><h4>Needs attention</h4>${games.filter((g)=>['postponed','cancelled'].includes(g.lifecycle_status)).map(card).join("")||"<p>No schedule issues.</p>"}</div></div></section>`;}
async function toggleTournamentPublication(published){const r=await tournamentManagementService.setPublication(published);if(!r.success)return tournamentError(r.message);toastService.success(published?"Public tournament page is live.":"Public access revoked.");await openTournamentResults();}
function openPublicTournament(token){window.open(`${location.origin}${location.pathname}?tournament=${encodeURIComponent(token)}`,"_blank","noopener");}
function renderTournamentRescheduleForm(gameId){const s=tournamentManagementService.snapshot(),g=s.games.find((x)=>x.id===gameId),f=facilityService.snapshot();tournamentBody().innerHTML=`<form class="game-editor-form" data-testid="tournament-reschedule-form" onsubmit="submitTournamentReschedule(event,'${gameId}')"><h3>Reschedule Tournament Game</h3><p>The game identity and bracket relationship will be preserved.</p><label>Date<input name="date" type="date" value="${g.game_date}" required></label><label>Time<input name="time" type="time" value="${String(g.game_time||'').slice(0,5)}" required></label><label>Field<select name="fieldId" required>${f.fields.map((field)=>tournamentOption(field.id,`${f.facilities.find((x)=>x.id===field.location_id)?.name||"Complex"} — ${field.name}`,field.id===g.field_id)).join("")}</select></label><button class="button button-primary">Save Reschedule</button><button type="button" class="button button-secondary" onclick="openTournamentResults()">Cancel</button><div role="alert" id="tournament-error"></div></form>`;}
async function submitTournamentReschedule(event,gameId){event.preventDefault();const f=event.currentTarget,field=facilityService.snapshot().fields.find((x)=>x.id===f.fieldId.value),r=await tournamentManagementService.rescheduleGame({gameId,date:f.date.value,time:f.time.value,fieldId:field.id,locationId:field.location_id});if(!r.success)return tournamentError(r.message);toastService.success("Game and field reservation rescheduled together.");await openTournamentResults();}
async function transitionTournamentGame(gameId,action){const r=await tournamentManagementService.transitionGame(gameId,action);if(!r.success)return tournamentError(r.message);toastService.success(`Game ${action==='postpone'?'postponed':'cancelled'} and field released.`);await openTournamentResults();}
function printTournament(){window.print();}
function exportTournamentSchedule(){const s=tournamentManagementService.snapshot(),rows=[["Date","Time","Away","Home","Status","Facility","Field"]],f=facilityService.snapshot();for(const g of s.games.filter((x)=>x.tournament_id===s.currentTournamentId))rows.push([g.game_date,String(g.game_time||'').slice(0,5),g.away_team,g.home_team,tournamentGameStatus(g),f.facilities.find((x)=>x.id===g.location_id)?.name||"",f.fields.find((x)=>x.id===g.field_id)?.name||""]);const csv=rows.map((r)=>r.map((v)=>`"${String(v??'').replaceAll('"','""')}"`).join(",")).join("\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="tournament-schedule.csv";a.click();URL.revokeObjectURL(a.href);}

async function renderPublicTournamentPage(token){
  document.body.dataset.page="public-tournament";
  for(const element of document.querySelectorAll(".sidebar,.topbar")){element.hidden=true;element.style.display="none";}
  const host=document.getElementById("app-content");
  host.innerHTML='<div class="page-wrapper"><p>Loading published tournament…</p></div>';
  const {data,error}=await supabaseSharedRepository.getPublicTournament(token);
  if(error||!data){host.innerHTML='<div class="page-wrapper"><section class="page-section" data-testid="public-tournament-unavailable"><h1>Tournament unavailable</h1><p>This link is invalid, private, or no longer published.</p></section></div>';return false;}
  const team=new Map(data.teams.map((x)=>[x.id,x.name])),division=new Map(data.divisions.map((x)=>[x.id,x.name]));
  host.innerHTML=`<main class="public-tournament page-wrapper" data-testid="public-tournament"><header><p class="eyebrow">The Slate Tournament</p><h1>${tournamentEscape(data.tournament.name)}</h1><p>${tournamentEscape(data.tournament.sport)} · ${data.tournament.starts_on}–${data.tournament.ends_on} · ${tournamentEscape(data.tournament.status)}</p><p>${tournamentEscape(data.tournament.description)}</p><div class="assign-drawer-actions"><button class="button button-secondary" onclick="window.print()">Print tournament</button><button class="button button-link" onclick="document.getElementById('public-schedule').scrollIntoView()">Schedule</button><button class="button button-link" onclick="document.getElementById('public-standings').scrollIntoView()">Standings</button><button class="button button-link" onclick="document.getElementById('public-brackets').scrollIntoView()">Brackets</button></div></header>
  <section class="public-tournament-filters" aria-label="Tournament filters"><label>Division<select id="public-division-filter" onchange="filterPublicTournament()"><option value="">All divisions</option>${data.divisions.map((d)=>tournamentOption(d.id,d.name)).join("")}</select></label><label>Team<select id="public-team-filter" onchange="filterPublicTournament()"><option value="">All teams</option>${data.teams.map((t)=>tournamentOption(t.id,t.name)).join("")}</select></label></section>
  <section id="public-schedule"><h2>Schedule & Results</h2><div class="public-card-grid">${data.games.map((g)=>`<article class="presentation-panel public-filterable" data-division="${g.division_id||''}" data-teams="${g.home_team_id||''} ${g.away_team_id||''}"><strong>${tournamentEscape(g.away_team)} @ ${tournamentEscape(g.home_team)}</strong><span>${g.date} · ${String(g.time||'').slice(0,5)} · ${tournamentEscape(g.facility||'Venue TBD')} ${tournamentEscape(g.field||'')}</span><span>${g.result?`${g.result.away_score}–${g.result.home_score} · ${g.result.status}`:g.status}</span></article>`).join("")||"<p>Schedule coming soon.</p>"}</div></section>
  <section id="public-standings"><h2>Pool Standings</h2>${data.pools.map((p)=>`<article class="presentation-panel public-filterable" data-division="${p.division_id}" data-teams="${(data.standings[p.id]||[]).map((x)=>x.team_id).join(' ')}"><h3>${tournamentEscape(division.get(p.division_id)||'')} · ${tournamentEscape(p.name)}</h3>${renderTournamentStandingsTable(data.standings[p.id]||[])}</article>`).join("")||"<p>Standings coming soon.</p>"}</section>
  <section id="public-brackets"><h2>Elimination Brackets</h2>${data.brackets.map((b)=>`<article class="presentation-panel tournament-bracket public-filterable" data-division="${b.division_id}" data-teams="${b.rounds.flatMap((r)=>r.games.flatMap((g)=>[g.home_team_id,g.away_team_id])).filter(Boolean).join(' ')}"><h3>${tournamentEscape(b.name)}</h3><p>${b.champion_team_id?`Champion: ${tournamentEscape(team.get(b.champion_team_id)||'TBD')}`:tournamentEscape(b.status)}</p><div class="tournament-bracket-grid">${b.rounds.map((r)=>`<section><h4>${tournamentEscape(r.name)}</h4>${r.games.map((g)=>`<article><strong>${tournamentEscape(team.get(g.home_team_id)||'TBD')} vs ${tournamentEscape(team.get(g.away_team_id)||'TBD')}</strong><span>${g.winner_team_id?`Winner: ${tournamentEscape(team.get(g.winner_team_id)||'TBD')}`:'Pending'}</span></article>`).join("")}</section>`).join("")}</div></article>`).join("")||"<p>Bracket coming soon.</p>"}</section></main>`;
  return true;
}
function filterPublicTournament(){const division=document.getElementById("public-division-filter")?.value||"",team=document.getElementById("public-team-filter")?.value||"";for(const item of document.querySelectorAll(".public-filterable")){const divisionMatch=!division||item.dataset.division===division,teamMatch=!team||String(item.dataset.teams||"").split(" ").includes(team);item.hidden=!(divisionMatch&&teamMatch);}}
