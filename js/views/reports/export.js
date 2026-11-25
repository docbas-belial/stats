// ============================================================
// REPORTS & EXPORT
// ============================================================
async function renderReports() {
  const content = document.getElementById('content');
  const [matches, players, seasons, events] = await Promise.all([
    txGetAll('matches'), txGetAll('players'), txGetAll('seasons'), txGetAll('game_events')
  ]);
  
  content.innerHTML = `
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><span class="card-title">Export Data</span></div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-secondary" onclick="exportAllJSON()">
          📦 Full Database Export (JSON)
          <span style="font-size:11px;color:var(--text-muted);margin-left:4px">${events.length} events, ${matches.length} matches</span>
        </button>
        <button class="btn btn-secondary" onclick="exportPlayersCSV()">📊 Players CSV</button>
        <button class="btn btn-secondary" onclick="exportMatchesCSV()">📊 Matches CSV</button>
        <button class="btn btn-secondary" onclick="exportEventsCSV()">📊 Events CSV</button>
        <button class="btn btn-secondary" onclick="exportSeasonStatsCSV()">📊 Season Player Stats CSV</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Database Summary</span></div>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
        <div style="display:flex;justify-content:space-between"><span class="text-muted">Matches</span><span style="font-weight:600">${matches.length}</span></div>
        <div style="display:flex;justify-content:space-between"><span class="text-muted">Completed</span><span style="font-weight:600">${matches.filter(m=>m.status==='completed').length}</span></div>
        <div style="display:flex;justify-content:space-between"><span class="text-muted">Players</span><span style="font-weight:600">${players.length}</span></div>
        <div style="display:flex;justify-content:space-between"><span class="text-muted">Game Events</span><span style="font-weight:600">${events.length}</span></div>
        <div style="display:flex;justify-content:space-between"><span class="text-muted">Voided Events</span><span style="font-weight:600">${events.filter(e=>e.voided).length}</span></div>
        <div style="display:flex;justify-content:space-between"><span class="text-muted">Seasons</span><span style="font-weight:600">${seasons.length}</span></div>
      </div>
    </div>
  </div>`;
}

async function exportAllJSON() {
  const data = {};
  for (const store of Object.keys(STORES)) {
    data[store] = await txGetAll(store);
  }
  const manifest = {
    export_version: '1.0',
    app_version: '1.0.0',
    schema_version: SCHEMA_VERSION,
    exported_at: now(),
    match_count: data.matches?.length||0,
    player_count: data.players?.length||0,
    event_count: data.game_events?.length||0,
  };
  const json = JSON.stringify({ manifest, data }, null, 2);
  downloadFile(`bsm_full_export_${new Date().toISOString().split('T')[0]}.json`, json, 'application/json');
  toast('Full export downloaded', 'success');
}

async function exportPlayersCSV() {
  const players = await txGetAll('players');
  const rows = [['ID','Name','Number','Position','Height','DOB','Hand','Status','Notes']];
  for (const p of players) rows.push([p.id,p.name,p.number??'',p.position||'',p.height||'',p.dob||'',p.dominant_hand||'',p.status,p.notes||'']);
  downloadFile('players.csv', rows.map(r=>r.join(',')).join('\n'), 'text/csv');
  toast('Players CSV exported', 'success');
}

async function exportMatchesCSV() {
  const matches = await txGetAll('matches');
  const rows = [['ID','Date','Opponent','Competition','Season','Venue','Category','Status','Home Score','Away Score']];
  for (const m of matches) rows.push([m.id,m.date||'',m.opponent||'',m.competition||'',m.season_id||'',m.venue||'',m.category||'',m.status,m.home_score??'',m.away_score??'']);
  downloadFile('matches.csv', rows.map(r=>r.join(',')).join('\n'), 'text/csv');
  toast('Matches CSV exported', 'success');
}

async function exportEventsCSV() {
  const events = await txGetAll('game_events');
  const rows = [['ID','Match ID','Period','Player ID','Team','Type','Voided','Created At']];
  for (const e of events) rows.push([e.id,e.match_id,e.period,e.player_id||'',e.team,e.type,e.voided?'1':'0',e.created_at]);
  downloadFile('events.csv', rows.map(r=>r.join(',')).join('\n'), 'text/csv');
  toast('Events CSV exported', 'success');
}

async function exportSeasonStatsCSV() {
  const [players, events] = await Promise.all([txGetAll('players'), txGetAll('game_events')]);
  const validEvents = events.filter(e=>!e.voided);
  const rows = [['ID','Name','Number','Position','PTS','FGM','FGA','FG%','2PM','2PA','3PM','3PA','3P%','FTM','FTA','FT%','ORB','DRB','REB','AST','STL','BLK','TOV','PF']];
  for (const p of players) {
    const s = calcBoxScore(validEvents, p.id);
    rows.push([p.id,p.name,p.number??'',p.position||'',s.pts,s.fgm,s.fga,s.fgPct,s.pm2,s.pa2,s.pm3,s.pa3,s.p3Pct,s.ftm,s.fta,s.ftPct,s.orb,s.drb,s.trb,s.ast,s.stl,s.blk,s.tov,s.pf]);
  }
  downloadFile('season_stats.csv', rows.map(r=>r.join(',')).join('\n'), 'text/csv');
  toast('Season stats CSV exported', 'success');
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
