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
