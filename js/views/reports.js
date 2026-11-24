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

// ============================================================
// ANALYTICS
// ============================================================
async function renderAnalytics() {
  const content = document.getElementById('content');
  const [matches, events] = await Promise.all([txGetAll('matches'), txGetAll('game_events')]);
  const completed = matches.filter(m=>m.status==='completed'||m.status==='archived');
  const validEvents = events.filter(e=>!e.voided);
  const teamName = await getSetting('team_name','My Team');
  
  if (!completed.length) {
    content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📈</div><div class="empty-state-title">No completed matches</div></div>`;
    return;
  }
  
  const ts = calcTeamBoxScore(validEvents,'home');
  const os = calcTeamBoxScore(validEvents,'away');
  const adv = calcAdvanced(ts, os, completed.length * 40);
  
  content.innerHTML = `
  <div class="grid-4" style="margin-bottom:16px">
    <div class="stat-tile stat-tile-accent">
      <div class="stat-tile-label">Off Rating</div>
      <div class="stat-tile-value">${adv.offRtg}</div>
      <div class="stat-tile-sub">Points per 100 poss.</div>
    </div>
    <div class="stat-tile" style="border-left:3px solid #ec4899">
      <div class="stat-tile-label">Def Rating</div>
      <div class="stat-tile-value">${adv.defRtg}</div>
      <div class="stat-tile-sub">Points allowed per 100</div>
    </div>
    <div class="stat-tile" style="border-left:3px solid #8b5cf6">
      <div class="stat-tile-label">Net Rating</div>
      <div class="stat-tile-value" style="color:${adv.netRtg!=='N/A'&&parseFloat(adv.netRtg)>=0?'#34d399':'#f87171'}">${adv.netRtg}</div>
      <div class="stat-tile-sub">Off − Def</div>
    </div>
    <div class="stat-tile" style="border-left:3px solid #f59e0b">
      <div class="stat-tile-label">Pace</div>
      <div class="stat-tile-value">${adv.pace}</div>
      <div class="stat-tile-sub">Possessions per 40 min</div>
    </div>
  </div>
  
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><span class="card-title">Shooting Efficiency</span></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Metric</th><th>Formula</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>FG%</td><td class="td-muted" style="font-size:11px">FGM/FGA</td><td class="td-num">${ts.fga>0?(ts.fgm/ts.fga*100).toFixed(1)+'%':'N/A'}</td></tr>
          <tr><td>2PT%</td><td class="td-muted" style="font-size:11px">2PM/2PA</td><td class="td-num">${ts.pa2>0?(ts.pm2/ts.pa2*100).toFixed(1)+'%':'N/A'}</td></tr>
          <tr><td>3PT%</td><td class="td-muted" style="font-size:11px">3PM/3PA</td><td class="td-num">${ts.pa3>0?(ts.pm3/ts.pa3*100).toFixed(1)+'%':'N/A'}</td></tr>
          <tr><td>FT%</td><td class="td-muted" style="font-size:11px">FTM/FTA</td><td class="td-num">${ts.fta>0?(ts.ftm/ts.fta*100).toFixed(1)+'%':'N/A'}</td></tr>
          <tr><td>eFG%</td><td class="td-muted" style="font-size:11px">(FGM+0.5×3PM)/FGA</td><td class="td-num">${adv.efgPct!=='N/A'?adv.efgPct+'%':'N/A'}</td></tr>
          <tr><td>TS%</td><td class="td-muted" style="font-size:11px">PTS/(2×(FGA+0.44×FTA))</td><td class="td-num">${adv.tsPct!=='N/A'?adv.tsPct+'%':'N/A'}</td></tr>
        </tbody>
      </table></div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Four Factors</span></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Factor</th><th>Home</th><th>Away</th></tr></thead>
        <tbody>
          <tr><td>Shooting (eFG%)</td>
            <td class="td-num">${ts.fga>0?((ts.fgm+0.5*ts.pm3)/ts.fga*100).toFixed(1)+'%':'N/A'}</td>
            <td class="td-num">${os.fga>0?((os.fgm+0.5*os.pm3)/os.fga*100).toFixed(1)+'%':'N/A'}</td>
          </tr>
          <tr><td>Turnover Rate</td>
            <td class="td-num">${adv.tovPct!=='N/A'?adv.tovPct+'%':'N/A'}</td>
            <td class="td-num">—</td>
          </tr>
          <tr><td>Off Reb% (ORB%)</td>
            <td class="td-num">${adv.orbPct!=='N/A'?adv.orbPct+'%':'N/A'}</td>
            <td class="td-num">—</td>
          </tr>
          <tr><td>FT Rate (FTA/FGA)</td>
            <td class="td-num">${adv.ftRate!=='N/A'?adv.ftRate:'N/A'}</td>
            <td class="td-num">${os.fga>0?(os.fta/os.fga).toFixed(3):'N/A'}</td>
          </tr>
        </tbody>
      </table></div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:8px">Four Factors: Shooting, Turnovers, Rebounding, Free Throws (Kubatko/Oliver, 2004). Possession estimates used for Rtg/Pace.</div>
    </div>
  </div>
  
  <div class="card" style="margin-top:16px">
    <div class="card-header"><span class="card-title">Game-by-Game Results</span></div>
    <div class="tbl-wrap">
      <table><thead><tr><th>Date</th><th>Opponent</th><th>Us</th><th>Opp</th><th>Diff</th><th>Result</th></tr></thead>
      <tbody>${completed.slice(-10).reverse().map(m=>{
        const diff = (m.home_score??0)-(m.away_score??0);
        const win = diff>0;
        return `<tr>
          <td>${m.date?.split('T')[0]||'—'}</td>
          <td>${m.opponent}</td>
          <td class="td-num" style="font-weight:700">${m.home_score??'—'}</td>
          <td class="td-num">${m.away_score??'—'}</td>
          <td class="td-num" style="color:${diff>0?'var(--accent-success)':'var(--accent-danger)'}">${diff>0?'+':''}${diff}</td>
          <td><span class="badge ${win?'badge-green':'badge-red'}">${win?'W':'L'}</span></td>
        </tr>`;
      }).join('')}</tbody></table>
    </div>
  </div>`;
}

// ============================================================
// PLAYER ANALYTICS
// ============================================================
// Pilihan kompetisi di Player Analytics: '__all__' = semua, '__none__' = pertandingan tanpa nama kompetisi
async function changeAnalyticsCompetition(value) {
  state.paCompetition = decodeURIComponent(value);
  await renderPlayerAnalytics();
}

async function renderPlayerAnalytics() {
  const content = document.getElementById('content');
  const [players, events, matches, rosters] = await Promise.all([
    txGetAll('players'), txGetAll('game_events'), txGetAll('matches'), txGetAll('match_rosters'),
  ]);
  const done = matches.filter(m => m.status === 'completed' || m.status === 'archived');

  if (!done.length) {
    content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏃</div><div class="empty-state-title">Belum ada pertandingan selesai</div></div>`;
    return;
  }

  // Daftar kompetisi (terbaru dulu, berdasarkan tanggal pertandingan terakhir)
  const lastDate = {};
  for (const m of done) {
    const k = m.competition || '__none__';
    lastDate[k] = Math.max(lastDate[k] || 0, new Date(m.date || 0).getTime());
  }
  const compKeys = Object.keys(lastDate).sort((a, b) => lastDate[b] - lastDate[a]);
  const compLabel = k => k === '__none__' ? '(Tanpa kompetisi)' : k;
  if (!state.paCompetition || (state.paCompetition !== '__all__' && !compKeys.includes(state.paCompetition))) {
    state.paCompetition = compKeys[0];   // default: kompetisi terbaru
  }
  const sel = state.paCompetition;

  const compMatches = done.filter(m => sel === '__all__' || (m.competition || '__none__') === sel);
  const matchIds = new Set(compMatches.map(m => m.id));
  const compEvents = events.filter(e => !e.voided && matchIds.has(e.match_id) && e.team === 'home');

  // Pemain yang ikut main di pertandingan kompetisi ini (roster atau punya event)
  const playedIds = new Set(compEvents.map(e => e.player_id).filter(Boolean));
  for (const r of rosters) if (matchIds.has(r.match_id)) playedIds.add(r.player_id);
  const rows = players.filter(p => playedIds.has(p.id)).map(p => ({ p, s: calcBoxScore(compEvents, p.id) }));
  rows.sort((a, b) => {
    const na = (a.p.number == null || a.p.number === '') ? Infinity : Number(a.p.number);
    const nb = (b.p.number == null || b.p.number === '') ? Infinity : Number(b.p.number);
    return na - nb || String(a.p.name).localeCompare(String(b.p.name));
  });
  const team = calcTeamBoxScore(compEvents, 'home');

  const pct  = (m, a) => a > 0 ? (m / a * 100).toFixed(1) + '%' : '—';
  const eff  = s => (s.pts + s.trb + s.ast + s.stl + s.blk) - (s.fga - s.fgm) - (s.fta - s.ftm) - s.tov;
  const efg  = s => s.fga > 0 ? ((s.fgm + 0.5 * s.pm3) / s.fga * 100).toFixed(1) + '%' : '—';
  const ts   = s => (s.fga + 0.44 * s.fta) > 0 ? (s.pts / (2 * (s.fga + 0.44 * s.fta)) * 100).toFixed(1) + '%' : '—';
  const cells = s => `
    <td class="td-num" style="font-weight:700;color:var(--text-primary)">${s.pts}</td>
    <td class="td-num">${s.fgm}</td><td class="td-num">${s.fga}</td><td class="td-num">${pct(s.fgm, s.fga)}</td>
    <td class="td-num">${s.pm2}</td><td class="td-num">${s.pa2}</td><td class="td-num">${pct(s.pm2, s.pa2)}</td>
    <td class="td-num">${s.pm3}</td><td class="td-num">${s.pa3}</td><td class="td-num">${pct(s.pm3, s.pa3)}</td>
    <td class="td-num">${s.ftm}</td><td class="td-num">${s.fta}</td><td class="td-num">${pct(s.ftm, s.fta)}</td>
    <td class="td-num">${s.orb}</td><td class="td-num">${s.drb}</td><td class="td-num" style="font-weight:600">${s.trb}</td>
    <td class="td-num">${s.ast}</td>
    <td class="td-num" style="color:var(--accent-danger)">${s.tov}</td>
    <td class="td-num">${s.stl}</td><td class="td-num">${s.blk}</td>
    <td class="td-num" style="color:var(--accent-warning)">${s.pf}</td>
    <td class="td-num" style="font-weight:700;color:${eff(s) >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}">${eff(s)}</td>
    <td class="td-num">${efg(s)}</td><td class="td-num">${ts(s)}</td>`;

  content.innerHTML = `
  <div class="card">
    <div class="card-header" style="flex-wrap:wrap;gap:8px">
      <span class="card-title">Player Analytics — Total Kompetisi</span>
      <select class="form-select" onchange="changeAnalyticsCompetition(this.value)" style="width:auto;min-width:220px;font-size:13px">
        ${compKeys.map(k => `<option value="${encodeURIComponent(k)}" ${k === sel ? 'selected' : ''}>${compLabel(k)}</option>`).join('')}
        <option value="${encodeURIComponent('__all__')}" ${sel === '__all__' ? 'selected' : ''}>Semua kompetisi</option>
      </select>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">
      ${compMatches.length} pertandingan · ${rows.length} pemain · urut nomor punggung
    </div>
    ${rows.length ? `
    <div class="tbl-wrap"><table class="bs-tbl">
      <thead><tr>
        <th>#</th><th class="col-name">Player</th>
        <th>PTS</th><th>FG M</th><th>FG A</th><th>FG%</th>
        <th>2PT M</th><th>2PT A</th><th>2PT%</th>
        <th>3PT M</th><th>3PT A</th><th>3PT%</th>
        <th>FT M</th><th>FT A</th><th>FT%</th>
        <th>ORB</th><th>DRB</th><th>REB</th>
        <th>AST</th><th>TOV</th><th>STL</th><th>BLK</th><th>PF</th>
        <th>EFF</th><th>EFG %</th><th>TS %</th>
      </tr></thead>
      <tbody>${rows.map(({ p, s }) => `
        <tr>
          <td style="font-weight:700;color:var(--accent-secondary)">${p.number ?? '—'}</td>
          <td class="col-name" style="font-weight:600;white-space:nowrap">${p.name}</td>
          ${cells(s)}
        </tr>`).join('')}
      </tbody>
      <tfoot style="background:var(--bg-elevated)">
        <tr style="font-weight:700;color:var(--accent-primary)">
          <td colspan="2" class="col-name">TEAM TOTAL</td>
          ${cells(team)}
        </tr>
      </tfoot>
    </table></div>` : `<div class="empty-state"><div class="empty-state-title">Belum ada statistik pemain di kompetisi ini</div></div>`}
    <div style="font-size:11px;color:var(--text-muted);margin-top:8px;line-height:1.6">
      Total seluruh pertandingan selesai dalam kompetisi terpilih. —&nbsp;= belum ada percobaan tembakan.<br>
      EFF = (PTS+REB+AST+STL+BLK) − (FG miss + FT miss + TOV) · EFG% = (FGM + 0.5×3PM) / FGA · TS% = PTS / (2 × (FGA + 0.44×FTA))
    </div>
  </div>`;
}

// ============================================================
// HISTORY
// ============================================================
async function renderHistory() {
  const content = document.getElementById('content');
  const [matches, seasons] = await Promise.all([txGetAll('matches'), txGetAll('seasons')]);
  const seasonMap = Object.fromEntries(seasons.map(s => [s.id, s.name]));
  const sorted    = [...matches].sort((a,b) => new Date(b.date||0) - new Date(a.date||0));

  content.innerHTML = `
  <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
    <input class="input-search" id="hist-search" placeholder="Search opponent / competition…" oninput="filterHistory()" style="width:200px">
    <select class="form-select" id="hist-season" onchange="filterHistory()" style="width:150px">
      <option value="">All Seasons</option>
      ${seasons.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
    </select>
    <select class="form-select" id="hist-cat" onchange="filterHistory()" style="width:140px">
      <option value="">All Categories</option>
      <option value="regular">Regular Season</option>
      <option value="friendly">Friendly</option>
      <option value="playoff">Playoff</option>
      <option value="tournament">Tournament</option>
    </select>
    <select class="form-select" id="hist-result" onchange="filterHistory()" style="width:110px">
      <option value="">All Results</option>
      <option value="W">Wins</option>
      <option value="L">Losses</option>
    </select>
    <select class="form-select" id="hist-sort" onchange="filterHistory()" style="width:140px">
      <option value="date-desc">Terbaru dulu</option>
      <option value="date-asc">Terlama dulu</option>
      <option value="score-desc">Skor tertinggi</option>
    </select>
  </div>
  <div id="hist-count" style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${sorted.length} pertandingan</div>
  <div id="history-table" class="tbl-wrap">
    ${renderHistoryTable(sorted, seasonMap)}
  </div>`;
  window._histMatches   = sorted;
  window._histSeasonMap = seasonMap;
}

function renderHistoryTable(matches, seasonMap) {
  if (!matches.length) return '<div class="empty-state"><div class="empty-state-title">No matches found</div></div>';
  const catBadge = { regular:'badge-blue', friendly:'badge-gray', playoff:'badge-yellow', tournament:'badge-yellow' };
  return `<table><thead><tr>
    <th>Date</th><th>Opponent</th><th>Competition</th><th>Category</th><th>Season</th><th>Score</th><th>Result</th><th>Status</th><th>Actions</th>
  </tr></thead><tbody>${matches.map(m => {
    const win  = m.home_score != null && m.away_score != null && m.home_score > m.away_score;
    const loss = m.home_score != null && m.away_score != null && m.home_score < m.away_score;
    return `<tr>
      <td style="white-space:nowrap">${m.date?.split('T')[0]||'—'}</td>
      <td style="font-weight:600">${m.opponent||'—'}</td>
      <td class="td-muted">${m.competition||'—'}</td>
      <td><span class="badge ${catBadge[m.category]||'badge-gray'}" style="font-size:10px">${m.category||'—'}</span></td>
      <td class="td-muted">${seasonMap[m.season_id]||'—'}</td>
      <td class="td-num" style="font-weight:700">${m.home_score??'—'}–${m.away_score??'—'}</td>
      <td>${m.status==='completed'||m.status==='archived'
        ? `<span class="badge ${win?'badge-green':loss?'badge-red':'badge-gray'}">${win?'W':loss?'L':'D'}</span>` : '—'}</td>
      <td><span class="badge ${m.status==='live'?'badge-red':m.status==='completed'?'badge-green':m.status==='scheduled'?'badge-blue':'badge-gray'}">${m.status}</span></td>
      <td><div style="display:flex;gap:3px;flex-wrap:wrap">
        <button class="btn btn-sm" style="background:rgba(245,158,11,.15);color:#fbbf24;border:1px solid rgba(245,158,11,.3)" onclick="showManualStatsModal('${m.id}')" title="Stats">📝</button>
        ${m.status==='completed'||m.status==='live' ? `<button class="btn btn-secondary btn-sm" onclick="viewBoxScore('${m.id}')">Box</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="showNewMatchModal('${m.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteMatch('${m.id}','${(m.opponent||'').replace(/'/g,"\\'")}','${m.date?.split('T')[0]||''}')" title="Hapus">🗑</button>
      </div></td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

async function filterHistory() {
  const search = (document.getElementById('hist-search')?.value  || '').toLowerCase();
  const season = document.getElementById('hist-season')?.value   || '';
  const cat    = document.getElementById('hist-cat')?.value      || '';
  const result = document.getElementById('hist-result')?.value   || '';
  const sort   = document.getElementById('hist-sort')?.value     || 'date-desc';

  let matches = window._histMatches || [];
  if (search)       matches = matches.filter(m => (m.opponent||'').toLowerCase().includes(search) || (m.competition||'').toLowerCase().includes(search));
  if (season)       matches = matches.filter(m => m.season_id === season);
  if (cat)          matches = matches.filter(m => m.category === cat);
  if (result==='W') matches = matches.filter(m => m.home_score != null && m.home_score > m.away_score);
  if (result==='L') matches = matches.filter(m => m.home_score != null && m.home_score < m.away_score);

  if (sort === 'date-asc')      matches = [...matches].sort((a,b) => new Date(a.date||0) - new Date(b.date||0));
  else if (sort === 'date-desc') matches = [...matches].sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
  else if (sort === 'score-desc') matches = [...matches].sort((a,b) => (b.home_score||0) - (a.home_score||0));

  document.getElementById('history-table').innerHTML = renderHistoryTable(matches, window._histSeasonMap || {});
  const el = document.getElementById('hist-count');
  if (el) el.textContent = `${matches.length} pertandingan`;
}

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

// ============================================================
// BACKUP & RESTORE
// ============================================================
async function renderBackup() {
  const content = document.getElementById('content');
  const actionsEl = document.getElementById('topbar-actions');
  actionsEl.innerHTML = `<button class="btn btn-primary" onclick="createManualBackup()">💾 Backup Now</button>`;
  
  const backups = await txGetAll('backup_history');
  backups.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const lastBackup = await getSetting('last_backup');
  
  const isOPFSAvailable = 'storage' in navigator && 'getDirectory' in navigator.storage;
  const isFSAAvailable = 'showSaveFilePicker' in window;
  
  content.innerHTML = `
  <div class="grid-2" style="margin-bottom:16px">
    <div class="card">
      <div class="card-header"><span class="card-title">Backup Status</span></div>
      <div style="font-size:13px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span class="text-muted">Last Backup</span>
          <span style="font-weight:600">${lastBackup ? new Date(lastBackup).toLocaleString() : 'Never'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span class="text-muted">Total Backups</span>
          <span style="font-weight:600">${backups.length}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span class="text-muted">Storage Engine</span>
          <span style="font-weight:600">localStorage (In-memory + Persistent)</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span class="text-muted">OPFS Available</span>
          <span class="${isOPFSAvailable?'text-success':'text-warning'};font-weight:600">${isOPFSAvailable ? '✓ Yes' : '⚠ No (requires HTTPS)'}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span class="text-muted">File System API</span>
          <span class="${isFSAAvailable?'text-success':'text-warning'};font-weight:600">${isFSAAvailable ? '✓ Yes' : '⚠ No'}</span>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Actions</span></div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-primary" onclick="createManualBackup()">💾 Create Backup Now</button>
        <button class="btn btn-secondary" onclick="restoreFromFile()">📂 Restore from File</button>
        <button class="btn btn-secondary" onclick="exportAllJSON()">📦 Export Full JSON</button>
        <button class="btn btn-secondary" onclick="backupAsText()">📋 Backup sebagai Teks</button>
        <button class="btn btn-secondary" onclick="restoreFromText()">📝 Restore dari Teks</button>
      </div>
      <div style="margin-top:12px;padding:10px;background:var(--bg-elevated);border-radius:var(--radius-sm);font-size:11px;color:var(--text-muted)">
        <strong style="color:var(--accent-warning)">⚠ Important:</strong> Backups are downloaded as JSON files. 
        Store them in a safe location (external drive, cloud storage). 
        Data persists in IndexedDB across browser sessions, but clearing browser data will erase it.
        Always keep external backups for long-term data safety.
      </div>
    </div>
  </div>
  
  <div class="card">
    <div class="card-header"><span class="card-title">Backup History</span></div>
    ${backups.length ? `<div class="tbl-wrap"><table>
      <thead><tr><th>Date</th><th>Type</th><th>Matches</th><th>Players</th><th>Events</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${backups.slice(0,20).map(b=>`
        <tr>
          <td>${new Date(b.created_at).toLocaleString()}</td>
          <td><span class="badge badge-blue">${b.type||'manual'}</span></td>
          <td class="td-num">${b.match_count||0}</td>
          <td class="td-num">${b.player_count||0}</td>
          <td class="td-num">${b.event_count||0}</td>
          <td><span class="badge ${b.verified?'badge-green':'badge-gray'}">${b.verified?'Verified':'Unverified'}</span></td>
          <td><button class="btn btn-secondary btn-sm" onclick="redownloadBackup('${b.id}')">⬇ Download</button></td>
        </tr>
      `).join('')}</tbody>
    </table></div>` : '<div class="text-muted" style="text-align:center;padding:20px;font-size:13px">No backup history yet. Create your first backup.</div>'}
  </div>`;
}

async function createManualBackup() {
  await createBackup('manual');
}

async function createAutoBackup(type = 'auto') {
  await createBackup(type);
}

async function createBackup(type = 'manual') {
  const data = {};
  for (const store of Object.keys(STORES)) {
    data[store] = await txGetAll(store);
  }
  const id = uuid();
  const manifest = {
    backup_id: id,
    type,
    created_at: now(),
    app_version: '1.0.0',
    schema_version: SCHEMA_VERSION,
    match_count: data.matches?.length||0,
    player_count: data.players?.length||0,
    event_count: data.game_events?.length||0,
    verified: true,
  };
  const backup = { manifest, data };
  const json = JSON.stringify(backup, null, 2);
  
  // Record in history
  await txPut('backup_history', { id, ...manifest });
  await setSetting('last_backup', manifest.created_at);
  
  // Download file
  downloadFile(`bsm_backup_${type}_${manifest.created_at.split('T')[0]}.json`, json, 'application/json');
  
  toast(`Backup created (${manifest.match_count} matches, ${manifest.event_count} events)`, 'success');
  updateStatusBar();
  
  if (state.currentPage === 'backup') await renderBackup();
}

async function redownloadBackup(id) {
  const record = await txGet('backup_history', id);
  if (!record) { toast('Backup record not found', 'error'); return; }
  // Re-create the data snapshot from current DB (backup record itself just has manifest)
  await createBackup('redownload');
}

async function applyBackup(backup) {
  if (!backup || !backup.manifest || !backup.data) throw new Error('File backup tidak valid (manifest/data tidak ada)');
  if (backup.manifest.schema_version > SCHEMA_VERSION) throw new Error('Versi schema backup lebih baru dari app');
  // Safety snapshot (localStorage only, best-effort)
  try { localStorage.setItem('bsm_pre_restore', JSON.stringify(_mem)); } catch (e) {}
  for (const [storeName, records] of Object.entries(backup.data)) {
    if (!STORES[storeName]) continue;
    await txClear(storeName);
    if (records && records.length) await txMultiPut(storeName, records);
  }
  _persistNow();
  const m = backup.manifest;
  await audit('system', 'restore', 'restore', { backup_id: m.backup_id, source_date: m.created_at });
  toast(`Restored: ${m.match_count ?? '?'} matches, ${m.player_count ?? '?'} players`, 'success');
  await updateStatusBar();
  await navigate('dashboard');
}

function confirmRestore(backup) {
  const m = backup && backup.manifest;
  if (!m || !backup.data) { toast('File backup tidak valid', 'error'); return; }
  showModal('Restore Backup',
    `<p style="font-size:13px;line-height:1.6">Backup tanggal <strong>${new Date(m.created_at).toLocaleString()}</strong><br>
     ${m.match_count ?? 0} matches, ${m.player_count ?? 0} players, ${m.event_count ?? 0} events.<br><br>
     <span style="color:var(--accent-warning)">Semua data saat ini akan DIGANTI.</span></p>`,
    async () => {
      closeModal();
      try { await applyBackup(backup); }
      catch (err) { toast('Restore gagal: ' + err.message, 'error'); console.error(err); }
    }, 'Restore');
}

async function restoreFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      confirmRestore(JSON.parse(await file.text()));
    } catch (err) {
      toast('Restore gagal: ' + err.message, 'error');
      console.error(err);
    }
  };
  input.click();
}

async function backupAsText() {
  const data = {};
  for (const store of Object.keys(STORES)) data[store] = await txGetAll(store);
  const manifest = {
    backup_id: uuid(), type: 'text', created_at: now(), app_version: '1.0.0',
    schema_version: SCHEMA_VERSION,
    match_count: data.matches.length, player_count: data.players.length,
    event_count: data.game_events.length, verified: true,
  };
  const json = JSON.stringify({ manifest, data });
  showModal('Backup sebagai Teks',
    `<p style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Tekan Copy, lalu tempel ke Notes / chat / email ke diri sendiri. Gunakan ini kalau tombol download tidak berfungsi.</p>
     <textarea id="bk-text" readonly style="width:100%;height:160px;font-size:11px;font-family:monospace">${json.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</textarea>`,
    () => {
      const ta = document.getElementById('bk-text');
      ta.select(); ta.setSelectionRange(0, ta.value.length);
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      toast(ok ? 'Backup disalin ke clipboard' : 'Salin manual: teks sudah terpilih, tekan Copy di keyboard', ok ? 'success' : 'info');
    }, 'Copy');
}

function restoreFromText() {
  showModal('Restore dari Teks',
    `<p style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Tempel isi backup JSON di sini.</p>
     <textarea id="rs-text" style="width:100%;height:160px;font-size:11px;font-family:monospace" placeholder='{"manifest":...}'></textarea>`,
    () => {
      const raw = document.getElementById('rs-text').value.trim();
      try { const b = JSON.parse(raw); closeModal(); confirmRestore(b); }
      catch (err) { toast('Teks bukan JSON backup yang valid', 'error'); }
    }, 'Lanjut');
}

// ============================================================
// SETTINGS
// ============================================================
async function renderSettings() {
  const content = document.getElementById('content');
  const teamName = await getSetting('team_name','My Team');
  const autoBackup = await getSetting('auto_backup', true);
  
  content.innerHTML = `
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><span class="card-title">Team Settings</span></div>
      <div class="form-group">
        <label class="form-label">Team Name</label>
        <input class="form-input" id="setting-team-name" value="${teamName}" placeholder="Your team name">
      </div>
      <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">System Information</span></div>
      <div style="font-size:13px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between"><span class="text-muted">App Version</span><span style="font-weight:600">1.0.0</span></div>
        <div style="display:flex;justify-content:space-between"><span class="text-muted">Schema Version</span><span style="font-weight:600">${SCHEMA_VERSION}</span></div>
        <div style="display:flex;justify-content:space-between"><span class="text-muted">Storage Engine</span><span style="font-weight:600">localStorage</span></div>
        <div style="display:flex;justify-content:space-between"><span class="text-muted">Browser</span><span style="font-weight:600">${navigator.userAgent.split(' ').slice(-1)[0]}</span></div>
      </div>
    </div>
  </div>
  
  <div class="card" style="margin-top:16px">
    <div class="card-header"><span class="card-title">Danger Zone</span></div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-weight:600;color:var(--text-primary)">Reset All Data</div>
          <div style="font-size:12px;color:var(--text-muted)">Permanently delete all matches, players, and stats. Cannot be undone.</div>
        </div>
        <button class="btn btn-danger" onclick="resetAllData()">Reset Database</button>
      </div>
    </div>
  </div>
  
  <div class="card" style="margin-top:16px">
    <div class="card-header"><span class="card-title">About Storage</span></div>
    <div style="font-size:12px;color:var(--text-secondary);line-height:1.8">
      <p><strong>Storage saat ini:</strong> In-memory + localStorage. Data tersimpan otomatis setiap ada perubahan.</p>
      <p><strong>Keamanan data:</strong> Data bertahan selama browser storage tidak dihapus. <strong>Buat backup JSON rutin</strong> via halaman Backup & Restore dan simpan di tempat aman.</p>
      <p style="margin-top:8px"><strong>⚠ Batas localStorage:</strong> ~5–10 MB per domain. Untuk penggunaan jangka panjang, gunakan Export JSON berkala.</p>
      <p style="margin-top:8px"><strong>Deployment produksi:</strong> Deploy sebagai PWA di server lokal untuk menggunakan SQLite WASM + OPFS dengan kapasitas penyimpanan lebih besar.</p>
    </div>
  </div>`;
}

async function saveSettings() {
  const name = document.getElementById('setting-team-name')?.value?.trim();
  if (name) await setSetting('team_name', name);
  toast('Settings saved', 'success');
}

async function resetAllData() {
  if (!confirm('RESET ALL DATA? This deletes every match, player, event, and stat. This cannot be undone.\n\nType DELETE to confirm.')) return;
  const input = prompt('Type DELETE to confirm:');
  if (input !== 'DELETE') { toast('Reset cancelled', 'info'); return; }
  await createBackup('pre_reset');
  for (const store of Object.keys(STORES)) await txClear(store);
  toast('All data reset. A pre-reset backup was created.', 'success');
  await navigate('dashboard');
}
