// ============================================================
// MATCHES
// ============================================================
async function renderMatches() {
  const content = document.getElementById('content');
  document.getElementById('topbar-actions').innerHTML = `<button class="btn btn-primary" onclick="showNewMatchModal()">+ New Match</button>`;
  const [matches, seasons] = await Promise.all([txGetAll('matches'), txGetAll('seasons')]);
  matches.sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
  const seasonMap = Object.fromEntries(seasons.map(s => [s.id, s.name]));

  // Collect unique competition/tournament values
  const competitions = [...new Set(matches.map(m => m.competition).filter(Boolean))].sort();

  content.innerHTML = `
  <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
    <input class="input-search" id="match-search" placeholder="Search opponent / competition…" oninput="filterMatches()" style="width:220px">
    <select class="form-select" id="match-status-filter" onchange="filterMatches()" style="width:130px">
      <option value="all">All Statuses</option>
      <option value="scheduled">Scheduled</option>
      <option value="live">Live</option>
      <option value="completed">Completed</option>
    </select>
    <select class="form-select" id="match-season-filter" onchange="filterMatches()" style="width:150px">
      <option value="">All Seasons</option>
      ${seasons.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
    </select>
    <select class="form-select" id="match-comp-filter" onchange="filterMatches()" style="width:160px">
      <option value="">All Competitions</option>
      <option value="regular">Regular Season</option>
      <option value="friendly">Friendly</option>
      <option value="playoff">Playoff</option>
      <option value="tournament">Tournament</option>
      ${competitions.map(c => `<option value="__comp__${c}">${c}</option>`).join('')}
    </select>
    <select class="form-select" id="match-result-filter" onchange="filterMatches()" style="width:110px">
      <option value="">All Results</option>
      <option value="W">Wins only</option>
      <option value="L">Losses only</option>
    </select>
  </div>
  <div id="match-count-label" style="font-size:12px;color:var(--text-muted);margin-bottom:8px"></div>
  <div class="tbl-wrap" id="matches-table-wrap">
    ${renderMatchesTable(matches, seasonMap)}
  </div>`;
  window._allMatches  = matches;
  window._seasonMap   = seasonMap;
  updateMatchCountLabel(matches.length);
}

function updateMatchCountLabel(n) {
  const el = document.getElementById('match-count-label');
  if (el) el.textContent = `Menampilkan ${n} pertandingan`;
}

function renderMatchesTable(matches, seasonMap) {
  if (!matches.length) return `<div class="empty-state"><div class="empty-state-icon">🗒️</div><div class="empty-state-title">No matches found</div><div>Coba ubah filter atau tambah pertandingan baru.</div></div>`;

  const catBadge = { regular:'badge-blue', friendly:'badge-gray', playoff:'badge-yellow', tournament:'badge-yellow' };

  return `<table><thead><tr>
    <th>Date</th><th>Opponent</th><th>Competition</th><th>Category</th><th>Season</th><th>Score</th><th>Status</th><th>Actions</th>
  </tr></thead>
  <tbody>${matches.map(m => {
    const win  = m.home_score != null && m.away_score != null && m.home_score > m.away_score;
    const loss = m.home_score != null && m.away_score != null && m.home_score < m.away_score;
    return `<tr>
      <td style="white-space:nowrap">${m.date ? m.date.split('T')[0] : '—'}</td>
      <td style="font-weight:600">${m.opponent || '—'}</td>
      <td class="td-muted">${m.competition || '—'}</td>
      <td><span class="badge ${catBadge[m.category]||'badge-gray'}" style="font-size:10px">${m.category||'—'}</span></td>
      <td class="td-muted">${seasonMap[m.season_id] || '—'}</td>
      <td>
        <span style="font-weight:700;font-variant-numeric:tabular-nums">${m.home_score ?? '—'}–${m.away_score ?? '—'}</span>
        ${m.status === 'completed' ? `<span class="badge ${win?'badge-green':loss?'badge-red':'badge-gray'}" style="margin-left:4px">${win?'W':loss?'L':'D'}</span>` : ''}
      </td>
      <td><span class="badge ${m.status==='live'?'badge-red':m.status==='completed'?'badge-green':m.status==='scheduled'?'badge-blue':'badge-gray'}">${m.status}</span></td>
      <td>
        <div style="display:flex;gap:3px;flex-wrap:wrap">
          ${m.status === 'scheduled' ? `<button class="btn btn-sm" style="background:rgba(239,68,68,.15);color:#f87171;border:1px solid rgba(239,68,68,.3)" onclick="startLiveMatch('${m.id}')">▶</button>` : ''}
          <button class="btn btn-sm" style="background:rgba(245,158,11,.15);color:#fbbf24;border:1px solid rgba(245,158,11,.3)" onclick="showManualStatsModal('${m.id}')" title="Input Stats">📝</button>
          ${m.status === 'completed' || m.status === 'live' ? `<button class="btn btn-secondary btn-sm" onclick="viewBoxScore('${m.id}')">Box</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="showNewMatchModal('${m.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteMatch('${m.id}','${(m.opponent||'').replace(/'/g,"\\'")}','${m.date?.split('T')[0]||''}')" title="Hapus pertandingan">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

async function filterMatches() {
  const search  = (document.getElementById('match-search')?.value || '').toLowerCase();
  const status  = document.getElementById('match-status-filter')?.value  || 'all';
  const seasonId= document.getElementById('match-season-filter')?.value  || '';
  const comp    = document.getElementById('match-comp-filter')?.value    || '';
  const result  = document.getElementById('match-result-filter')?.value  || '';

  let matches = window._allMatches || [];

  if (search)   matches = matches.filter(m =>
    (m.opponent || '').toLowerCase().includes(search) ||
    (m.competition || '').toLowerCase().includes(search));
  if (status !== 'all') matches = matches.filter(m => m.status === status);
  if (seasonId) matches = matches.filter(m => m.season_id === seasonId);
  if (comp) {
    if (comp.startsWith('__comp__')) {
      const compName = comp.slice(8);
      matches = matches.filter(m => m.competition === compName);
    } else {
      matches = matches.filter(m => m.category === comp);
    }
  }
  if (result === 'W') matches = matches.filter(m => m.home_score != null && m.home_score > m.away_score);
  if (result === 'L') matches = matches.filter(m => m.home_score != null && m.home_score < m.away_score);

  document.getElementById('matches-table-wrap').innerHTML = renderMatchesTable(matches, window._seasonMap || {});
  updateMatchCountLabel(matches.length);
}

async function deleteMatch(matchId, opponent, date) {
  if (!confirm(`Hapus pertandingan vs ${opponent} (${date||'?'})?\n\nSemua event, roster, dan statistik pertandingan ini akan ikut terhapus permanen.\n\nLanjut?`)) return;

  // Delete related records
  const [events, rosters] = await Promise.all([
    txGetAll('game_events', 'match_id', matchId),
    txGetAll('match_rosters', 'match_id', matchId),
  ]);
  for (const e of events)  await txDelete('game_events',    e.id);
  for (const r of rosters) await txDelete('match_rosters',  r.id);
  await txDelete('matches', matchId);
  await audit('match', matchId, 'delete', { opponent, date });

  toast(`Match vs ${opponent} dihapus`, 'success');

  // Remove from in-memory list and re-render
  window._allMatches = (window._allMatches || []).filter(m => m.id !== matchId);
  await filterMatches();
}

async function showNewMatchModal(id = null) {
  let m = id ? await txGet('matches', id) : null;
  const seasons = await txGetAll('seasons');
  const currentSeason = seasons.find(s=>s.is_current);
  showModal(`${id?'Edit':'Schedule'} Match`, `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Date & Time</label>
        <input class="form-input" id="m-date" type="datetime-local" value="${m?.date?.slice(0,16)||new Date().toISOString().slice(0,16)}"></div>
      <div class="form-group"><label class="form-label">Opponent *</label>
        <input class="form-input" id="m-opp" value="${m?.opponent||''}" placeholder="Opponent team name"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Competition</label>
        <input class="form-input" id="m-comp" value="${m?.competition||''}" placeholder="e.g. NBL, Friendly"></div>
      <div class="form-group"><label class="form-label">Season</label>
        <select class="form-select" id="m-season">
          <option value="">No season</option>
          ${seasons.map(s=>`<option value="${s.id}" ${(m?.season_id===s.id||(id==null&&currentSeason?.id===s.id))?'selected':''}>${s.name}</option>`).join('')}
        </select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Venue</label>
        <input class="form-input" id="m-venue" value="${m?.venue||''}" placeholder="Gym / arena name"></div>
      <div class="form-group"><label class="form-label">Category</label>
        <select class="form-select" id="m-cat">
          <option value="regular" ${m?.category==='regular'?'selected':''}>Regular Season</option>
          <option value="friendly" ${m?.category==='friendly'?'selected':''}>Friendly</option>
          <option value="playoff" ${m?.category==='playoff'?'selected':''}>Playoff</option>
          <option value="tournament" ${m?.category==='tournament'?'selected':''}>Tournament</option>
        </select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Quarter Duration (min)</label>
        <input class="form-input" id="m-qdur" type="number" value="${m?.quarter_duration||10}" min="5" max="15"></div>
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-select" id="m-status">
          <option value="scheduled" ${m?.status==='scheduled'||!m?'selected':''}>Scheduled</option>
          <option value="completed" ${m?.status==='completed'?'selected':''}>Completed</option>
        </select></div>
    </div>
    ${m?.status==='completed'||m?.status==='live'?`
    <div class="form-row">
      <div class="form-group"><label class="form-label">Home Score (Us)</label>
        <input class="form-input" id="m-hscore" type="number" value="${m?.home_score??''}"></div>
      <div class="form-group"><label class="form-label">Away Score (Opp)</label>
        <input class="form-input" id="m-ascore" type="number" value="${m?.away_score??''}"></div>
    </div>`:''}
    <div class="form-group"><label class="form-label">Notes</label>
      <textarea class="form-textarea" id="m-notes">${m?.notes||''}</textarea></div>
  `, async () => {
    const opponent = document.getElementById('m-opp').value.trim();
    if (!opponent) { toast('Opponent name required', 'error'); return false; }
    const teamName = await getSetting('team_name','My Team');
    const obj = {
      id: id||uuid(),
      date: document.getElementById('m-date').value||now(),
      home_team: teamName,
      opponent,
      competition: document.getElementById('m-comp').value||null,
      season_id: document.getElementById('m-season').value||null,
      venue: document.getElementById('m-venue').value||null,
      category: document.getElementById('m-cat').value||'regular',
      quarter_duration: parseInt(document.getElementById('m-qdur').value)||10,
      status: document.getElementById('m-status').value||'scheduled',
      home_score: parseInt(document.getElementById('m-hscore')?.value)??null,
      away_score: parseInt(document.getElementById('m-ascore')?.value)??null,
      notes: document.getElementById('m-notes').value||null,
      created_at: m?.created_at||now(),
      updated_at: now(),
    };
    if (isNaN(obj.home_score)) obj.home_score = null;
    if (isNaN(obj.away_score)) obj.away_score = null;
    await txPut('matches', obj);
    await audit('match', obj.id, id?'update':'create', { opponent });
    toast(`Match ${id?'updated':'scheduled'}`, 'success');
    closeModal();
    await renderMatches();
  });
}

async function startLiveMatch(matchId) {
  state.liveMatch = await txGet('matches', matchId);
  if (!state.liveMatch) return;
  state.liveMatch.status = 'live';
  state.liveMatch.current_period = state.liveMatch.current_period||1;
  await txPut('matches', state.liveMatch);
  await navigate('live');
}

async function openBoxScore(matchId) {
  state.selectedMatchId = matchId;
  state.bsView = 'detail';
  await navigate('boxscore');
}
async function viewBoxScore(matchId) { await openBoxScore(matchId); }

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

// ============================================================
// MANUAL STATS INPUT  (Home + Opponent tabs, with MIN column)
// ============================================================

// Kolom input mengikuti susunan FIBA:
// # | Player | MIN | PTS | 2PT M | 2PT A | 3PT M | 3PT A | FT A | FT M | ORB | DRB | REB | AST | TO | STL | BLK | PF
// PTS dan REB dihitung otomatis (tidak diinput).
const MS_COLS = [
  { key:'min', label:'MIN',   type:'min',  color:'var(--text-muted)' },
  { key:'pts', label:'PTS',   type:'calc', color:'var(--text-secondary)' },
  { key:'pm2', label:'2PT M', type:'in', color:'var(--accent-success)', max:99 },
  { key:'pa2', label:'2PT A', type:'in', color:'var(--text-muted)',     max:99 },
  { key:'pm3', label:'3PT M', type:'in', color:'var(--accent-success)', max:99 },
  { key:'pa3', label:'3PT A', type:'in', color:'var(--text-muted)',     max:99 },
  { key:'fta', label:'FT A',  type:'in', color:'var(--text-muted)',     max:99 },
  { key:'ftm', label:'FT M',  type:'in', color:'var(--accent-success)', max:99 },
  { key:'orb', label:'ORB',   type:'in', color:'var(--accent-primary)', max:50 },
  { key:'drb', label:'DRB',   type:'in', color:'var(--accent-primary)', max:50 },
  { key:'reb', label:'REB',   type:'calc', color:'var(--accent-primary)' },
  { key:'ast', label:'AST',   type:'in', color:'#a78bfa',               max:50 },
  { key:'tov', label:'TO',    type:'in', color:'var(--accent-danger)',  max:50 },
  { key:'stl', label:'STL',   type:'in', color:'#a78bfa',               max:50 },
  { key:'blk', label:'BLK',   type:'in', color:'#a78bfa',               max:50 },
  { key:'pf',  label:'PF',    type:'in', color:'var(--accent-warning)', max:10 },
];

// MIN: terima "23", "23.5" atau "23:30" -> menit (desimal). Kosong -> null
function parseMinutes(v) {
  v = String(v ?? '').trim();
  if (!v) return null;
  if (v.includes(':')) {
    const [m, s] = v.split(':');
    return (parseInt(m) || 0) + Math.min(59, parseInt(s) || 0) / 60;
  }
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? null : n;
}
function fmtMinutes(m) {
  if (m == null || m === '' || isNaN(Number(m))) return '';
  const t = Math.round(Number(m) * 60);
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}
function normalizeMinInput(el) {
  let m = parseMinutes(el.value);
  if (m != null && m > 48) m = 48;
  el.value = m == null ? '' : fmtMinutes(m);
}

const MS_INPUT_STYLE = 'text-align:center;background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;padding:3px 1px;color:var(--text-primary);font-size:12px;font-variant-numeric:tabular-nums';
const MS_OPP_STYLE   = 'text-align:center;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:4px;padding:3px 1px;color:var(--text-primary);font-size:12px;font-variant-numeric:tabular-nums';

function msTableHead() {
  const th = 'padding:5px 2px;text-align:center;font-size:10px;white-space:nowrap';
  return `<thead style="position:sticky;top:0;z-index:5">
    <tr style="background:var(--bg-elevated)">
      <th style="${th};color:var(--text-muted);min-width:44px">#</th>
      <th style="${th};color:var(--text-muted);text-align:left;padding-left:8px">Player</th>
      ${MS_COLS.map(c => `<th style="${th};color:${c.color}">${c.label}</th>`).join('')}
    </tr>
  </thead>`;
}

// Baris pemain (dipakai tabel awal dan tombol "+ Pemain Lain").
// s = stats pemain; hasData=false -> semua kolom dikosongkan
function msPlayerRowHtml(p, s, hasData, inRoster) {
  const val = k => (hasData && s && s[k] != null) ? s[k] : '';
  const cells = MS_COLS.map(c => {
    if (c.type === 'calc') {
      const color = c.key === 'pts' ? 'var(--accent-primary)' : 'var(--text-primary)';
      return `<td style="padding:2px 1px;text-align:center"><div style="font-weight:700;font-size:13px;color:${color};min-width:30px" id="ms-${c.key}-${p.id}"></div></td>`;
    }
    if (c.type === 'min') {
      return `<td style="padding:2px 1px"><input type="text" inputmode="numeric" placeholder="mm:ss" value="${hasData ? fmtMinutes(s?.min) : ''}"
        class="ms-input" data-pid="${p.id}" data-field="min" id="ms-${p.id}-min"
        oninput="onManualInputChange('${p.id}')" onblur="normalizeMinInput(this)"
        style="width:54px;${MS_INPUT_STYLE}"></td>`;
    }
    return `<td style="padding:2px 1px"><input type="number" inputmode="numeric" min="0" max="${c.max}" value="${val(c.key)}"
      class="ms-input" data-pid="${p.id}" data-field="${c.key}" id="ms-${p.id}-${c.key}"
      oninput="onManualInputChange('${p.id}')" style="width:38px;${MS_INPUT_STYLE}"></td>`;
  }).join('');
  return `<tr data-pid="${p.id}">
    <td style="padding:3px 4px;text-align:center;white-space:nowrap">
      <label style="display:flex;align-items:center;justify-content:center;gap:5px;cursor:pointer" title="Centang = ikut bermain">
        <input type="checkbox" class="ms-play-check" data-pid="${p.id}" ${inRoster ? 'checked' : ''} onchange="toggleManualRow('${p.id}', this.checked)">
        <span style="font-weight:700;color:var(--accent-secondary);font-size:13px">${p.number ?? '?'}</span>
      </label>
    </td>
    <td style="padding:3px 8px;white-space:nowrap">
      <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${p.name}</div>
      <div style="font-size:10px;color:var(--text-muted)">${p.position || ''}</div>
    </td>
    ${cells}
  </tr>`;
}

async function showManualStatsModal(matchId) {
  const match = await txGet('matches', matchId);
  if (!match) { toast('Match not found', 'error'); return; }

  const players = await txGetAll('players');
  const activePlayers = players.filter(p => p.status === 'active');
  activePlayers.sort((a,b) => (a.number||999) - (b.number||999));

  // Load roster
  const roster = await txGetAll('match_rosters', 'match_id', matchId);
  const rosterIds = roster.length ? roster.map(r => r.player_id) : activePlayers.map(p => p.id);

  // Load existing events for pre-fill
  const existingEvents = await txGetAll('game_events', 'match_id', matchId);
  const valid = existingEvents.filter(e => !e.voided);

  // Pre-fill helpers — pull MIN from stored player_match_stats if present
  const pmStats = await txGetAll('player_match_stats', 'match_id', matchId);
  const pmMap = Object.fromEntries(pmStats.map(s => [s.player_id, s]));

  function prefill(pid, team='home') {
    const s = calcBoxScore(valid.filter(e => e.team===team), pid);
    s.min = pmMap[pid]?.minutes ?? null;
    return s;
  }
  // Pemain dianggap sudah punya data kalau ada event atau record statistik; selain itu kolom dikosongkan
  function playerHasData(pid) {
    return !!pmMap[pid] || valid.some(e => e.team === 'home' && e.player_id === pid);
  }

  function homePlayerRow(p) {
    return msPlayerRowHtml(p, prefill(p.id, 'home'), playerHasData(p.id), rosterIds.includes(p.id));
  }

  // ---- Opponent aggregate row (single row, no player breakdown) ----
  function oppRow() {
    const oppEvts = valid.filter(e => e.team === 'away');
    const c = {pm2:0,pa2:0,pm3:0,pa3:0,ftm:0,fta:0,orb:0,drb:0,ast:0,stl:0,blk:0,tov:0,pf:0};
    for (const e of oppEvts) {
      if (e.type==='2PM'){c.pm2++;c.pa2++;} else if (e.type==='2PA'){c.pa2++;}
      else if (e.type==='3PM'){c.pm3++;c.pa3++;} else if (e.type==='3PA'){c.pa3++;}
      else if (e.type==='FTM'){c.ftm++;c.fta++;} else if (e.type==='FTA'){c.fta++;}
      else if (e.type==='ORB')c.orb++; else if (e.type==='DRB')c.drb++;
      else if (e.type==='AST')c.ast++; else if (e.type==='STL')c.stl++;
      else if (e.type==='BLK')c.blk++; else if (e.type==='TOV')c.tov++;
      else if (e.type==='PF')c.pf++;
    }
    const stored = match.opp_stats || null;
    const hasData = !!stored || oppEvts.length > 0;
    const val = k => !hasData ? '' : (stored && stored[k] !== undefined ? stored[k] : c[k]);
    const cells = MS_COLS.map(col => {
      if (col.type === 'min') return `<td style="padding:2px 1px;text-align:center;color:var(--text-muted)">—</td>`;
      if (col.type === 'calc') {
        const color = col.key === 'pts' ? 'var(--accent-danger)' : 'var(--text-primary)';
        return `<td style="padding:2px 1px;text-align:center"><div style="font-weight:700;font-size:13px;color:${color};min-width:30px" id="opp-${col.key}-display"></div></td>`;
      }
      return `<td style="padding:2px 1px"><input type="number" inputmode="numeric" min="0" max="${col.max}" value="${val(col.key)}"
        class="opp-input" data-field="${col.key}" id="opp-${col.key}" oninput="onOppInputChange()"
        style="width:38px;${MS_OPP_STYLE}"></td>`;
    }).join('');
    return `<tr>
      <td colspan="2" style="padding:6px 8px;font-weight:700;color:var(--accent-danger)">${match.opponent} (Tim Lawan)</td>
      ${cells}
    </tr>`;
  }

  const hasExistingManual = existingEvents.some(e => e.source === 'manual');
  const warningHtml = valid.length > 0 && !hasExistingManual
    ? `<div style="padding:8px 12px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:6px;font-size:12px;color:#fbbf24;margin-bottom:10px">
        ⚠ Pertandingan ini sudah punya <strong>${valid.length} event live</strong>. Simpan manual → event lama diganti.
       </div>` : '';

  const tableHead = msTableHead();

  const scoreBar = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:10px;background:var(--bg-elevated);border-radius:8px;flex-wrap:wrap">
      <span style="font-weight:600;font-size:13px;color:var(--text-muted)">Skor Akhir:</span>
      <span style="color:var(--accent-primary);font-weight:700">Kami</span>
      <input type="number" id="ms-home-score" min="0" max="999" value="${match.home_score ?? ''}"
        oninput="validateManualStats()"
        style="width:55px;text-align:center;background:var(--bg-base);border:1px solid var(--border);border-radius:6px;padding:5px;color:var(--text-primary);font-size:15px;font-weight:700">
      <span style="color:var(--text-muted)">—</span>
      <input type="number" id="ms-away-score" min="0" max="999" value="${match.away_score ?? ''}"
        oninput="validateManualStats()"
        style="width:55px;text-align:center;background:var(--bg-base);border:1px solid rgba(239,68,68,.4);border-radius:6px;padding:5px;color:var(--text-primary);font-size:15px;font-weight:700">
      <span style="color:var(--accent-danger);font-weight:700">${match.opponent}</span>
    </div>`;

  // Tabs
  const tabContent = `
    <div class="tab-bar" style="margin-bottom:0">
      <div class="tab active" id="tab-home" onclick="switchStatsTab('home')">🏠 Tim Kami</div>
      <div class="tab" id="tab-opp"  onclick="switchStatsTab('opp')">⚡ ${match.opponent} (Lawan)</div>
    </div>

    <!-- HOME PLAYERS TAB -->
    <div id="ms-tab-home" style="overflow-x:auto;max-height:52vh;overflow-y:auto;margin-top:0">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        ${tableHead}
        <tbody id="ms-player-tbody">
          ${activePlayers.map(p => homePlayerRow(p)).join('')}
        </tbody>
      </table>
    </div>

    <!-- OPPONENT STATS TAB -->
    <div id="ms-tab-opp" style="display:none;overflow-x:auto;max-height:52vh;overflow-y:auto">
      <div style="padding:8px 0 6px;font-size:12px;color:var(--text-muted)">
        Input statistik <strong style="color:var(--accent-danger)">${match.opponent}</strong> sebagai tim lawan (aggregate — tidak per pemain).
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        ${tableHead}
        <tbody>${oppRow()}</tbody>
      </table>
    </div>

    <div style="margin-top:10px;padding:8px 12px;background:var(--bg-elevated);border-radius:8px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:12px;color:var(--text-muted)">Total poin pemain kami:</div>
      <div id="ms-total-pts" style="font-size:18px;font-weight:700;color:var(--accent-primary)">0</div>
    </div>
    <div id="ms-validation-msg" style="font-size:11px;color:var(--accent-warning);margin-top:5px;min-height:14px"></div>`;

  const root = document.getElementById('modal-root');
  root.innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal modal-lg" style="max-width:98vw;width:1040px">
      <div class="modal-header">
        <div class="modal-title">📝 Input Statistik Manual — vs ${match.opponent}</div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div id="modal-body">
        ${warningHtml}
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
          ${match.date ? match.date.split('T')[0] : '—'} · ${match.competition||'—'} · ${match.venue||''}
        </div>
        ${scoreBar}
        ${tabContent}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Batal</button>
        <button class="btn btn-secondary" onclick="addPlayerToManualStats()">+ Pemain Lain</button>
        <button class="btn btn-primary" onclick="saveManualStats('${matchId}')">💾 Simpan Stats</button>
      </div>
    </div>
  </div>`;

  window._manualStatsCtx = { matchId, activePlayers };
  for (const p of activePlayers) onManualInputChange(p.id);
  updateManualTotalPts();
  onOppInputChange();
}

function switchStatsTab(tab) {
  document.getElementById('ms-tab-home').style.display = tab === 'home' ? '' : 'none';
  document.getElementById('ms-tab-opp').style.display  = tab === 'opp'  ? '' : 'none';
  document.getElementById('tab-home').classList.toggle('active', tab === 'home');
  document.getElementById('tab-opp').classList.toggle('active', tab === 'opp');
}

function onOppInputChange() {
  const raw = (f) => document.getElementById(`opp-${f}`)?.value ?? '';
  const get = (f) => parseInt(raw(f)) || 0;
  const any = (...fs) => fs.some(f => String(raw(f)).trim() !== '');
  const ptsEl = document.getElementById('opp-pts-display');
  const rebEl = document.getElementById('opp-reb-display');
  if (ptsEl) ptsEl.textContent = any('pm2','pm3','ftm') ? get('pm2')*2 + get('pm3')*3 + get('ftm') : '';
  if (rebEl) rebEl.textContent = any('orb','drb') ? get('orb') + get('drb') : '';
  validateManualStats();
}

// Update PTS / REB otomatis saat mengetik (kosong kalau belum ada input)
function onManualInputChange(pid) {
  const raw = (f) => document.getElementById(`ms-${pid}-${f}`)?.value ?? '';
  const get = (f) => parseInt(raw(f)) || 0;
  const any = (...fs) => fs.some(f => String(raw(f)).trim() !== '');
  const ptsEl = document.getElementById(`ms-pts-${pid}`);
  const rebEl = document.getElementById(`ms-reb-${pid}`);
  if (ptsEl) ptsEl.textContent = any('pm2','pm3','ftm') ? get('pm2')*2 + get('pm3')*3 + get('ftm') : '';
  if (rebEl) rebEl.textContent = any('orb','drb') ? get('orb') + get('drb') : '';
  updateManualTotalPts();
  validateManualStats();
}

function updateManualTotalPts() {
  const ctx = window._manualStatsCtx;
  if (!ctx) return;
  let total = 0;
  for (const p of ctx.activePlayers) {
    const check = document.querySelector(`.ms-play-check[data-pid="${p.id}"]`);
    if (!check?.checked) continue;
    const get = (f) => parseInt(document.getElementById(`ms-${p.id}-${f}`)?.value) || 0;
    total += get('pm2') * 2 + get('pm3') * 3 + get('ftm');
  }
  const el = document.getElementById('ms-total-pts');
  if (el) el.textContent = total;
}

function validateManualStats() {
  const ctx = window._manualStatsCtx;
  if (!ctx) return;
  const msgs = [];
  for (const p of ctx.activePlayers) {
    const check = document.querySelector(`.ms-play-check[data-pid="${p.id}"]`);
    if (!check?.checked) continue;
    const get = (f) => parseInt(document.getElementById(`ms-${p.id}-${f}`)?.value) || 0;
    const pm2=get('pm2'), pa2=get('pa2'), pm3=get('pm3'), pa3=get('pa3'), ftm=get('ftm'), fta=get('fta');
    if (pm2 > pa2) msgs.push(`${p.name}: 2PM>2PA`);
    if (pm3 > pa3) msgs.push(`${p.name}: 3PM>3PA`);
    if (ftm > fta) msgs.push(`${p.name}: FTM>FTA`);
  }
  // Opponent validation
  const getO = (f) => parseInt(document.getElementById(`opp-${f}`)?.value) || 0;
  if (getO('pm2') > getO('pa2')) msgs.push(`Lawan: 2PM>2PA`);
  if (getO('pm3') > getO('pa3')) msgs.push(`Lawan: 3PM>3PA`);
  if (getO('ftm') > getO('fta')) msgs.push(`Lawan: FTM>FTA`);

  // Score vs computed total check
  const homeScore = parseInt(document.getElementById('ms-home-score')?.value);
  const totalPts  = parseInt(document.getElementById('ms-total-pts')?.textContent) || 0;
  if (!isNaN(homeScore) && homeScore !== totalPts)
    msgs.push(`Skor kami (${homeScore}) ≠ total poin pemain (${totalPts})`);

  const awayScore = parseInt(document.getElementById('ms-away-score')?.value);
  const oppPts    = getO('pm2')*2 + getO('pm3')*3 + getO('ftm');
  if (!isNaN(awayScore) && awayScore !== 0 && oppPts !== 0 && awayScore !== oppPts)
    msgs.push(`Skor lawan (${awayScore}) ≠ total poin lawan dari stats (${oppPts})`);

  const msgEl = document.getElementById('ms-validation-msg');
  if (msgEl) msgEl.textContent = msgs.length ? '⚠ ' + msgs.join(' · ') : '';
}

function toggleManualRow(pid, checked) {
  // Disable inputs for players not in game
  const inputs = document.querySelectorAll(`input.ms-input[data-pid="${pid}"]`);
  inputs.forEach(inp => { inp.disabled = !checked; inp.style.opacity = checked ? '1' : '0.3'; });
  updateManualTotalPts();
  validateManualStats();
}

// Allow adding inactive/extra players not in the default list
async function addPlayerToManualStats() {
  const ctx = window._manualStatsCtx;
  if (!ctx) return;
  const allPlayers = await txGetAll('players');
  const listedIds = ctx.activePlayers.map(p => p.id);
  const unlisted = allPlayers.filter(p => !listedIds.includes(p.id));
  if (!unlisted.length) { toast('Semua pemain sudah ditampilkan', 'info'); return; }
  const opts = unlisted.map(p => `<option value="${p.id}">#${p.number ?? '?'} ${p.name} (${p.status})</option>`).join('');
  const html = `<select id="add-player-sel" class="form-select">${opts}</select>`;
  const root2 = document.createElement('div');
  root2.id = 'mini-modal-overlay';
  root2.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:2000';
  root2.innerHTML = `<div class="modal" style="max-width:360px">
    <div class="modal-header"><div class="modal-title">Tambah Pemain</div></div>
    <div style="padding:8px 0">${html}</div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="document.getElementById('mini-modal-overlay').remove()">Batal</button>
      <button class="btn btn-primary" onclick="confirmAddExtraPlayer()">Tambah</button>
    </div>
  </div>`;
  document.body.appendChild(root2);
  window._addPlayerCallback = async () => {
    const pid = document.getElementById('add-player-sel').value;
    const player = allPlayers.find(p => p.id === pid);
    if (!player) return;
    ctx.activePlayers.push(player);
    // Inject row into table
    const tbody = document.getElementById('ms-player-tbody');
    if (tbody) {
      tbody.insertAdjacentHTML('beforeend', msPlayerRowHtml(player, {}, false, true));
      onManualInputChange(pid);
    }
    document.getElementById('mini-modal-overlay').remove();
    toast(`${player.name} ditambahkan`, 'success');
  };
}

function confirmAddExtraPlayer() {
  if (window._addPlayerCallback) window._addPlayerCallback();
}

async function saveManualStats(matchId) {
  const ctx = window._manualStatsCtx;
  if (!ctx) return;

  // Collect played players
  const playedIds = [];
  for (const p of ctx.activePlayers) {
    const check = document.querySelector(`.ms-play-check[data-pid="${p.id}"]`);
    if (check?.checked) playedIds.push(p.id);
  }
  if (!playedIds.length) { toast('Pilih minimal 1 pemain yang bermain', 'error'); return; }

  // Hard validation
  const errors = [];
  for (const pid of playedIds) {
    const get = (f) => parseInt(document.getElementById(`ms-${pid}-${f}`)?.value) || 0;
    const p = ctx.activePlayers.find(pl => pl.id === pid);
    if (get('pm2') > get('pa2')) errors.push(`${p?.name}: 2PM>2PA`);
    if (get('pm3') > get('pa3')) errors.push(`${p?.name}: 3PM>3PA`);
    if (get('ftm') > get('fta')) errors.push(`${p?.name}: FTM>FTA`);
  }
  const getO = (f) => parseInt(document.getElementById(`opp-${f}`)?.value) || 0;
  if (getO('pm2') > getO('pa2')) errors.push('Lawan: 2PM>2PA');
  if (getO('pm3') > getO('pa3')) errors.push('Lawan: 3PM>3PA');
  if (getO('ftm') > getO('fta')) errors.push('Lawan: FTM>FTA');
  if (errors.length) { toast('Perbaiki dulu: ' + errors.slice(0,3).join(' | '), 'error'); return; }

  const homeScore = parseInt(document.getElementById('ms-home-score')?.value);
  const awayScore = parseInt(document.getElementById('ms-away-score')?.value);

  if (!confirm(`Simpan statistik manual untuk ${playedIds.length} pemain?\n\nEvent lama akan dihapus dan diganti data manual.\n\nLanjut?`)) return;

  const createdAt = now();

  // 1. Void existing events
  const existing = await txGetAll('game_events', 'match_id', matchId);
  for (const ev of existing) {
    ev.voided = true; ev.voided_at = createdAt;
    ev.voided_reason = 'replaced_by_manual_input';
    await txPut('game_events', ev);
  }

  // 2. Generate home player events
  const newEvents = [];
  const statsPerPlayer = {}; // store for player_match_stats

  for (const pid of playedIds) {
    const get = (f) => parseInt(document.getElementById(`ms-${pid}-${f}`)?.value) || 0;
    const pm2=get('pm2'),pa2=get('pa2'),pm3=get('pm3'),pa3=get('pa3'),ftm=get('ftm'),fta=get('fta');
    const minutes = parseMinutes(document.getElementById(`ms-${pid}-min`)?.value);  // null kalau kosong
    statsPerPlayer[pid] = { pm2,pa2,pm3,pa3,ftm,fta,
      orb:get('orb'),drb:get('drb'),ast:get('ast'),stl:get('stl'),blk:get('blk'),tov:get('tov'),pf:get('pf'),
      minutes, pts: pm2*2+pm3*3+ftm };

    const types = [
      ...Array(pm2).fill('2PM'), ...Array(Math.max(0,pa2-pm2)).fill('2PA'),
      ...Array(pm3).fill('3PM'), ...Array(Math.max(0,pa3-pm3)).fill('3PA'),
      ...Array(ftm).fill('FTM'), ...Array(Math.max(0,fta-ftm)).fill('FTA'),
      ...Array(get('orb')).fill('ORB'), ...Array(get('drb')).fill('DRB'),
      ...Array(get('ast')).fill('AST'), ...Array(get('stl')).fill('STL'),
      ...Array(get('blk')).fill('BLK'), ...Array(get('tov')).fill('TOV'),
      ...Array(get('pf')).fill('PF'),
    ];
    for (const type of types) {
      newEvents.push({ id:uuid(), match_id:matchId, period:1, player_id:pid,
        team:'home', type, voided:false, source:'manual', created_at:createdAt });
    }
  }

  // 3. Generate opponent (away) aggregate events — so box score & analytics work
  const oppPm2=getO('pm2'),oppPa2=getO('pa2'),oppPm3=getO('pm3'),oppPa3=getO('pa3');
  const oppFtm=getO('ftm'),oppFta=getO('fta');
  const oppStats = {
    pts: oppPm2*2 + oppPm3*3 + oppFtm,
    pm2: oppPm2, pa2: oppPa2, pm3: oppPm3, pa3: oppPa3,
    fgm: oppPm2 + oppPm3, fga: oppPa2 + oppPa3,
    ftm: oppFtm, fta: oppFta,
    orb: getO('orb'), drb: getO('drb'), trb: getO('orb') + getO('drb'),
    ast: getO('ast'), stl: getO('stl'), blk: getO('blk'), tov: getO('tov'), pf: getO('pf'),
  };
  const oppTypes = [
    ...Array(oppPm2).fill('2PM'), ...Array(Math.max(0,oppPa2-oppPm2)).fill('2PA'),
    ...Array(oppPm3).fill('3PM'), ...Array(Math.max(0,oppPa3-oppPm3)).fill('3PA'),
    ...Array(oppFtm).fill('FTM'), ...Array(Math.max(0,oppFta-oppFtm)).fill('FTA'),
    ...Array(getO('orb')).fill('ORB'), ...Array(getO('drb')).fill('DRB'),
    ...Array(getO('ast')).fill('AST'), ...Array(getO('stl')).fill('STL'),
    ...Array(getO('blk')).fill('BLK'), ...Array(getO('tov')).fill('TOV'),
    ...Array(getO('pf')).fill('PF'),
  ];
  for (const type of oppTypes) {
    newEvents.push({ id:uuid(), match_id:matchId, period:1, player_id:null,
      team:'away', type, voided:false, source:'manual_opp', created_at:createdAt });
  }

  await txMultiPut('game_events', newEvents);

  // 4. Save player_match_stats (including MIN)
  const existingPMS = await txGetAll('player_match_stats', 'match_id', matchId);
  for (const s of existingPMS) await txDelete('player_match_stats', s.id);
  for (const [pid, s] of Object.entries(statsPerPlayer)) {
    await txPut('player_match_stats', { id:uuid(), match_id:matchId, player_id:pid, minutes:s.minutes,
      pts:s.pts, pm2:s.pm2, pa2:s.pa2, pm3:s.pm3, pa3:s.pa3, ftm:s.ftm, fta:s.fta,
      orb:s.orb, drb:s.drb, ast:s.ast, stl:s.stl, blk:s.blk, tov:s.tov, pf:s.pf,
      created_at:createdAt });
  }

  // 6. Update roster
  const existingRoster = await txGetAll('match_rosters', 'match_id', matchId);
  for (const r of existingRoster) await txDelete('match_rosters', r.id);
  for (const pid of playedIds) {
    await txPut('match_rosters', { id: uuid(), match_id: matchId, player_id: pid, created_at: createdAt });
  }

  // 7. Update match: status, scores, opp_stats
  const matchRec = await txGet('matches', matchId);
  const calcHome = newEvents.filter(e=>e.team==='home').reduce((a,e)=>{
    if(e.type==='2PM')return a+2; if(e.type==='3PM')return a+3; if(e.type==='FTM')return a+1; return a;
  }, 0);
  matchRec.status     = 'completed';
  matchRec.home_score = isNaN(homeScore) ? calcHome : homeScore;
  matchRec.away_score = isNaN(awayScore) ? oppStats.pts : awayScore;
  matchRec.opp_stats  = oppStats;
  matchRec.updated_at = createdAt;
  await txPut('matches', matchRec);

  await audit('match', matchId, 'manual_stats_input', {
    players: playedIds.length, events: newEvents.length,
    home_score: matchRec.home_score, away_score: matchRec.away_score,
  });

  const homeEventCount = newEvents.filter(e => e.team === 'home').length;
  const oppEventCount  = newEvents.filter(e => e.team === 'away').length;
  toast(`✅ Disimpan! ${homeEventCount} event kami + ${oppEventCount} event lawan.`, 'success');
  closeModal();

  await openBoxScore(matchId);
}

// ============================================================
// BOX SCORE
// ============================================================
async function renderBoxScore() {
  const content = document.getElementById('content');
  const actionsEl = document.getElementById('topbar-actions');
  
  const matches = await txGetAll('matches');
  const completedMatches = matches.filter(m=>m.status==='completed'||m.status==='live'||m.status==='archived');
  completedMatches.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  
  if (!completedMatches.length) {
    content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">No completed matches</div></div>`;
    return;
  }
  
  const match = state.bsView === 'detail' && state.selectedMatchId ? await txGet('matches', state.selectedMatchId) : null;
  if (!match) { state.bsView = 'list'; await renderBoxScoreList(completedMatches); return; }

  actionsEl.innerHTML = `
    <button class="btn btn-secondary btn-sm" onclick="backToBoxScoreList()">← Pertandingan</button>
    <button class="btn btn-sm" style="background:rgba(245,158,11,.15);color:#fbbf24;border:1px solid rgba(245,158,11,.3)" onclick="showManualStatsModal('${state.selectedMatchId}')">📝 Edit Stats</button>
    <button class="btn btn-secondary btn-sm" onclick="exportBoxScoreCSV()">CSV</button>`;
  
  const [events, players, roster] = await Promise.all([
    txGetAll('game_events','match_id',match.id),
    txGetAll('players'),
    txGetAll('match_rosters','match_id',match.id),
  ]);
  
  const validEvents = events.filter(e=>!e.voided);
  const rosterIds = roster.length ? roster.map(r=>r.player_id) : [...new Set(validEvents.map(e=>e.player_id).filter(Boolean))];
  const rosterPlayers = players.filter(p=>rosterIds.includes(p.id));
  
  // Calculate team totals
  const ts = calcTeamBoxScore(validEvents,'home');
  const os = calcTeamBoxScore(validEvents,'away');
  const teamName = await getSetting('team_name','My Team');
  
  // Load player_match_stats for MIN
  const pmStats = await txGetAll('player_match_stats', 'match_id', match.id);
  const pmMap   = Object.fromEntries(pmStats.map(s => [s.player_id, s]));

  const playerStats = rosterPlayers.map(p => ({
    p,
    stats:   calcBoxScore(validEvents.filter(e => e.team === 'home'), p.id),
    minutes: pmMap[p.id]?.minutes ?? null,
  }));
  // Urut sesuai nomor punggung (tanpa nomor di paling bawah)
  playerStats.sort((a,b) => {
    const na = (a.p.number == null || a.p.number === '') ? Infinity : Number(a.p.number);
    const nb = (b.p.number == null || b.p.number === '') ? Infinity : Number(b.p.number);
    return na - nb || String(a.p.name).localeCompare(String(b.p.name));
  });

  const calcHomeScore = ts.pts;
  const calcAwayScore = os.pts;
  const scoreMatch    = match.home_score === calcHomeScore || match.home_score === null;

  // Opponent aggregate stats (from opp_stats stored on match, or computed from away events)
  const oppStored = match.opp_stats || null;
  const os2 = oppStored || os; // prefer stored, fallback to computed

  function pct(m,a){ return a>0 ? (m/a*100).toFixed(1)+'%' : '—'; }
  // Format menit FIBA: MM:SS (menit disimpan sebagai angka, desimal = pecahan menit)
  function minFmt(m){
    if (m == null || m === '' || isNaN(Number(m))) return '—';
    const total = Math.round(Number(m) * 60);
    const mm = Math.floor(total / 60), ss = total % 60;
    return String(mm).padStart(2,'0') + ':' + String(ss).padStart(2,'0');
  }
  // FIBA EFF = (PTS+REB+AST+STL+BLK) - (missed FG + missed FT + TO)
  const effOf = s => (s.pts + s.trb + s.ast + s.stl + s.blk) - (s.fga - s.fgm) - (s.fta - s.ftm) - s.tov;
  // Susunan kolom: PTS | FGA FGM FG% | 2PT M A % | 3PT M A % | FT A M FT% | ORB DRB REB | AST TO STL BLK PF | EFF
  const fibaCells = s => `
    <td class="td-num">${s.fga}</td><td class="td-num">${s.fgm}</td><td class="td-num">${pct(s.fgm,s.fga)}</td>
    <td class="td-num">${s.pm2}</td><td class="td-num">${s.pa2}</td><td class="td-num">${pct(s.pm2,s.pa2)}</td>
    <td class="td-num">${s.pm3}</td><td class="td-num">${s.pa3}</td><td class="td-num">${pct(s.pm3,s.pa3)}</td>
    <td class="td-num">${s.fta}</td><td class="td-num">${s.ftm}</td><td class="td-num">${pct(s.ftm,s.fta)}</td>
    <td class="td-num">${s.orb}</td><td class="td-num">${s.drb}</td><td class="td-num" style="font-weight:600">${s.trb}</td>
    <td class="td-num">${s.ast}</td>
    <td class="td-num" style="color:var(--accent-danger)">${s.tov}</td>
    <td class="td-num">${s.stl}</td><td class="td-num">${s.blk}</td>
    <td class="td-num" style="color:var(--accent-warning)">${s.pf}</td>
    <td class="td-num" style="font-weight:700;color:${effOf(s)>=0?'var(--accent-success)':'var(--accent-danger)'}">${effOf(s)}</td>`;
  const fibaHead = (first) => `
    <tr>
      ${first}
      <th>PTS</th>
      <th>FGA</th><th>FGM</th><th>FG%</th>
      <th>2PT M</th><th>2PT A</th><th>2PT%</th>
      <th>3PT M</th><th>3PT A</th><th>3PT%</th>
      <th>FT A</th><th>FT M</th><th>FT%</th>
      <th>ORB</th><th>DRB</th><th>REB</th>
      <th>AST</th><th>TO</th><th>STL</th><th>BLK</th><th>PF</th><th>EFF</th>
    </tr>`;
  // Opponent -> bentuk yang sama dengan calcBoxScore
  const g = v => v ?? 0;
  const oppS = {
    pts: g(os2.pts ?? calcAwayScore),
    pm2: g(os2.pm2), pa2: g(os2.pa2), pm3: g(os2.pm3), pa3: g(os2.pa3),
    ftm: g(os2.ftm), fta: g(os2.fta), orb: g(os2.orb), drb: g(os2.drb),
    ast: g(os2.ast), stl: g(os2.stl), blk: g(os2.blk), tov: g(os2.tov), pf: g(os2.pf),
  };
  oppS.fgm = oppS.pm2 + oppS.pm3; oppS.fga = oppS.pa2 + oppS.pa3; oppS.trb = oppS.orb + oppS.drb;

  content.innerHTML = `
  <div style="margin-bottom:14px">
    <div style="font-size:20px;font-weight:800;margin-bottom:4px">${teamName} vs ${match.opponent}</div>
    <div style="color:var(--text-muted);font-size:13px">${match.date?.split('T')[0]||'—'} · ${match.competition||'—'} · ${match.category||''} · ${match.venue||'No venue'}</div>
    ${!scoreMatch && match.home_score !== null
      ? `<div style="color:var(--accent-warning);font-size:12px;margin-top:4px">⚠ Stored score (${match.home_score}) differs from event total (${calcHomeScore}). Events are primary source.</div>`
      : ''}
  </div>

  <!-- Score banner -->
  <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;margin-bottom:16px;
              background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px">
    <div style="text-align:center">
      <div style="font-size:11px;font-weight:700;color:var(--accent-primary);text-transform:uppercase;margin-bottom:4px">${teamName}</div>
      <div style="font-size:50px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1">${calcHomeScore}</div>
    </div>
    <div style="text-align:center;color:var(--text-muted);font-size:18px;font-weight:600">FINAL</div>
    <div style="text-align:center">
      <div style="font-size:11px;font-weight:700;color:var(--accent-danger);text-transform:uppercase;margin-bottom:4px">${match.opponent}</div>
      <div style="font-size:50px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1">${calcAwayScore}</div>
    </div>
  </div>

  <!-- Home player box score (FIBA layout) -->
  <div class="card" style="margin-bottom:14px">
    <div class="card-header">
      <span class="card-title">${teamName} — Player Stats</span>
      <span style="font-size:11px;color:var(--text-muted)">${playerStats.length} pemain · urut nomor punggung</span>
    </div>
    <div class="tbl-wrap">
      <table class="bs-tbl">
        <thead>${fibaHead('<th>#</th><th class="col-name">Player</th><th>MIN</th>')}</thead>
        <tbody>
          ${playerStats.map(({p, stats: s, minutes}) => `<tr>
            <td><input class="bs-num-input" type="number" inputmode="numeric" min="0" max="99" step="1"
                value="${p.number ?? ''}" placeholder="#" title="Input nomor punggung"
                onchange="setPlayerNumber('${p.id}', this.value)"></td>
            <td class="col-name" style="font-weight:600;white-space:nowrap">${p.name}</td>
            <td class="td-num" style="color:var(--text-muted)">${minFmt(minutes)}</td>
            <td class="td-num" style="font-weight:700;color:var(--text-primary)">${s.pts}</td>
            ${fibaCells(s)}
          </tr>`).join('')}
        </tbody>
        <tfoot style="background:var(--bg-elevated)">
          <tr style="font-weight:700;color:var(--accent-primary)">
            <td colspan="2" class="col-name">TEAM TOTAL</td>
            <td class="td-num">—</td>
            <td class="td-num">${ts.pts}</td>
            ${fibaCells(ts)}
          </tr>
        </tfoot>
      </table>
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:8px;padding:0 4px;line-height:1.5">
      EFF = (PTS + REB + AST + STL + BLK) − (FG miss + FT miss + TO). Kolom +/- tidak ditampilkan karena belum ada pencatatan pemain di lapangan.
    </div>
  </div>

  <!-- Opponent team stats -->
  <div class="card" style="margin-bottom:14px">
    <div class="card-header">
      <span class="card-title">⚡ ${match.opponent} — Team Stats</span>
      <span style="font-size:11px;color:var(--text-muted)">${oppStored ? 'Manual input' : 'Dari event'}</span>
    </div>
    <div class="tbl-wrap">
      <table class="bs-tbl">
        <thead>${fibaHead('<th class="col-name">Team</th>')}</thead>
        <tbody>
          <tr style="color:var(--accent-danger)">
            <td class="col-name" style="font-weight:700;white-space:nowrap">${match.opponent}</td>
            <td class="td-num" style="font-weight:700">${oppS.pts}</td>
            ${fibaCells(oppS)}
          </tr>
        </tbody>
      </table>
    </div>
    ${!oppStored ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;padding:0 4px">
      💡 Klik <strong>📝 Edit Stats</strong> → tab <strong>⚡ ${match.opponent}</strong> untuk input statistik lawan secara manual.
    </div>` : ''}
  </div>`;
}

// Input nomor punggung langsung dari Box Score
async function setPlayerNumber(playerId, raw) {
  const player = await txGet('players', playerId);
  if (!player) return;
  const v = String(raw).trim();
  let num = null;
  if (v !== '') {
    num = Number(v);
    if (!Number.isInteger(num) || num < 0 || num > 99) {
      toast('Nomor punggung harus angka 0–99', 'error');
      await renderBoxScore(); return;
    }
    const all = await txGetAll('players');
    const dup = all.find(x => x.id !== playerId && x.number != null && x.number !== '' && Number(x.number) === num);
    if (dup) {
      toast(`Nomor ${num} sudah dipakai ${dup.name}`, 'error');
      await renderBoxScore(); return;
    }
  }
  await txPut('players', { ...player, number: num, updated_at: now() });
  await audit('player', playerId, 'update', { number: num });
  await renderBoxScore();
}

async function backToBoxScoreList() {
  state.bsView = 'list';
  document.getElementById('topbar-actions').innerHTML = '';
  await renderBoxScore();
}

async function changeBoxScoreCompetition(value) {
  state.bsCompetition = decodeURIComponent(value);
  await renderBoxScore();
}

// Tampilan awal Box Score: daftar pertandingan (skor + tim) per kompetisi
async function renderBoxScoreList(allMatches) {
  const content = document.getElementById('content');
  document.getElementById('topbar-actions').innerHTML = '';
  const [events, teamName] = await Promise.all([txGetAll('game_events'), getSetting('team_name', 'My Team')]);

  const lastDate = {};
  for (const m of allMatches) {
    const k = m.competition || '__none__';
    lastDate[k] = Math.max(lastDate[k] || 0, new Date(m.date || 0).getTime());
  }
  const compKeys = Object.keys(lastDate).sort((a, b) => lastDate[b] - lastDate[a]);
  const compLabel = k => k === '__none__' ? '(Tanpa kompetisi)' : k;
  if (!state.bsCompetition || (state.bsCompetition !== '__all__' && !compKeys.includes(state.bsCompetition))) {
    state.bsCompetition = compKeys[0];   // default: kompetisi terbaru
  }
  const sel = state.bsCompetition;
  const list = allMatches.filter(m => sel === '__all__' || (m.competition || '__none__') === sel);  // sudah urut terbaru

  const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const cards = list.map(m => {
    const evs = events.filter(e => e.match_id === m.id && !e.voided);
    const hs = evs.length ? calcTeamBoxScore(evs, 'home').pts : m.home_score;
    const as = evs.length ? calcTeamBoxScore(evs, 'away').pts : m.away_score;
    const win = hs != null && as != null ? (hs > as ? 'home' : as > hs ? 'away' : '') : '';
    const sc = (v, side) => `<span style="${win && win !== side ? 'color:var(--text-muted)' : ''}">${v ?? '—'}</span>`;
    return `<div class="card bs-match" style="margin-bottom:10px;padding:14px 16px" onclick="openBoxScore('${m.id}')">
      <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--text-muted)">
        <span>${m.date ? m.date.split('T')[0] : '—'}${m.venue ? ' · ' + esc(m.venue) : ''}</span>
        <span>${m.status === 'live' ? '<span class="badge badge-red">LIVE</span>' : esc(m.competition || '')}</span>
      </div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:12px;margin-top:8px">
        <div style="text-align:right;font-weight:700;font-size:14px;color:var(--accent-primary)">${esc(teamName)}</div>
        <div style="font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap">${sc(hs,'home')} <span style="color:var(--text-muted);font-weight:500">–</span> ${sc(as,'away')}</div>
        <div style="text-align:left;font-weight:700;font-size:14px;color:var(--accent-danger)">${esc(m.opponent)}</div>
      </div>
    </div>`;
  }).join('');

  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <select class="form-select" onchange="changeBoxScoreCompetition(this.value)" style="width:auto;min-width:240px;font-size:13px">
        ${compKeys.map(k => `<option value="${encodeURIComponent(k)}" ${k === sel ? 'selected' : ''}>${esc(compLabel(k))}</option>`).join('')}
        <option value="${encodeURIComponent('__all__')}" ${sel === '__all__' ? 'selected' : ''}>Semua kompetisi</option>
      </select>
      <span style="font-size:12px;color:var(--text-muted)">${list.length} pertandingan · klik untuk lihat box score</span>
    </div>
    ${cards}`;
}

async function changeBoxScoreMatch(id) {
  state.selectedMatchId = id;
  await renderBoxScore();
}

async function exportBoxScoreCSV() {
  if (!state.selectedMatchId) return;
  const [match, events, players, pmStats] = await Promise.all([
    txGet('matches', state.selectedMatchId),
    txGetAll('game_events', 'match_id', state.selectedMatchId),
    txGetAll('players'),
    txGetAll('player_match_stats', 'match_id', state.selectedMatchId),
  ]);
  const pmMap      = Object.fromEntries(pmStats.map(s => [s.player_id, s]));
  const validHome  = events.filter(e => !e.voided && e.team === 'home');
  const rosterIds  = [...new Set(validHome.map(e => e.player_id).filter(Boolean))];

  const numOf = pid => { const n = players.find(pl => pl.id === pid)?.number; return (n == null || n === '') ? Infinity : Number(n); };
  rosterIds.sort((a,b) => numOf(a) - numOf(b));
  const rows = [['Number','Name','MIN','PTS','FGA','FGM','FG%','2PT M','2PT A','2PT%','3PT M','3PT A','3PT%','FT A','FT M','FT%','ORB','DRB','REB','AST','TO','STL','BLK','PF','EFF']];
  for (const pid of rosterIds) {
    const p = players.find(pl => pl.id === pid);
    if (!p) continue;
    const s   = calcBoxScore(validHome, pid);
    const rawMin = pmMap[pid]?.minutes;
    const min = (rawMin == null || rawMin === '' || isNaN(Number(rawMin))) ? '' :
      (() => { const t = Math.round(Number(rawMin)*60); return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0'); })();
    rows.push([p.number??'', p.name, min,
      s.pts, s.fga, s.fgm, s.fgPct,
      s.pm2, s.pa2, s.p2Pct,
      s.pm3, s.pa3, s.p3Pct,
      s.fta, s.ftm, s.ftPct,
      s.orb, s.drb, s.trb,
      s.ast, s.tov, s.stl, s.blk, s.pf,
      (s.pts + s.trb + s.ast + s.stl + s.blk) - (s.fga - s.fgm) - (s.fta - s.ftm) - s.tov]);
  }

  // Append opponent row if available
  const opp = match.opp_stats;
  if (opp) {
    rows.push([]);
    const o = k => opp[k] || 0;
    const fgm = o('pm2')+o('pm3'), fga = o('pa2')+o('pa3'), reb = o('orb')+o('drb');
    rows.push(['','OPPONENT','', o('pts'), fga, fgm, '',
      o('pm2'), o('pa2'), '', o('pm3'), o('pa3'), '', o('fta'), o('ftm'), '',
      o('orb'), o('drb'), reb, o('ast'), o('tov'), o('stl'), o('blk'), o('pf'),
      (o('pts') + reb + o('ast') + o('stl') + o('blk')) - (fga - fgm) - (o('fta') - o('ftm')) - o('tov')]);
  }

  const csv = rows.map(r => r.join(',')).join('\n');
  downloadFile(`boxscore_${match?.opponent||'match'}_${match?.date?.split('T')[0]||''}.csv`, csv, 'text/csv');
  toast('CSV exported', 'success');
}
