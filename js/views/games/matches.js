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
