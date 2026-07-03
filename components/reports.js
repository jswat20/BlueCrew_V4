function renderReports() {
  const totalGames = games.length;
  const assignedGames = games.filter(game => game.status === "Assigned").length;
  const unassignedGames = games.filter(game => game.status === "Unassigned").length;

  return `
    <div class="card-grid">
      <div class="card stat-card">
        <h3>Total Games</h3>
        <div class="stat-number">${totalGames}</div>
        <p class="placeholder">All scheduled games.</p>
      </div>

      <div class="card stat-card">
        <h3>Assigned</h3>
        <div class="stat-number">${assignedGames}</div>
        <p class="placeholder">Covered games.</p>
      </div>

      <div class="card stat-card">
        <h3>Needs Coverage</h3>
        <div class="stat-number warning">${unassignedGames}</div>
        <p class="placeholder">Games needing umpires.</p>
      </div>
    </div>
  `;
}