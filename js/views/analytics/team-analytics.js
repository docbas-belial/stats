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
