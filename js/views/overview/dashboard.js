// ============================================================
// DASHBOARD
// ============================================================
async function changeDashboardFilter(type, value) {
  if (type === 'season') state.dashSeason = value;
  if (type === 'team') state.dashTeam = value;
  await renderDashboard();
}

async function clearDashboardFilters() {
  state.dashSeason = '';
  state.dashTeam = '';
  await renderDashboard();
}

async function renderDashboard() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div> Loading…</div>';
  
  const [matches, players, seasons] = await Promise.all([
    txGetAll('matches'), txGetAll('players'), txGetAll('seasons'),
  ]);

  seasons.sort((a,b) => (b.start_year || 0) - (a.start_year || 0));
  const seasonMap = Object.fromEntries(seasons.map(s => [s.id, s.name]));

  // Unique opponent teams from matches
  const allOpponents = [...new Set(matches.map(m => m.opponent).filter(Boolean))].sort((a,b) => a.localeCompare(b));

  const allCompleted = matches.filter(m => m.status === 'completed' || m.status === 'archived');
  
  // Filter by season and team (opponent) if selected
  let filtered = allCompleted;
  if (state.dashSeason) {
    filtered = filtered.filter(m => m.season_id === state.dashSeason);
  }
  if (state.dashTeam) {
    filtered = filtered.filter(m => m.opponent === state.dashTeam);
  }

  const wins = filtered.filter(m => (m.home_score || 0) > (m.away_score || 0));
  const losses = filtered.filter(m => (m.home_score || 0) <= (m.away_score || 0) && m.home_score !== null && m.away_score !== null);
  const avgPts = filtered.length ? (filtered.reduce((a,m)=>a+(m.home_score||0),0)/filtered.length).toFixed(1) : 'N/A';
  const avgOpp = filtered.length ? (filtered.reduce((a,m)=>a+(m.away_score||0),0)/filtered.length).toFixed(1) : 'N/A';
  const avgDiff = (avgPts !== 'N/A' && avgOpp !== 'N/A') ? (parseFloat(avgPts)-parseFloat(avgOpp)).toFixed(1) : 'N/A';
  const winRate = filtered.length ? (wins.length/filtered.length*100).toFixed(0)+'%' : 'N/A';
  
  // Last 5 matches from filtered results
  const sortedFiltered = [...filtered].sort((a,b) => new Date(a.date||0) - new Date(b.date||0));
  const last5 = sortedFiltered.slice(-5).reverse();
  
  // Advanced rating stats computed for filtered matches
  let offRtg='N/A', defRtg='N/A', netRtg='N/A';
  if (filtered.length > 0) {
    const allEvents = await txGetAll('game_events');
    const matchIdSet = new Set(filtered.map(m => m.id));
    const relevantEvents = allEvents.filter(e => matchIdSet.has(e.match_id) && !e.voided);
    if (relevantEvents.length > 0) {
      const homeEvents = relevantEvents.filter(e => e.team === 'home');
      const awayEvents = relevantEvents.filter(e => e.team === 'away');
      const ts = calcTeamBoxScore(homeEvents, 'home');
      const os = calcTeamBoxScore(awayEvents, 'away');
      const adv = calcAdvanced(ts, os);
      offRtg = adv.offRtg; defRtg = adv.defRtg; netRtg = adv.netRtg;
    }
  }
  
  const activePlayers = players.filter(p => p.status === 'active');
  const lastBackup = await getSetting('last_backup');
  const teamName = await getSetting('team_name', 'My Team');

  // Filter badge text
  let filterBadge = 'All Matches';
  if (state.dashSeason && state.dashTeam) {
    filterBadge = `${seasonMap[state.dashSeason] || 'Season'} · vs ${state.dashTeam}`;
  } else if (state.dashSeason) {
    filterBadge = `${seasonMap[state.dashSeason] || 'Season'} Stats`;
  } else if (state.dashTeam) {
    filterBadge = `vs ${state.dashTeam}`;
  }

  content.innerHTML = `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
    <div>
      <div style="font-size:24px;font-weight:800;color:var(--text-primary)">${teamName}</div>
      <div style="color:var(--text-muted);font-size:13px">
        ${filtered.length}${filtered.length !== allCompleted.length ? ` of ${allCompleted.length}` : ''} matches recorded · ${activePlayers.length} active players
      </div>
    </div>
    
    <!-- Filter Bar: Season & Team Dropdowns -->
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:6px">
        <label for="dash-season-filter" style="font-size:12px;font-weight:600;color:var(--text-muted)">Season:</label>
        <select class="form-select" id="dash-season-filter" onchange="changeDashboardFilter('season', this.value)" style="width:auto;min-width:140px;padding:6px 12px;font-size:13px">
          <option value="">All Seasons</option>
          ${seasons.map(s => `<option value="${s.id}" ${state.dashSeason === s.id ? 'selected' : ''}>${s.name}${s.is_current ? ' (Current)' : ''}</option>`).join('')}
        </select>
      </div>

      <div style="display:flex;align-items:center;gap:6px">
        <label for="dash-team-filter" style="font-size:12px;font-weight:600;color:var(--text-muted)">Team:</label>
        <select class="form-select" id="dash-team-filter" onchange="changeDashboardFilter('team', this.value)" style="width:auto;min-width:150px;padding:6px 12px;font-size:13px">
          <option value="">All Opponents</option>
          ${allOpponents.map(opp => `<option value="${opp.replace(/"/g, '&quot;')}" ${state.dashTeam === opp ? 'selected' : ''}>${opp}</option>`).join('')}
        </select>
      </div>

      ${(state.dashSeason || state.dashTeam) ? `
        <button class="btn btn-secondary btn-sm" onclick="clearDashboardFilters()" style="padding:6px 10px;font-size:12px" title="Reset filter">✕ Reset</button>
      ` : ''}

      <div class="quarter-badge" style="font-size:13px;padding:6px 14px">${filterBadge}</div>
    </div>
  </div>
  
  <div class="grid-4" style="margin-bottom:16px">
    <div class="stat-tile stat-tile-accent">
      <div class="stat-tile-label">Record</div>
      <div class="stat-tile-value">${wins.length}–${losses.length}</div>
      <div class="stat-tile-sub">Win Rate: ${winRate}</div>
    </div>
    <div class="stat-tile stat-tile-success">
      <div class="stat-tile-label">Avg Points</div>
      <div class="stat-tile-value">${avgPts}</div>
      <div class="stat-tile-sub">Opp: ${avgOpp} · Diff: ${avgDiff}</div>
    </div>
    <div class="stat-tile" style="border-left:3px solid #8b5cf6">
      <div class="stat-tile-label">Off Rating</div>
      <div class="stat-tile-value" style="color:#a78bfa">${offRtg}</div>
      <div class="stat-tile-sub">Points per 100 possessions</div>
    </div>
    <div class="stat-tile" style="border-left:3px solid #ec4899">
      <div class="stat-tile-label">Net Rating</div>
      <div class="stat-tile-value" style="color:${netRtg!=='N/A' && parseFloat(netRtg)>=0 ? '#34d399':'#f87171'}">${netRtg}</div>
      <div class="stat-tile-sub">Off ${offRtg} · Def ${defRtg}</div>
    </div>
  </div>
  
  <div class="grid-2" style="margin-bottom:16px">
    <div class="card">
      <div class="card-header"><span class="card-title">Last 5 Matches</span></div>
      ${last5.length === 0 ? '<div class="text-muted" style="font-size:13px;text-align:center;padding:20px">No matches found for the selected filter</div>' :
        `<div>${last5.map(m=>{
          const win = (m.home_score || 0) > (m.away_score || 0);
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-subtle)">
            <div>
              <div style="font-size:13px;font-weight:600">${m.opponent}</div>
              <div style="font-size:11px;color:var(--text-muted)">${m.date ? m.date.split('T')[0] : ''} · ${m.competition||'—'}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <div style="font-size:15px;font-weight:700;font-variant-numeric:tabular-nums">${m.home_score??'—'}–${m.away_score??'—'}</div>
              <span class="badge ${win?'badge-green':'badge-red'}">${win?'W':'L'}</span>
            </div>
          </div>`;
        }).join('')}</div>`
      }
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Quick Actions</span></div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-primary btn-lg" onclick="navigate('live')" style="width:100%;justify-content:center">🔴 Start Live Game</button>
        <button class="btn btn-secondary" onclick="showNewMatchModal()" style="width:100%;justify-content:center">➕ Schedule Match</button>
        <button class="btn btn-secondary" onclick="navigate('matches')" style="width:100%;justify-content:center">📝 Input Stats Manual</button>
        <button class="btn btn-secondary" onclick="navigate('players')" style="width:100%;justify-content:center">👤 Manage Players</button>
        <button class="btn btn-secondary" onclick="navigate('reports')" style="width:100%;justify-content:center">📤 Export Data</button>
      </div>
    </div>
  </div>
  
  <div class="card">
    <div class="card-header">
      <span class="card-title">System Status</span>
      <span class="badge badge-green">Operational</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;font-size:12px">
      <div><div class="text-muted">Database</div><div style="font-weight:600">IndexedDB (Persistent)</div></div>
      <div><div class="text-muted">Last Backup</div><div style="font-weight:600">${lastBackup ? new Date(lastBackup).toLocaleDateString() : 'Never'}</div></div>
      <div><div class="text-muted">Total Players</div><div style="font-weight:600">${players.length} (${activePlayers.length} active)</div></div>
    </div>
  </div>`;
}
