// ============================================================
// LIVE GAME TRACKER
// ============================================================
async function renderLive() {
  const content = document.getElementById('content');
  document.getElementById('topbar-actions').innerHTML = '';
  
  // Find live match or most recent scheduled
  if (!state.liveMatch) {
    const matches = await txGetAll('matches');
    const live = matches.find(m=>m.status==='live');
    if (live) state.liveMatch = live;
  }
  
  if (!state.liveMatch) {
    const scheduled = (await txGetAll('matches','status','scheduled')).sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
    content.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🔴</div>
      <div class="empty-state-title">No active game</div>
      <div style="color:var(--text-muted)">Start a match from the Matches page, or schedule one first.</div>
      <button class="btn btn-primary" style="margin-top:16px" onclick="navigate('matches')">Go to Matches</button>
      ${scheduled.length?`<div style="margin-top:16px;font-size:13px;color:var(--text-secondary)">Upcoming: ${scheduled.map(m=>`<button class="btn btn-secondary btn-sm" style="margin:2px" onclick="startLiveMatch('${m.id}')">${m.opponent} ${m.date?.split('T')[0]||''}</button>`).join('')}</div>`:''}
    </div>`;
    return;
  }
  
  const match = state.liveMatch;
  const [players, events] = await Promise.all([
    txGetAll('players','status','active'),
    txGetAll('game_events','match_id',match.id)
  ]);
  
  // Load roster for this match
  const roster = await txGetAll('match_rosters','match_id',match.id);
  const rosterPlayerIds = roster.length ? roster.map(r=>r.player_id) : players.map(p=>p.id);
  const rosterPlayers = players.filter(p=>rosterPlayerIds.includes(p.id));
  
  // Derive live scores from events
  const validEvents = events.filter(e=>!e.voided);
  let homeScore = 0, awayScore = 0;
  for (const e of validEvents) {
    if (e.team==='home') {
      if (e.type==='2PM') homeScore+=2;
      else if (e.type==='3PM') homeScore+=3;
      else if (e.type==='FTM') homeScore+=1;
    } else if (e.team==='away') {
      if (e.type==='2PM') awayScore+=2;
      else if (e.type==='3PM') awayScore+=3;
      else if (e.type==='FTM') awayScore+=1;
    }
  }
  
  const period = match.current_period||1;
  const recentEvents = [...validEvents].reverse().slice(0,15);
  
  // Foul counts
  const homeFouls = validEvents.filter(e=>e.team==='home'&&e.type==='PF').length;
  const awayFouls = validEvents.filter(e=>e.team==='away'&&e.type==='PF').length;
  
  window._liveState = { match, players: rosterPlayers, selectedPlayer: null, period, homeScore, awayScore };
  
  const eventTypes = [
    {type:'2PM',label:'2PT Made',cls:'made'},{type:'2PA',label:'2PT Miss',cls:'missed'},
    {type:'3PM',label:'3PT Made',cls:'made'},{type:'3PA',label:'3PT Miss',cls:'missed'},
    {type:'FTM',label:'FT Made',cls:'made'},{type:'FTA',label:'FT Miss',cls:'missed'},
    {type:'ORB',label:'Off Reb',cls:''},{type:'DRB',label:'Def Reb',cls:''},
    {type:'AST',label:'Assist',cls:''},{type:'STL',label:'Steal',cls:''},
    {type:'BLK',label:'Block',cls:''},{type:'TOV',label:'Turnover',cls:''},
    {type:'PF',label:'Foul',cls:'missed'},
  ];
  
  const teamName = await getSetting('team_name','My Team');
  
  content.innerHTML = `
  <!-- Score header -->
  <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;margin-bottom:16px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px">
    <div style="text-align:center">
      <div style="font-size:12px;font-weight:600;color:var(--accent-primary);text-transform:uppercase;margin-bottom:4px">${teamName}</div>
      <div class="score-display" style="color:var(--text-primary)" id="live-home-score">${homeScore}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Fouls: ${homeFouls}</div>
    </div>
    <div style="text-align:center">
      <div class="quarter-badge" id="live-period">Q${period}</div>
      <div style="font-size:22px;color:var(--text-secondary);margin:6px 0">vs</div>
      ${match.status==='live'?`<div style="display:flex;gap:6px;justify-content:center">
        <button class="btn btn-secondary btn-sm" onclick="advancePeriod()">Next Q</button>
        <button class="btn btn-danger btn-sm" onclick="endGame()">End Game</button>
      </div>`:'<span class="badge badge-gray">Completed</span>'}
    </div>
    <div style="text-align:center">
      <div style="font-size:12px;font-weight:600;color:var(--accent-danger);text-transform:uppercase;margin-bottom:4px">${match.opponent}</div>
      <div class="score-display" style="color:var(--text-primary)" id="live-away-score">${awayScore}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Fouls: ${awayFouls}</div>
    </div>
  </div>
  
  <div class="grid-2" style="gap:16px">
    <!-- Left: Player selection + events -->
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="card">
        <div class="card-header"><span class="card-title">Select Player</span>
          <button class="btn btn-secondary btn-sm" onclick="showRosterModal()">Edit Roster</button></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px" id="player-buttons">
          ${rosterPlayers.map(p=>`
            <button class="player-btn" id="pbtn-${p.id}" onclick="selectPlayer('${p.id}')">
              <div class="jersey">${p.number??'?'}</div>
              <div class="name">${p.name.split(' ').pop()}</div>
            </button>
          `).join('')}
          ${!rosterPlayers.length?'<div class="text-muted" style="font-size:12px;padding:8px">No players in roster. Click Edit Roster.</div>':''}
        </div>
        <div id="selected-player-display" style="margin-top:8px;min-height:24px;font-size:13px;color:var(--text-secondary)">
          <span class="text-muted">Tap a player, then record an event below</span>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header"><span class="card-title">Record Event — Home Team</span>
          <select class="form-select" id="event-team-select" onchange="updateEventTeam()" style="width:120px;font-size:12px;padding:4px 8px">
            <option value="home">🏠 ${teamName}</option>
            <option value="away">⚡ ${match.opponent}</option>
          </select>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
          ${eventTypes.map(et=>`
            <button class="event-btn ${et.cls}" onclick="recordEvent('${et.type}')">${et.label}</button>
          `).join('')}
        </div>
        <div style="margin-top:8px;display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="undoLastEvent()">↩ Undo Last</button>
          <button class="btn btn-secondary btn-sm" onclick="showSubstitution()">🔄 Substitution</button>
        </div>
      </div>
    </div>
    
    <!-- Right: Event log -->
    <div class="card" style="display:flex;flex-direction:column">
      <div class="card-header"><span class="card-title">Event Log (${validEvents.length})</span>
        <button class="btn btn-secondary btn-sm" onclick="openBoxScore('${state.liveMatch?.id}')">View Box Score</button></div>
      <div class="event-log" id="event-log">
        ${recentEvents.length ? recentEvents.map(e=>renderEventRow(e, players)).join('') 
          : '<div class="text-muted" style="font-size:12px;text-align:center;padding:20px">No events yet</div>'}
      </div>
    </div>
  </div>`;
}

function renderEventRow(e, players) {
  const player = players.find(p=>p.id===e.player_id);
  const colors = {
    '2PM':'#34d399','3PM':'#34d399','FTM':'#34d399',
    '2PA':'#f87171','3PA':'#f87171','FTA':'#f87171',
    'TOV':'#f87171','PF':'#fbbf24','ORB':'#60a5fa','DRB':'#60a5fa',
    'AST':'#a78bfa','STL':'#a78bfa','BLK':'#a78bfa',
  };
  const color = colors[e.type]||'var(--text-muted)';
  return `<div class="event-row">
    <div class="event-time">Q${e.period}</div>
    <div style="color:${color};font-weight:600;font-size:12px;width:36px;flex-shrink:0">${e.type}</div>
    <div class="event-type">${player?player.name:'—'} <span style="font-size:10px;color:var(--text-muted)">[${e.team}]</span></div>
    ${e.voided?'<span class="badge badge-red" style="font-size:9px">void</span>':''}
    <button onclick="voidEvent('${e.id}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;padding:2px 4px" title="Void this event">✕</button>
  </div>`;
}

function selectPlayer(id) {
  window._liveState.selectedPlayer = id;
  document.querySelectorAll('.player-btn').forEach(b=>b.classList.remove('selected'));
  const btn = document.getElementById(`pbtn-${id}`);
  if (btn) btn.classList.add('selected');
  const player = window._liveState.players.find(p=>p.id===id);
  const display = document.getElementById('selected-player-display');
  if (display && player) display.innerHTML = `Selected: <strong style="color:var(--accent-primary)">#${player.number??'?'} ${player.name}</strong>`;
}

function updateEventTeam() {}

async function recordEvent(type) {
  const ls = window._liveState;
  if (!ls?.match) return;
  const playerId = ls.selectedPlayer;
  const needsPlayer = !['timeout_home','timeout_away','period_start','period_end'].includes(type);
  if (needsPlayer && !playerId) { toast('Select a player first', 'warning'); return; }
  const teamSel = document.getElementById('event-team-select');
  const team = teamSel?.value||'home';
  
  const ev = {
    id: uuid(),
    match_id: ls.match.id,
    period: ls.period,
    player_id: playerId||null,
    team,
    type,
    voided: false,
    created_at: now(),
  };
  await txPut('game_events', ev);
  window._lastEventId = ev.id;
  
  // Update live score display
  if (team==='home') {
    if (type==='2PM') ls.homeScore+=2;
    else if (type==='3PM') ls.homeScore+=3;
    else if (type==='FTM') ls.homeScore+=1;
  } else {
    if (type==='2PM') ls.awayScore+=2;
    else if (type==='3PM') ls.awayScore+=3;
    else if (type==='FTM') ls.awayScore+=1;
  }
  document.getElementById('live-home-score').textContent = ls.homeScore;
  document.getElementById('live-away-score').textContent = ls.awayScore;
  
  // Add to log
  const logEl = document.getElementById('event-log');
  if (logEl) {
    const player = ls.players.find(p=>p.id===playerId);
    logEl.insertAdjacentHTML('afterbegin', renderEventRow(ev, ls.players));
    if (logEl.children.length > 15) logEl.lastChild?.remove();
  }
  
  toast(`${type} recorded`, 'success');
  await audit('game_event', ev.id, 'create', { type, team, player_id: playerId });
}

async function voidEvent(eventId) {
  if (!confirm('Void this event? This will remove it from statistics.')) return;
  const ev = await txGet('game_events', eventId);
  if (!ev) return;
  ev.voided = true;
  ev.voided_at = now();
  await txPut('game_events', ev);
  await audit('game_event', eventId, 'void', {});
  toast('Event voided', 'success');
  await renderLive();
}

async function undoLastEvent() {
  if (!window._lastEventId) { toast('No recent event to undo', 'warning'); return; }
  const ev = await txGet('game_events', window._lastEventId);
  if (!ev || ev.voided) { toast('Event already voided or not found', 'warning'); return; }
  ev.voided = true; ev.voided_at = now();
  await txPut('game_events', ev);
  window._lastEventId = null;
  toast('Last event undone', 'success');
  await renderLive();
}

async function advancePeriod() {
  if (!state.liveMatch) return;
  const maxQ = 4;
  if (state.liveMatch.current_period >= maxQ) { toast('Final quarter — use End Game to finish', 'warning'); return; }
  state.liveMatch.current_period = (state.liveMatch.current_period||1)+1;
  await txPut('matches', state.liveMatch);
  window._liveState.period = state.liveMatch.current_period;
  document.getElementById('live-period').textContent = `Q${state.liveMatch.current_period}`;
  toast(`Quarter ${state.liveMatch.current_period} started`, 'success');
}

async function endGame() {
  if (!confirm('End the game? This will mark it as completed and calculate final scores.')) return;
  const match = state.liveMatch;
  const events = (await txGetAll('game_events','match_id',match.id)).filter(e=>!e.voided);
  let homeScore=0, awayScore=0;
  for (const e of events) {
    if (e.team==='home') { if(e.type==='2PM')homeScore+=2; else if(e.type==='3PM')homeScore+=3; else if(e.type==='FTM')homeScore+=1; }
    else { if(e.type==='2PM')awayScore+=2; else if(e.type==='3PM')awayScore+=3; else if(e.type==='FTM')awayScore+=1; }
  }
  match.status = 'completed';
  match.home_score = homeScore;
  match.away_score = awayScore;
  match.updated_at = now();
  await txPut('matches', match);
  await audit('match', match.id, 'complete', { home_score: homeScore, away_score: awayScore });
  await createAutoBackup('post_game');
  state.liveMatch = null;
  toast(`Game ended: ${homeScore}–${awayScore}`, 'success');
  await openBoxScore(match.id);
}

async function showRosterModal() {
  if (!state.liveMatch) return;
  const [players, roster] = await Promise.all([txGetAll('players','status','active'), txGetAll('match_rosters','match_id',state.liveMatch.id)]);
  const rosterIds = roster.map(r=>r.player_id);
  showModal('Edit Roster', `
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Select players for this match:</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      ${players.map(p=>`
        <label style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg-elevated);border-radius:6px;cursor:pointer">
          <input type="checkbox" value="${p.id}" ${rosterIds.includes(p.id)?'checked':''}>
          <span>#${p.number??'?'} ${p.name}</span>
        </label>
      `).join('')}
    </div>
  `, async () => {
    const checked = [...document.querySelectorAll('#modal-body input[type=checkbox]:checked')].map(c=>c.value);
    // Remove old roster entries
    for (const r of roster) await txDelete('match_rosters', r.id);
    // Add new
    for (const pid of checked) {
      await txPut('match_rosters', { id: uuid(), match_id: state.liveMatch.id, player_id: pid, created_at: now() });
    }
    toast('Roster updated', 'success');
    closeModal();
    await renderLive();
  });
}

async function showSubstitution() {
  toast('Sub: select a player on court and click their name to sub out, then select a replacement', 'info');
}
