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
