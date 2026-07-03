function renderAdmin() {

    return `

    <div class="card-grid">

        <div class="card">

            <h3>Developer Tools</h3>

            <p class="placeholder">
                These tools are only available during development.
            </p>

            <button
                class="primary-btn"
                onclick="resetGames()">
                <button class="primary-btn" onclick="resetGames()">Reset Games</button>
<button class="primary-btn" onclick="resetCrew()">Reset Crew</button>
<button class="danger-btn" onclick="resetAllData()">Reset All Data</button>

                Reset Demo Data

            </button>

        </div>

    </div>

    `;
}