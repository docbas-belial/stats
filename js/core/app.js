// ============================================================
// INIT
// ============================================================
async function initApp() {
  const progressEl = document.getElementById('init-progress');
  const statusEl   = document.getElementById('init-status');

  const setProgress = (pct, msg) => {
    if (progressEl) progressEl.style.width = pct + '%';
    if (statusEl)   statusEl.textContent = msg;
  };

  try {
    setProgress(10, 'Connecting to database…');

    // Init Supabase (atau fallback ke localStorage)
    _initSupabase();

    setProgress(20, 'Loading data…');

    // 1) Muat cache lokal (instan)
    let hadData = _loadFromStorage();
    let pullOk = true;

    // 2) Perangkat baru / cache kosong → ambil dulu dari Supabase
    if (_useSupabase && !hadData) {
      setProgress(35, 'Downloading data…');
      pullOk = await _pullAll();
      hadData = Object.keys(_mem.players).length > 0;
    }
    // Jangan tulis nilai default kalau belum bisa membaca server (hindari menimpa data asli)
    const safeToInit = !_useSupabase || hadData || pullOk;

    setProgress(55, 'Checking settings…');
    if (safeToInit) {
      const teamName = await getSetting('team_name');
      if (!teamName) await setSetting('team_name', 'My Team');
      if ((await getSetting('schema_version')) !== SCHEMA_VERSION) await setSetting('schema_version', SCHEMA_VERSION);
      if ((await getSetting('app_version')) !== '1.0.0') await setSetting('app_version', '1.0.0');
    }

    setProgress(80, 'Starting…');
    state.dbReady = true;

    // Small visual delay so the loading screen doesn't flash
    await new Promise(r => setTimeout(r, 120));
    setProgress(100, 'Ready!');
    await new Promise(r => setTimeout(r, 80));

    document.getElementById('db-init').style.display = 'none';
    document.getElementById('app').style.display     = 'flex';

    buildNav();
    await navigate('dashboard');
    await updateStatusBar();

    if (!hadData && safeToInit) await maybeSeedDemo();
    if (_useSupabase) _bgSync();   // kirim antrean + tarik data terbaru di latar belakang

  } catch (err) {
    console.error('[BSM] Init error:', err);
    if (statusEl) statusEl.textContent = 'Error — ' + err.message;
    if (progressEl) progressEl.style.background = 'var(--accent-danger)';
    // Still try to launch even on error
    setTimeout(async () => {
      state.dbReady = true;
      document.getElementById('db-init').style.display = 'none';
      document.getElementById('app').style.display     = 'flex';
      buildNav();
      await navigate('dashboard');
    }, 1500);
  }
}

// Seed demo data for first run
async function maybeSeedDemo() {
  const players = await txGetAll('players');
  if (players.length > 0) return; // Already has data
  
  // Add a sample season
  const seasonId = uuid();
  await txPut('seasons', { id: seasonId, name: '2024/2025', start_year: 2024, end_year: 2025, is_current: true, created_at: now(), updated_at: now() });
  
  // Add sample players
  const samplePlayers = [
    { name: 'Alex Santoso', number: 5, position: 'PG' },
    { name: 'Budi Hartono', number: 10, position: 'SG' },
    { name: 'Candra Wijaya', number: 7, position: 'SF' },
    { name: 'Doni Pratama', number: 15, position: 'PF' },
    { name: 'Eko Susanto', number: 32, position: 'C' },
  ];
  for (const sp of samplePlayers) {
    await txPut('players', { id: uuid(), ...sp, status: 'active', created_at: now(), updated_at: now() });
  }
  
  toast('Welcome to Basketball Stats Manager! Sample players added.', 'success');
}

// ---- Listen for online/offline ----
window.addEventListener('online', () => { updateStatusBar(); _bgSync(); _scheduleFlush(0); });
window.addEventListener('offline', () => { updateStatusBar(); });

// ---- Boot ----
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => initApp());
} else {
  initApp();
}
