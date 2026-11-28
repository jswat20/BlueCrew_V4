const leagueScheduleGeneratorService = (() => {
  let proposals = [];
  let current = null;
  let currentGames = [];
  const clean = value => String(value ?? "").trim();
  const minutes = value => {
    const match = clean(value).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
  };
  const timeText = value => `${String(Math.floor(value / 60)).padStart(2,"0")}:${String(value % 60).padStart(2,"0")}`;
  const dateText = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const addDays = (value, days) => { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate()+days); return dateText(date); };
  const timezoneOffset = (instant, timezone) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(instant).filter(part=>part.type!=="literal").map(part=>[part.type,Number(part.value)]));
    return Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second)-instant.getTime();
  };
  const zonedDate = (date, time, timezone) => {
    const [year,month,day]=date.split("-").map(Number), [hour,minute]=time.split(":").map(Number);
    const guess=Date.UTC(year,month-1,day,hour,minute); let result=new Date(guess-timezoneOffset(new Date(guess),timezone));
    result=new Date(guess-timezoneOffset(result,timezone));
    return result;
  };
  const overlap = (aStart,aEnd,bStart,bEnd) => aStart < bEnd && bStart < aEnd;
  const errorMessage = error => ({
    league_field_conflict: "A field changed after this proposal was generated. Nothing was published; regenerate or adjust the affected game.",
    reservation_conflict: "A field changed after this proposal was generated. Nothing was published; regenerate or adjust the affected game.",
    league_team_conflict: "A team has gained an overlapping League game since this proposal was generated. Nothing was published; regenerate or adjust the affected game.",
    league_schedule_forbidden: "Administrator access is required.", league_module_not_enabled: "League Scheduling is not enabled.",
    proposal_not_found: "The proposal is no longer available.", proposal_game_not_editable: "Published proposals cannot be edited."
  })[clean(error?.message)] || clean(error?.message) || "The schedule operation could not be completed.";

  function pairings(teamIds, mode, target) {
    const teams = [...teamIds];
    if (teams.length % 2) teams.push(null);
    const rounds = [];
    const rotating = [...teams];
    for (let round=0; round<teams.length-1; round++) {
      const games=[];
      for (let i=0;i<teams.length/2;i++) {
        const left=rotating[i], right=rotating[teams.length-1-i];
        if (left && right) games.push(round%2 ? [right,left] : [left,right]);
      }
      rounds.push(games);
      rotating.splice(1,0,rotating.pop());
    }
    if (mode === "round_robin") return rounds.flat();
    const counts = Object.fromEntries(teamIds.map(id=>[id,0]));
    const result=[]; let cycle=0;
    while (Object.values(counts).some(value=>value<target) && cycle<target*4) {
      for (const [away0,home0] of rounds.flat()) {
        if (counts[away0] >= target || counts[home0] >= target) continue;
        const swap = cycle%2===1;
        const away=swap?home0:away0, home=swap?away0:home0;
        result.push([away,home]); counts[away]++; counts[home]++;
      }
      cycle++;
    }
    return result;
  }

  function fieldAccepts(field, config, state, date, start, end) {
    const rule = state.availability.find(item => item.field_id===field.id && Number(item.day_of_week)===new Date(`${date}T12:00:00`).getDay()
      && (!item.effective_from || item.effective_from<=date) && (!item.effective_until || item.effective_until>=date)
      && minutes(item.starts_at_local)<=start && minutes(item.ends_at_local)>=end);
    if (!rule) return false;
    const timezone=state.facilities.find(item=>item.id===field.location_id)?.timezone||"America/New_York";
    const candidateStart=zonedDate(date,timeText(start),timezone), candidateEnd=zonedDate(date,timeText(end),timezone);
    if (state.closures.some(item=>item.field_id===field.id && overlap(candidateStart,candidateEnd,new Date(item.starts_at),new Date(item.ends_at)))) return false;
    if (state.reservations.some(item=>item.field_id===field.id && item.status==="active" && overlap(candidateStart,candidateEnd,new Date(item.starts_at),new Date(item.ends_at)))) return false;
    return true;
  }

  function generate(config) {
    const catalog=leagueStructureService.snapshot(); const facilities=facilityService.snapshot();
    const teamIds=config.teamIds.filter(id=>catalog.teams.some(team=>team.id===id && team.division_id===config.divisionId));
    const fields=facilities.fields.filter(field=>config.fieldIds.includes(field.id) && field.active && field.status!=="closed");
    if (teamIds.length<2) return {success:false,message:"Choose at least two teams."};
    if (!fields.length) return {success:false,message:"Choose at least one available field."};
    const start=minutes(config.windowStart), end=minutes(config.windowEnd), block=Number(config.durationMinutes)+Number(config.bufferMinutes||0);
    if (!Number.isFinite(start)||!Number.isFinite(end)||end-start<Number(config.durationMinutes)) return {success:false,message:"Enter a valid playing window."};
    const matches=pairings(teamIds,config.format,Number(config.gamesPerTeam||1));
    const occupiedTeams=[]; const occupiedFields=[]; const games=[];
    const slots=[];
    for(let date=config.startDate;date<=config.endDate;date=addDays(date,1)) {
      if(!config.weekdays.includes(new Date(`${date}T12:00:00`).getDay()) || config.blackoutDates.includes(date)) continue;
      for(let at=start;at+Number(config.durationMinutes)<=end;at+=block) for(const field of fields) {
        if(fieldAccepts(field,config,facilities,date,at,at+block)) slots.push({date,time:timeText(at),at,field,locationId:field.location_id});
      }
    }
    const existingTeamConflict=(candidate,away,home)=>gameService.getAll().some(game=>game.gameDomain==="league"&&game.date===candidate.date
      && [game.homeTeamId,game.awayTeamId].some(id=>id===away||id===home)
      && overlap(candidate.at,candidate.at+Number(config.durationMinutes),minutes(game.time),minutes(game.time)+Number(game.durationMinutes||90)));
    for(const [away,home] of matches) {
      const slot=slots.find(candidate=>!occupiedFields.some(item=>item.fieldId===candidate.field.id&&item.date===candidate.date&&item.time===candidate.time)
        && !occupiedTeams.some(item=>item.date===candidate.date&&item.time===candidate.time&&(item.teamId===away||item.teamId===home))
        && !existingTeamConflict(candidate,away,home));
      if(!slot) games.push({home_team_id:home,away_team_id:away,duration_minutes:Number(config.durationMinutes),state:"unscheduled",issue:"No compatible field/time slot remained.",notes:"Generated proposal"});
      else {
        games.push({home_team_id:home,away_team_id:away,game_date:slot.date,game_time:slot.time,duration_minutes:Number(config.durationMinutes),location_id:slot.locationId,field_id:slot.field.id,state:"scheduled",issue:"",notes:"Generated proposal"});
        occupiedFields.push({fieldId:slot.field.id,date:slot.date,time:slot.time});
        occupiedTeams.push({teamId:away,date:slot.date,time:slot.time},{teamId:home,date:slot.date,time:slot.time});
      }
    }
    const scheduled=games.filter(game=>game.state==="scheduled").length;
    return {success:true,data:{...config,games,summary:{requested:games.length,scheduled,unscheduled:games.length-scheduled}}};
  }

  async function save(config) {
    try {
      const generated=generate(config); if(!generated.success) return generated;
      const payload={name:config.name,sport:config.sport,season_id:config.seasonId,league_id:config.leagueId,division_id:config.divisionId,
        team_ids:config.teamIds,field_ids:config.fieldIds,start_date:config.startDate,end_date:config.endDate,weekdays:config.weekdays,
        window_start:config.windowStart,window_end:config.windowEnd,duration_minutes:Number(config.durationMinutes),buffer_minutes:Number(config.bufferMinutes||0),
        format:config.format,games_per_team:Number(config.gamesPerTeam||1),blackout_dates:config.blackoutDates,summary:generated.data.summary,games:generated.data.games};
      const {data,error}=await supabaseSharedRepository.saveLeagueScheduleProposal(payload); if(error) throw error;
      await load(); await select(data.id);
      return {success:true,message:`Proposal generated: ${generated.data.summary.scheduled} scheduled, ${generated.data.summary.unscheduled} unscheduled.`,data:current};
    } catch(error){if(typeof operationalMonitoringService!=="undefined")void operationalMonitoringService.captureFailure("league","league.proposal_generate",error,{workflow:"schedule_generation"});return {success:false,message:errorMessage(error)};}
  }
  async function load(){const {data,error}=await supabaseSharedRepository.getLeagueScheduleProposals();if(error)return{success:false,message:errorMessage(error)};proposals=data||[];return{success:true,data:structuredClone(proposals)};}
  async function select(id){current=proposals.find(item=>item.id===id)||null;if(!current){currentGames=[];return{success:false,message:"Proposal not found."};}const{data,error}=await supabaseSharedRepository.getLeagueScheduleProposalGames(id);if(error)return{success:false,message:errorMessage(error)};currentGames=data||[];return{success:true,data:snapshot()};}
  async function updateGame(values){try{const{error}=await supabaseSharedRepository.updateLeagueScheduleProposalGame(values);if(error)throw error;await select(current.id);return{success:true,message:"Proposed game updated.",data:snapshot()};}catch(error){if(typeof operationalMonitoringService!=="undefined")void operationalMonitoringService.captureFailure("league","league.proposal_update",error,{workflow:"schedule_generation"});return{success:false,message:errorMessage(error)};}}
  async function publish(){try{const{data,error}=await supabaseSharedRepository.publishLeagueScheduleProposal(current.id);if(error)throw error;await load();await select(current.id);await supabaseAuthService.refreshScheduling();return{success:true,message:data.idempotent?"Proposal was already published; no duplicate games were created.":`Published ${data.game_ids.length} League games atomically.`,data};}catch(error){if(typeof operationalMonitoringService!=="undefined")void operationalMonitoringService.captureFailure("league","league.proposal_publish",error,{workflow:"schedule_publication"});return{success:false,message:errorMessage(error)};}}
  const snapshot=()=>({proposals:structuredClone(proposals),proposal:current?structuredClone(current):null,games:structuredClone(currentGames)});
  const clear=()=>{proposals=[];current=null;currentGames=[];};
  return {generate,save,load,select,updateGame,publish,snapshot,clear};
})();
