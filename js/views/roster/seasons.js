// ============================================================
// SEASONS
// ============================================================
async function renderSeasons() {
  const content = document.getElementById('content');
  document.getElementById('topbar-actions').innerHTML = `<button class="btn btn-primary" onclick="showSeasonModal()">+ Add Season</button>`;
  const seasons = await txGetAll('seasons');
  seasons.sort((a,b) => b.start_year - a.start_year);

  // Count matches per season
  const allMatches = await txGetAll('matches');
  const matchCount = {};
  for (const m of allMatches) {
    if (m.season_id) matchCount[m.season_id] = (matchCount[m.season_id] || 0) + 1;
  }

  content.innerHTML = `
  <div class="grid-auto">
    ${seasons.length ? seasons.map(s => {
      const mc = matchCount[s.id] || 0;
      const wins = allMatches.filter(m => m.season_id === s.id && m.home_score != null && m.home_score > m.away_score).length;
      const losses = allMatches.filter(m => m.season_id === s.id && m.home_score != null && m.home_score < m.away_score).length;
      return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div style="font-size:16px;font-weight:700">${s.name}</div>
          <span class="badge ${s.is_current?'badge-green':'badge-gray'}">${s.is_current?'Current':s.status||'Past'}</span>
        </div>
        <div class="text-muted" style="font-size:12px;margin-bottom:4px">${s.start_year||'?'}–${s.end_year||'?'}</div>
        ${s.description ? `<div class="text-muted" style="font-size:12px;margin-bottom:4px">${s.description}</div>` : ''}
        <div style="display:flex;gap:12px;font-size:12px;margin-bottom:12px">
          <span style="color:var(--text-secondary)">${mc} match${mc!==1?'es':''}</span>
          ${mc > 0 ? `<span class="text-success">${wins}W</span><span class="text-danger">${losses}L</span>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="showSeasonModal('${s.id}')">Edit</button>
          ${!s.is_current ? `<button class="btn btn-success btn-sm" onclick="setCurrentSeason('${s.id}')">Set Current</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="deleteSeason('${s.id}','${s.name.replace(/'/g,"\\'")}',${mc})">🗑 Hapus</button>
        </div>
      </div>`;
    }).join('') : `<div class="empty-state">
      <div class="empty-state-icon">📅</div>
      <div class="empty-state-title">No seasons yet</div>
      <div>Create your first season to organize matches.</div>
      <button class="btn btn-primary" style="margin-top:12px" onclick="showSeasonModal()">Add Season</button>
    </div>`}
  </div>`;
}

async function showSeasonModal(id = null) {
  let s = id ? await txGet('seasons', id) : null;
  showModal(`${id ? 'Edit' : 'Add'} Season`, `
    <div class="form-group"><label class="form-label">Season Name *</label>
      <input class="form-input" id="s-name" value="${s?.name||''}" placeholder="e.g. 2024/2025"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Start Year</label>
        <input class="form-input" id="s-start" type="number" value="${s?.start_year||new Date().getFullYear()}"></div>
      <div class="form-group"><label class="form-label">End Year</label>
        <input class="form-input" id="s-end" type="number" value="${s?.end_year||''}"></div>
    </div>
    <div class="form-group"><label class="form-label">Description</label>
      <input class="form-input" id="s-desc" value="${s?.description||''}" placeholder="Optional"></div>
    <div class="form-group" style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="s-current" ${s?.is_current?'checked':''}>
      <label class="form-label" for="s-current" style="margin:0">Mark as current season</label>
    </div>
  `, async () => {
    const name = document.getElementById('s-name').value.trim();
    if (!name) { toast('Season name required', 'error'); return false; }
    const isCurrent = document.getElementById('s-current').checked;
    if (isCurrent) {
      const all = await txGetAll('seasons');
      for (const s2 of all) { if (s2.id !== id) { s2.is_current = false; await txPut('seasons', s2); } }
    }
    await txPut('seasons', {
      id: id || uuid(), name,
      start_year: parseInt(document.getElementById('s-start').value) || null,
      end_year:   parseInt(document.getElementById('s-end').value)   || null,
      description: document.getElementById('s-desc').value,
      is_current: isCurrent,
      created_at: s?.created_at || now(),
      updated_at: now(),
    });
    toast(`Season ${id ? 'updated' : 'created'}`, 'success');
    closeModal();
    await renderSeasons();
  });
}

async function setCurrentSeason(id) {
  const all = await txGetAll('seasons');
  for (const s of all) { s.is_current = (s.id === id); await txPut('seasons', s); }
  toast('Current season updated', 'success');
  await renderSeasons();
}

async function deleteSeason(id, name, matchCount) {
  const hasMatches = matchCount > 0;
  const confirmMsg = hasMatches
    ? `Hapus season "${name}"?\n\n⚠ Season ini memiliki ${matchCount} match. Match-match tersebut TIDAK akan dihapus — hanya kaitannya dengan season ini yang akan dihilangkan (season_id → null).\n\nLanjut?`
    : `Hapus season "${name}"? Tindakan ini tidak dapat dibatalkan.`;

  if (!confirm(confirmMsg)) return;

  // Unlink matches from this season (don't delete the match data)
  if (hasMatches) {
    const matches = await txGetAll('matches', 'season_id', id);
    for (const m of matches) {
      m.season_id = null;
      m.updated_at = now();
      await txPut('matches', m);
    }
  }

  await txDelete('seasons', id);
  await audit('season', id, 'delete', { name, match_count: matchCount });
  toast(`Season "${name}" dihapus${hasMatches ? ` (${matchCount} match di-unlink)` : ''}`, 'success');
  await renderSeasons();
}
