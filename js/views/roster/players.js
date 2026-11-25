// ============================================================
// PLAYERS
// ============================================================
async function renderPlayers() {
  const content = document.getElementById('content');
  const actionsEl = document.getElementById('topbar-actions');
  actionsEl.innerHTML = `<button class="btn btn-primary" onclick="showPlayerModal()">+ Add Player</button>`;

  const [players, seasons] = await Promise.all([txGetAll('players'), txGetAll('seasons')]);
  seasons.sort((a,b) => b.start_year - a.start_year);

  const active = players.filter(p => p.status === 'active');
  const inactive = players.filter(p => p.status !== 'active');

  content.innerHTML = `
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
    <input class="input-search" id="player-search" placeholder="Search players…" oninput="filterPlayers()">
    <select class="form-select" id="player-filter" onchange="filterPlayers()" style="width:130px">
      <option value="all">All Players</option>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>
    <select class="form-select" id="player-gender-filter" onchange="filterPlayers()" style="width:120px">
      <option value="">Putra & Putri</option>
      <option value="Putra">Putra</option>
      <option value="Putri">Putri</option>
    </select>
    <select class="form-select" id="player-level-filter" onchange="filterPlayers()" style="width:140px">
      <option value="">Semua Level</option>
      <option value="Elementary">Elementary</option>
      <option value="Junior">Junior</option>
      <option value="Senior">Senior</option>
      <option value="University">University</option>
    </select>
    <select class="form-select" id="player-season-filter" onchange="filterPlayers()" style="width:160px">
      <option value="">All Seasons</option>
      ${seasons.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
    </select>
  </div>
  <div id="players-grid">
    ${renderPlayersGrid(active, inactive)}
  </div>`;
}

function renderPlayersGrid(active, inactive) {
  const all = [...active, ...inactive];
  if (!all.length) return `<div class="empty-state">
    <div class="empty-state-icon">👤</div>
    <div class="empty-state-title">No players yet</div>
    <div>Add your first player to get started.</div>
    <button class="btn btn-primary" style="margin-top:12px" onclick="showPlayerModal()">Add Player</button>
  </div>`;

  const makeTable = (list, colspan=9) => list.length
    ? list.map(p => playerRow(p)).join('')
    : `<tr><td colspan="${colspan}" style="text-align:center;color:var(--text-muted);padding:20px">No players</td></tr>`;

  return `<div style="margin-bottom:20px">
    <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">Active (${active.length})</div>
    <div class="tbl-wrap">
      <table><thead><tr>
        <th>#</th><th>Player</th><th>Position</th><th>Height</th><th>Hand</th><th>Gender</th><th>Level</th><th>Status</th><th>Actions</th>
      </tr></thead><tbody>${makeTable(active)}</tbody></table>
    </div>
  </div>
  ${inactive.length ? `<div>
    <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">Inactive / Archived (${inactive.length})</div>
    <div class="tbl-wrap">
      <table><thead><tr><th>#</th><th>Player</th><th>Position</th><th>Height</th><th>Hand</th><th>Gender</th><th>Level</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${makeTable(inactive)}</tbody></table>
    </div>
  </div>` : ''}`;
}

function playerRow(p) {
  const initials = (p.name||'?').split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase();
  return `<tr>
    <td><span style="font-weight:700;font-size:15px;color:var(--accent-secondary)">${p.number||'—'}</span></td>
    <td><div style="display:flex;align-items:center;gap:8px">
      <div class="player-avatar">${initials}</div>
      <div><div style="font-weight:600">${p.name}</div><div class="td-muted" style="font-size:11px">${p.notes||''}</div></div>
    </div></td>
    <td>${p.position||'—'}</td>
    <td>${p.height||'—'}</td>
    <td>${p.dominant_hand||'—'}</td>
    <td>${p.gender ? `<span class="badge ${p.gender==='Putra'?'badge-blue':'badge-yellow'}">${p.gender}</span>` : '—'}</td>
    <td>${p.level ? `<span class="badge badge-gray">${p.level}</span>` : '—'}</td>
    <td>
      <span class="badge ${p.status==='active'?'badge-green':'badge-gray'}"
        style="cursor:pointer;user-select:none" title="Klik untuk ubah status"
        onclick="showStatusPopup(event,'${p.id}','${p.status}')">
        ${p.status} ▾
      </span>
    </td>
    <td>
      <div style="display:flex;gap:4px">
        <button class="btn btn-secondary btn-sm" onclick="showPlayerModal('${p.id}')">Edit</button>
        <button class="btn btn-secondary btn-sm" onclick="showPlayerStats('${p.id}')">Stats</button>
        <button class="btn btn-danger btn-sm" onclick="deletePlayer('${p.id}')">Delete</button>
      </div>
    </td>
  </tr>`;
}

// ---- Status popup (click on badge) ----
function showStatusPopup(event, playerId, currentStatus) {
  event.stopPropagation();
  // Remove existing popup
  document.getElementById('status-popup')?.remove();

  const popup = document.createElement('div');
  popup.id = 'status-popup';
  popup.style.cssText = `position:fixed;z-index:3000;background:var(--bg-elevated);border:1px solid var(--border);
    border-radius:8px;padding:6px;box-shadow:0 8px 24px rgba(0,0,0,.5);min-width:140px`;

  const rect = event.target.getBoundingClientRect();
  popup.style.top  = (rect.bottom + 6) + 'px';
  popup.style.left = rect.left + 'px';

  popup.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);padding:4px 8px 6px;text-transform:uppercase;letter-spacing:.06em">Ubah Status</div>
    <button onclick="setPlayerStatus('${playerId}','active')"
      style="display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;background:none;border:none;
             cursor:pointer;color:var(--text-primary);border-radius:5px;font-size:13px"
      onmouseover="this.style.background='rgba(16,185,129,.15)'" onmouseout="this.style.background='none'">
      <span style="width:8px;height:8px;border-radius:50%;background:#10b981;flex-shrink:0"></span> Active
      ${currentStatus==='active'?'<span style="margin-left:auto;font-size:11px;color:var(--accent-success)">✓</span>':''}
    </button>
    <button onclick="setPlayerStatus('${playerId}','inactive')"
      style="display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;background:none;border:none;
             cursor:pointer;color:var(--text-primary);border-radius:5px;font-size:13px"
      onmouseover="this.style.background='rgba(107,114,128,.15)'" onmouseout="this.style.background='none'">
      <span style="width:8px;height:8px;border-radius:50%;background:#6b7280;flex-shrink:0"></span> Inactive
      ${currentStatus==='inactive'?'<span style="margin-left:auto;font-size:11px;color:var(--text-muted)">✓</span>':''}
    </button>`;

  document.body.appendChild(popup);

  // Close on outside click
  const close = (e) => { if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', close); } };
  setTimeout(() => document.addEventListener('click', close), 10);
}

async function setPlayerStatus(id, newStatus) {
  document.getElementById('status-popup')?.remove();
  const player = await txGet('players', id);
  if (!player || player.status === newStatus) return;
  player.status = newStatus;
  player.updated_at = now();
  await txPut('players', player);
  await audit('player', id, newStatus, {});
  toast(`${player.name} → ${newStatus}`, 'success');
  await filterPlayers();
}

async function filterPlayers() {
  const search   = (document.getElementById('player-search')?.value || '').toLowerCase();
  const filter   = document.getElementById('player-filter')?.value || 'all';
  const gender   = document.getElementById('player-gender-filter')?.value || '';
  const level    = document.getElementById('player-level-filter')?.value || '';
  const seasonId = document.getElementById('player-season-filter')?.value || '';

  let players = await txGetAll('players');
  players.sort((a,b) => (a.number||999) - (b.number||999));

  // Filter by season
  if (seasonId) {
    const matches  = await txGetAll('matches', 'season_id', seasonId);
    const matchIds = matches.map(m => m.id);
    const rosters  = await txGetAll('match_rosters');
    const pidsInSeason = new Set(rosters.filter(r => matchIds.includes(r.match_id)).map(r => r.player_id));
    const events = await txGetAll('game_events');
    events.filter(e => matchIds.includes(e.match_id) && e.player_id).forEach(e => pidsInSeason.add(e.player_id));
    players = players.filter(p => pidsInSeason.has(p.id));
  }

  if (search)              players = players.filter(p => (p.name||'').toLowerCase().includes(search) || (p.number+'').includes(search));
  if (filter==='active')   players = players.filter(p => p.status === 'active');
  if (filter==='inactive') players = players.filter(p => p.status !== 'active');
  if (gender)              players = players.filter(p => p.gender === gender);
  if (level)               players = players.filter(p => p.level === level);

  document.getElementById('players-grid').innerHTML = renderPlayersGrid(
    players.filter(p => p.status === 'active'),
    players.filter(p => p.status !== 'active')
  );
}

async function showPlayerModal(id = null) {
  let player = null;
  if (id) player = await txGet('players', id);
  const positions = ['PG','SG','SF','PF','C'];
  showModal(`${id ? 'Edit' : 'Add'} Player`, `
    <div class="form-group"><label class="form-label">Full Name *</label>
      <input class="form-input" id="p-name" value="${player?.name||''}" placeholder="Nama lengkap pemain"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Position</label>
        <select class="form-select" id="p-pos">
          <option value="">Select…</option>
          ${positions.map(pos=>`<option value="${pos}" ${player?.position===pos?'selected':''}>${pos}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Height (cm)</label>
        <input class="form-input" id="p-height" value="${player?.height||''}" placeholder="e.g. 185"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Date of Birth</label>
        <input class="form-input" id="p-dob" type="date" value="${player?.dob||''}"></div>
      <div class="form-group"><label class="form-label">Dominant Hand</label>
        <select class="form-select" id="p-hand">
          <option value="">Select…</option>
          <option value="Right" ${player?.dominant_hand==='Right'?'selected':''}>Right</option>
          <option value="Left"  ${player?.dominant_hand==='Left' ?'selected':''}>Left</option>
          <option value="Both"  ${player?.dominant_hand==='Both' ?'selected':''}>Both</option>
        </select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Gender</label>
        <select class="form-select" id="p-gender">
          <option value="">Select…</option>
          <option value="Putra" ${player?.gender==='Putra'?'selected':''}>Putra</option>
          <option value="Putri" ${player?.gender==='Putri'?'selected':''}>Putri</option>
        </select></div>
      <div class="form-group"><label class="form-label">Level</label>
        <select class="form-select" id="p-level">
          <option value="">Select…</option>
          <option value="Elementary" ${player?.level==='Elementary'?'selected':''}>Elementary</option>
          <option value="Junior"     ${player?.level==='Junior'    ?'selected':''}>Junior</option>
          <option value="Senior"     ${player?.level==='Senior'    ?'selected':''}>Senior</option>
          <option value="University" ${player?.level==='University'?'selected':''}>University</option>
        </select></div>
    </div>
    <div class="form-group"><label class="form-label">Coach Notes</label>
      <textarea class="form-textarea" id="p-notes" placeholder="Optional notes…">${player?.notes||''}</textarea></div>
  `, async () => {
    const name = document.getElementById('p-name').value.trim();
    if (!name) { toast('Player name is required', 'error'); return false; }
    const obj = {
      id: id || uuid(),
      name,
      number: player?.number ?? null,
      position: document.getElementById('p-pos').value || null,
      height:   document.getElementById('p-height').value || null,
      dob:      document.getElementById('p-dob').value || null,
      dominant_hand: document.getElementById('p-hand').value || null,
      gender:   document.getElementById('p-gender').value || null,
      level:    document.getElementById('p-level').value || null,
      notes:    document.getElementById('p-notes').value.trim() || null,
      status:   player?.status || 'active',
      created_at: player?.created_at || now(),
      updated_at: now(),
    };
    await txPut('players', obj);
    await audit('player', obj.id, id ? 'update' : 'create', { name });
    toast(`Player ${id ? 'updated' : 'added'}: ${name}`, 'success');
    closeModal();
    await renderPlayers();
  });
}

// ---- Delete player ----
async function deletePlayer(id) {
  const player = await txGet('players', id);
  if (!player) { toast('Player tidak ditemukan', 'error'); return; }
  const [rosters, events, pms] = await Promise.all([
    txGetAll('match_rosters', 'player_id', id),
    txGetAll('game_events', 'player_id', id),
    txGetAll('player_match_stats', 'player_id', id),
  ]);
  const hasHistory = rosters.length || events.length || pms.length;
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const body = `
    <p style="font-size:13px;line-height:1.6">Hapus <strong>${esc(player.name)}</strong>${player.number!=null ? ' (#'+esc(player.number)+')' : ''} secara permanen?</p>
    ${hasHistory ? `<div style="margin-top:10px;padding:10px;background:var(--bg-elevated);border-radius:var(--radius-sm);font-size:12px;line-height:1.6">
      <span style="color:var(--accent-warning);font-weight:600">⚠ Pemain ini punya riwayat:</span><br>
      ${rosters.length} roster pertandingan, ${events.filter(e=>!e.voided).length} event, ${pms.length} statistik manual.<br>
      Semua data tersebut ikut terhapus dan statistik tim di pertandingan terkait bisa berubah.
      Kalau hanya tidak aktif lagi, lebih aman ubah status jadi <strong>inactive</strong>.</div>` : ''}
    <p style="font-size:12px;color:var(--text-muted);margin-top:10px">Tindakan ini tidak bisa dibatalkan. Buat backup dulu kalau ragu.</p>`;
  showModal('Delete Player', body, async () => {
    closeModal();
    try {
      for (const r of rosters) await txDelete('match_rosters', r.id);
      for (const e of events)  await txDelete('game_events', e.id);
      for (const s of pms)     await txDelete('player_match_stats', s.id);
      await txDelete('players', id);
      await audit('player', id, 'delete', { name: player.name });
      toast(`Player dihapus: ${player.name}`, 'success');
    } catch (err) {
      toast('Gagal menghapus: ' + err.message, 'error');
      console.error(err);
    }
    await renderPlayers();
  }, 'Delete');
}

// ---- Career Stats (averages + Efficiency) ----
async function showPlayerStats(id) {
  const [player, allEvents, allMatches, allRosters, seasons] = await Promise.all([
    txGet('players', id),
    txGetAll('game_events'),
    txGetAll('matches'),
    txGetAll('match_rosters'),
    txGetAll('seasons'),
  ]);
  if (!player) return;

  seasons.sort((a,b) => b.start_year - a.start_year);
  const seasonMap = Object.fromEntries(seasons.map(s => [s.id, s.name]));

  // helper: compute stats for a set of events and game count
  function computeAvg(events, gamesPlayed) {
    const s = calcBoxScore(events, id);
    const gp = gamesPlayed || 1;
    const avg = (v) => gp > 0 ? (v / gp).toFixed(1) : '0.0';
    // Efficiency = PTS + REB + AST + STL + BLK - TOV - (FGA-FGM) - (FTA-FTM)
    const eff = s.pts + s.trb + s.ast + s.stl + s.blk - s.tov - (s.fga - s.fgm) - (s.fta - s.ftm);
    return { s, gp, avg, eff };
  }

  // Build season selector options
  const seasonOpts = seasons.map(s =>
    `<option value="${s.id}">${s.name}</option>`
  ).join('');

  // Get matches this player appeared in (via roster or events)
  function getPlayerMatchIds(matchIds) {
    const rosterMatchIds = allRosters.filter(r => r.player_id === id).map(r => r.match_id);
    const eventMatchIds  = allEvents.filter(e => e.player_id === id && !e.voided).map(e => e.match_id);
    const all = new Set([...rosterMatchIds, ...eventMatchIds]);
    return matchIds ? matchIds.filter(mid => all.has(mid)) : [...all];
  }

  function renderStatsForScope(seasonFilter) {
    let matchPool;
    if (seasonFilter === 'career') {
      matchPool = allMatches.filter(m => m.status === 'completed' || m.status === 'archived');
    } else {
      matchPool = allMatches.filter(m => m.season_id === seasonFilter && (m.status === 'completed' || m.status === 'archived'));
    }
    const matchIds     = matchPool.map(m => m.id);
    const playerMatchIds = getPlayerMatchIds(matchIds);
    const gp           = playerMatchIds.length;
    const scopeEvents  = allEvents.filter(e => e.player_id === id && !e.voided && playerMatchIds.includes(e.match_id));
    const { s, avg, eff } = computeAvg(scopeEvents, gp);

    return `
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--border);border-radius:8px;overflow:hidden;margin-bottom:14px">
        ${[['PTS',avg(s.pts)],['REB',avg(s.trb)],['AST',avg(s.ast)],['STL',avg(s.stl)],['BLK',avg(s.blk)]].map(([k,v])=>`
          <div style="background:var(--bg-elevated);padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:800;color:var(--accent-primary)">${v}</div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">${k}</div>
          </div>`).join('')}
      </div>

      <div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:8px;padding:12px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Efficiency (EFF)</div>
          <div style="font-size:10px;color:var(--text-muted)">PTS+REB+AST+STL+BLK−TOV−(FGA−FGM)−(FTA−FTM)</div>
        </div>
        <div style="font-size:32px;font-weight:800;color:${eff>=0?'var(--accent-success)':'var(--accent-danger)'}">${gp>0?(eff/gp).toFixed(1):'—'}</div>
      </div>

      <div class="tbl-wrap"><table>
        <thead><tr><th>Statistik</th><th style="text-align:right">Per Game</th><th style="text-align:right">Total</th><th style="text-align:right">%</th></tr></thead>
        <tbody>
          <tr><td style="color:var(--text-muted);font-size:11px;padding:6px 12px" colspan="4">SHOOTING</td></tr>
          <tr><td>Field Goals</td><td class="td-num">${avg(s.fgm)}/${avg(s.fga)}</td><td class="td-num">${s.fgm}/${s.fga}</td><td class="td-num">${fmtPct(s.fgPct)}</td></tr>
          <tr><td>2-Point</td><td class="td-num">${avg(s.pm2)}/${avg(s.pa2)}</td><td class="td-num">${s.pm2}/${s.pa2}</td><td class="td-num">${fmtPct(s.p2Pct)}</td></tr>
          <tr><td>3-Point</td><td class="td-num">${avg(s.pm3)}/${avg(s.pa3)}</td><td class="td-num">${s.pm3}/${s.pa3}</td><td class="td-num">${fmtPct(s.p3Pct)}</td></tr>
          <tr><td>Free Throw</td><td class="td-num">${avg(s.ftm)}/${avg(s.fta)}</td><td class="td-num">${s.ftm}/${s.fta}</td><td class="td-num">${fmtPct(s.ftPct)}</td></tr>
          <tr><td style="color:var(--text-muted);font-size:11px;padding:6px 12px" colspan="4">REBOUNDING & DEFENSE</td></tr>
          <tr><td>Off Rebound</td><td class="td-num">${avg(s.orb)}</td><td class="td-num">${s.orb}</td><td class="td-num">—</td></tr>
          <tr><td>Def Rebound</td><td class="td-num">${avg(s.drb)}</td><td class="td-num">${s.drb}</td><td class="td-num">—</td></tr>
          <tr><td>Total Rebound</td><td class="td-num">${avg(s.trb)}</td><td class="td-num">${s.trb}</td><td class="td-num">—</td></tr>
          <tr><td>Steals</td><td class="td-num">${avg(s.stl)}</td><td class="td-num">${s.stl}</td><td class="td-num">—</td></tr>
          <tr><td>Blocks</td><td class="td-num">${avg(s.blk)}</td><td class="td-num">${s.blk}</td><td class="td-num">—</td></tr>
          <tr><td style="color:var(--text-muted);font-size:11px;padding:6px 12px" colspan="4">PLAYMAKING</td></tr>
          <tr><td>Assists</td><td class="td-num">${avg(s.ast)}</td><td class="td-num">${s.ast}</td><td class="td-num">—</td></tr>
          <tr><td>Turnovers</td><td class="td-num" style="color:var(--accent-danger)">${avg(s.tov)}</td><td class="td-num">${s.tov}</td><td class="td-num">—</td></tr>
          <tr><td>Personal Fouls</td><td class="td-num" style="color:var(--accent-warning)">${avg(s.pf)}</td><td class="td-num">${s.pf}</td><td class="td-num">—</td></tr>
        </tbody>
      </table></div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:8px">GP: ${gp} pertandingan · Avg = total ÷ GP</div>`;
  }

  const initSeason = seasons[0]?.id || 'career';
  const initContent = renderStatsForScope(initSeason || 'career');

  const root = document.getElementById('modal-root');
  root.innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal" style="max-width:600px">
      <div class="modal-header">
        <div>
          <div class="modal-title">${player.name} — Stats</div>
          <div style="font-size:11px;color:var(--text-muted)">${player.position||''}${player.number?' · #'+player.number:''}</div>
        </div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <span style="font-size:12px;color:var(--text-muted);font-weight:600">Season:</span>
        <select class="form-select" id="stats-season-sel" onchange="refreshPlayerStatsView()" style="width:180px;font-size:13px">
          <option value="career">— Career (All) —</option>
          ${seasonOpts}
        </select>
      </div>
      <div id="stats-modal-body">${initContent}</div>
      <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Tutup</button></div>
    </div>
  </div>`;

  // Store context for refresh
  window._statsCtx = { id, allEvents, allMatches, allRosters, seasons, seasonMap, renderStatsForScope };
}

function refreshPlayerStatsView() {
  const sel = document.getElementById('stats-season-sel')?.value || 'career';
  const ctx = window._statsCtx;
  if (!ctx) return;
  document.getElementById('stats-modal-body').innerHTML = ctx.renderStatsForScope(sel);
}
