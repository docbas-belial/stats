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
