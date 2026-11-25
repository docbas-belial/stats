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
