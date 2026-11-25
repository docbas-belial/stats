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
