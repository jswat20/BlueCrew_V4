const tournamentManagementService = (() => {
  let state = {
      tournaments: [],
      divisions: [],
      teams: [],
      pools: [],
      memberships: [],
      proposals: [],
      games: [], rules: [], results: [], tiebreaks: [], brackets: [], bracketRounds: [], bracketGames: [], publications: [],
    },
    currentTournamentId = null,
    currentProposalId = null,
    proposalGames = [], standings = {};
  const clean = (value) => String(value ?? "").trim();
  const mins = (value) => {
    const m = clean(value).match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  };
  const time = (value) =>
    `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const dateText = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDay = (value) => {
    const d = new Date(`${value}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return dateText(d);
  };
  const overlap = (a, b, c, d) => a < d && c < b;
  const offset = (instant, zone) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(instant)
        .filter((x) => x.type !== "literal")
        .map((x) => [x.type, Number(x.value)]),
    );
    return (
      Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
      instant.getTime()
    );
  };
  const zoned = (date, clock, zone) => {
    const [y, m, d] = date.split("-").map(Number),
      [h, n] = clock.split(":").map(Number),
      guess = Date.UTC(y, m - 1, d, h, n);
    let result = new Date(guess - offset(new Date(guess), zone));
    return new Date(guess - offset(result, zone));
  };
  const message = (error) =>
    ({
      tournament_module_not_enabled: "Tournament Management is not enabled.",
      tournament_management_forbidden:
        "Tournament administrator access is required.",
      tournament_team_duplicate:
        "That team is already registered in this division.",
      tournament_field_conflict:
        "A field changed after generation. Nothing was published.",
      tournament_team_conflict:
        "A team gained an overlapping game. Nothing was published.",
      field_unavailable: "The selected field is unavailable.",
      proposal_not_found: "The proposal no longer exists.",
      tournament_score_invalid: "Scores must be whole numbers of zero or greater.",
      tournament_final_score_required: "A final result requires both scores.",
      elimination_winner_required: "A tied elimination game requires an explicit advancing winner.",
      tournament_pool_results_incomplete: "All pool games must be resolved before generating the bracket.",
      downstream_bracket_result_final: "This correction would overwrite a completed downstream game.",
      tournament_bracket_matchup_incomplete: "Both advancing teams must be known before scheduling this game.",
      tournament_field_conflict: "That field is no longer available. The original game and reservation were not changed.",
      tournament_final_game_locked: "A final or forfeited game cannot be rescheduled.",
    })[clean(error?.message)] ||
    clean(error?.message) ||
    "The tournament operation could not be completed.";
  async function load() {
    const { data, error } =
      await supabaseSharedRepository.getTournamentCatalog();
    if (error) return { success: false, message: message(error) };
    state = data;
    return { success: true, data: snapshot() };
  }
  async function mutate(operation) {
    try {
      const result = await operation();
      if (result.error) throw result.error;
      await load();
      return { success: true, data: result.data };
    } catch (error) {
      return { success: false, message: message(error) };
    }
  }
  const saveTournament = (payload) =>
    mutate(() => supabaseSharedRepository.saveTournament(payload));
  const transition = (id, status) =>
    mutate(() => supabaseSharedRepository.transitionTournament(id, status));
  const addDivision = (payload) =>
    mutate(() => supabaseSharedRepository.saveTournamentDivision(payload));
  const saveTeam = (payload) =>
    mutate(() => supabaseSharedRepository.saveTournamentTeam(payload));
  const withdrawTeam = (id) =>
    mutate(() => supabaseSharedRepository.withdrawTournamentTeam(id));
  const addPool = (payload) =>
    mutate(() => supabaseSharedRepository.saveTournamentPool(payload));
  const assignTeam = (teamId, poolId) =>
    mutate(() =>
      supabaseSharedRepository.assignTournamentTeamToPool(teamId, poolId),
    );
  function roundRobin(ids) {
    const teams = [...ids];
    if (teams.length % 2) teams.push(null);
    const rotating = [...teams],
      games = [];
    for (let r = 0; r < teams.length - 1; r++) {
      for (let i = 0; i < teams.length / 2; i++) {
        const a = rotating[i],
          b = rotating[teams.length - 1 - i];
        if (a && b) games.push(r % 2 ? [b, a] : [a, b]);
      }
      rotating.splice(1, 0, rotating.pop());
    }
    return games;
  }
  function accepts(field, facilities, date, start, end) {
    const rule = facilities.availability.find(
      (x) =>
        x.field_id === field.id &&
        Number(x.day_of_week) === new Date(`${date}T12:00:00`).getDay() &&
        (!x.effective_from || x.effective_from <= date) &&
        (!x.effective_until || x.effective_until >= date) &&
        mins(x.starts_at_local) <= start &&
        mins(x.ends_at_local) >= end,
    );
    if (!rule) return false;
    const zone =
        facilities.facilities.find((x) => x.id === field.location_id)
          ?.timezone || "America/New_York",
      a = zoned(date, time(start), zone),
      b = zoned(date, time(end), zone);
    return (
      !facilities.closures.some(
        (x) =>
          x.field_id === field.id &&
          overlap(a, b, new Date(x.starts_at), new Date(x.ends_at)),
      ) &&
      !facilities.reservations.some(
        (x) =>
          x.field_id === field.id &&
          x.status === "active" &&
          overlap(a, b, new Date(x.starts_at), new Date(x.ends_at)),
      )
    );
  }
  function generate(config) {
    const facilities = facilityService.snapshot(),
      tournament = state.tournaments.find((x) => x.id === config.tournamentId);
    if (!tournament) return { success: false, message: "Choose a tournament." };
    const fields = facilities.fields.filter(
      (x) =>
        config.fieldIds.includes(x.id) && x.active && x.status !== "closed",
    );
    if (!fields.length)
      return {
        success: false,
        message: "Choose at least one available field.",
      };
    const matchups = [];
    for (const pool of state.pools.filter(
      (x) => x.tournament_id === tournament.id,
    )) {
      const members = state.memberships
        .filter((x) => x.pool_id === pool.id)
        .map((x) => x.team_id);
      if (members.length < 2) continue;
      const division = state.divisions.find((x) => x.id === pool.division_id);
      for (const [away, home] of roundRobin(members))
        matchups.push({ pool, division, away, home });
    }
    if (!matchups.length)
      return {
        success: false,
        message: "Assign at least two active teams to a pool.",
      };
    const start = mins(config.windowStart),
      end = mins(config.windowEnd),
      buffer = Number(config.bufferMinutes || 0),
      slots = [];
    for (let day = config.startDate; day <= config.endDate; day = addDay(day)) {
      if (!config.weekdays.includes(new Date(`${day}T12:00:00`).getDay()))
        continue;
      for (const field of fields)
        for (let at = start; at < end;) {
          const duration = Math.max(
            ...state.divisions
              .filter((x) => x.tournament_id === tournament.id)
              .map((x) => x.game_duration_minutes),
            90,
          );
          if (
            at + duration <= end &&
            accepts(field, facilities, day, at, at + duration + buffer)
          )
            slots.push({ date: day, time: time(at), at, field });
          at += duration + buffer;
        }
    }
    const usedFields = [],
      usedTeams = [],
      games = [];
    for (const item of matchups) {
      const duration = item.division?.game_duration_minutes || 90;
      const slot = slots.find(
        (s) =>
          !usedFields.some(
            (x) =>
              x.fieldId === s.field.id &&
              x.date === s.date &&
              overlap(s.at, s.at + duration, x.start, x.end),
          ) &&
          !usedTeams.some(
            (x) =>
              (x.teamId === item.home || x.teamId === item.away) &&
              x.date === s.date &&
              overlap(s.at, s.at + duration, x.start, x.end),
          ),
      );
      if (!slot)
        games.push({
          tournament_id: tournament.id,
          division_id: item.pool.division_id,
          pool_id: item.pool.id,
          home_team_id: item.home,
          away_team_id: item.away,
          duration_minutes: duration,
          state: "unscheduled",
          issue: "No compatible field/time slot remained.",
        });
      else {
        games.push({
          tournament_id: tournament.id,
          division_id: item.pool.division_id,
          pool_id: item.pool.id,
          home_team_id: item.home,
          away_team_id: item.away,
          game_date: slot.date,
          game_time: slot.time,
          duration_minutes: duration,
          location_id: slot.field.location_id,
          field_id: slot.field.id,
          state: "scheduled",
          issue: "",
          notes: "Generated pool play",
        });
        usedFields.push({
          fieldId: slot.field.id,
          date: slot.date,
          start: slot.at,
          end: slot.at + duration,
        });
        usedTeams.push(
          {
            teamId: item.home,
            date: slot.date,
            start: slot.at,
            end: slot.at + duration,
          },
          {
            teamId: item.away,
            date: slot.date,
            start: slot.at,
            end: slot.at + duration,
          },
        );
      }
    }
    const scheduled = games.filter((x) => x.state === "scheduled").length;
    return {
      success: true,
      data: {
        games,
        summary: {
          requested: games.length,
          scheduled,
          unscheduled: games.length - scheduled,
        },
      },
    };
  }
  async function saveProposal(config) {
    try {
      const generated = generate(config);
      if (!generated.success) return generated;
      const payload = {
        name: config.name,
        tournament_id: config.tournamentId,
        field_ids: config.fieldIds,
        start_date: config.startDate,
        end_date: config.endDate,
        window_start: config.windowStart,
        window_end: config.windowEnd,
        weekdays: config.weekdays,
        buffer_minutes: config.bufferMinutes,
        summary: generated.data.summary,
        games: generated.data.games,
      };
      const { data, error } =
        await supabaseSharedRepository.saveTournamentProposal(payload);
      if (error) throw error;
      await load();
      await selectProposal(data.id);
      return {
        success: true,
        message: `Proposal generated: ${generated.data.summary.scheduled} scheduled, ${generated.data.summary.unscheduled} unscheduled.`,
      };
    } catch (error) {
      return { success: false, message: message(error) };
    }
  }
  async function selectProposal(id) {
    currentProposalId = id;
    const { data, error } =
      await supabaseSharedRepository.getTournamentProposalGames(id);
    if (error) return { success: false, message: message(error) };
    proposalGames = data || [];
    return { success: true, data: snapshot() };
  }
  async function updateProposalGame(values) {
    const result = await mutate(() =>
      supabaseSharedRepository.updateTournamentProposalGame(values),
    );
    if (result.success) await selectProposal(currentProposalId);
    return result;
  }
  async function publishProposal() {
    try {
      const { data, error } =
        await supabaseSharedRepository.publishTournamentProposal(
          currentProposalId,
        );
      if (error) throw error;
      await load();
      await selectProposal(currentProposalId);
      await supabaseAuthService.refreshScheduling();
      return {
        success: true,
        data,
        message: data.idempotent
          ? "Proposal was already published; no duplicate games were created."
          : `Published ${data.game_ids.length} Tournament games atomically.`,
      };
    } catch (error) {
      return { success: false, message: message(error) };
    }
  }
  const saveRules = (payload) => mutate(() => supabaseSharedRepository.saveTournamentScoringRules(payload));
  async function saveResult(values) {
    const result = await mutate(() => supabaseSharedRepository.saveTournamentGameResult(values));
    if (result.success) {
      const poolId = state.games.find((game) => game.id === values.gameId)?.tournament_pool_id;
      if (poolId) await loadStandings(poolId);
      await supabaseAuthService.refreshScheduling();
    }
    return result;
  }
  async function loadStandings(poolId) {
    const { data, error } = await supabaseSharedRepository.getTournamentPoolStandings(poolId);
    if (error) return { success:false, message:message(error) };
    standings[poolId] = data;
    return { success:true, data };
  }
  async function loadTournamentStandings(tournamentId) {
    const targets = state.pools.filter((pool) => pool.tournament_id === tournamentId);
    const responses = await Promise.all(targets.map((pool) => loadStandings(pool.id)));
    return responses.find((item) => !item.success) || { success:true, data:standings };
  }
  const saveManualTiebreak = (values) => mutate(() => supabaseSharedRepository.saveTournamentManualTiebreak(values));
  async function generateBracket(values) {
    const result = await mutate(() => supabaseSharedRepository.generateTournamentBracket(values));
    if (result.success && result.data?.id) {
      const advanced = await mutate(() => supabaseSharedRepository.advanceTournamentByes(result.data.id));
      if (!advanced.success) return advanced;
    }
    return result;
  }
  const scheduleBracketGame = (values) => mutate(() => supabaseSharedRepository.scheduleTournamentBracketGame(values));
  const setPublication = (published) => mutate(() => supabaseSharedRepository.setTournamentPublication(currentTournamentId,published));
  const rescheduleGame = (values) => mutate(() => supabaseSharedRepository.rescheduleTournamentGame(values));
  const transitionGame = (gameId,action) => mutate(() => supabaseSharedRepository.transitionTournamentGame(gameId,action));
  const selectTournament = (id) => {
    currentTournamentId = id;
  };
  const snapshot = () => ({
    ...structuredClone(state),
    currentTournamentId,
    currentProposalId,
    proposalGames: structuredClone(proposalGames),
    standings: structuredClone(standings),
  });
  const clear = () => {
    state = {
      tournaments: [],
      divisions: [],
      teams: [],
      pools: [],
      memberships: [],
      proposals: [],
      games: [], rules: [], results: [], tiebreaks: [], brackets: [], bracketRounds: [], bracketGames: [], publications: [],
    };
    currentTournamentId = null;
    currentProposalId = null;
    proposalGames = [];
    standings = {};
  };
  return {
    load,
    saveTournament,
    transition,
    addDivision,
    saveTeam,
    withdrawTeam,
    addPool,
    assignTeam,
    generate,
    saveProposal,
    selectProposal,
    updateProposalGame,
    publishProposal,
    saveRules,
    saveResult,
    loadStandings,
    loadTournamentStandings,
    saveManualTiebreak,
    generateBracket,
    scheduleBracketGame,
    setPublication,
    rescheduleGame,
    transitionGame,
    selectTournament,
    snapshot,
    clear,
  };
})();
