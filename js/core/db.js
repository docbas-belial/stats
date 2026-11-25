// ============================================================
// DATABASE ENGINE — SQLite via IndexedDB (OPFS-ready fallback)
// ============================================================
// Since OPFS requires cross-origin isolation headers (COOP/COEP) 
// which aren't available in the artifact iframe, we use IndexedDB
// as a persistent storage backend with SQLite-like transaction semantics.
// In a real deployment (localhost/HTTPS with COOP/COEP headers),
// replace this with @sqlite.org/sqlite-wasm + OPFS adapter.
// ============================================================

const SCHEMA_VERSION = 3;
const LS_KEY = 'bsm_data_v3';

const state = {
  currentPage: 'dashboard',
  liveMatch: null,
  selectedPlayer: null,
  selectedMatchId: null,
  bsView: 'list',          // Box Score: 'list' (daftar pertandingan) | 'detail'
  bsCompetition: null,     // Box Score: filter kompetisi
  dashSeason: '',          // Dashboard: filter season (id atau '')
  dashTeam: '',            // Dashboard: filter opponent team (nama lawan atau '')
  lastBackup: null,
  dbReady: false,
  dbError: null,
};

// ============================================================
// SUPABASE STORAGE ENGINE  (v2 — cache lokal + sinkron latar belakang)
//
// Semua baca/tulis terjadi di memori → UI instan, tanpa menunggu jaringan.
// Setiap perubahan masuk antrean (outbox) lalu dikirim ke Supabase di
// latar belakang (dibatch). Outbox disimpan di localStorage, jadi aman
// walau tab ditutup atau sedang offline — akan terkirim saat online lagi.
// Jika Supabase tidak tersedia, app tetap jalan penuh dari localStorage.
// ============================================================

// ⬇ KREDENSIAL SUPABASE
const SUPABASE_URL = 'https://qnqzsghvzoxhfxenmtzg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZtFmxhWJ0yiOXeUgARr8rw_8cDnkQQn';

const STORE_NAMES = [
  'players','seasons','competitions','matches','match_rosters',
  'game_events','period_scores','player_match_stats','team_match_stats',
  'backup_history','audit_log','settings',
];
const STORES = Object.fromEntries(STORE_NAMES.map(s => [s, true]));
const KEY_OF = { settings: 'key' };  // semua lain pakai 'id'
const keyOf  = s => KEY_OF[s] || 'id';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
const now = () => new Date().toISOString();
const _clone = o => JSON.parse(JSON.stringify(o));

// --- Inisialisasi Supabase client ---
let _sb = null;
let _useSupabase = false;

function _initSupabase() {
  try {
    if (!SUPABASE_URL.includes('YOUR_PROJECT') && !SUPABASE_KEY.includes('YOUR_ANON')) {
      _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      _useSupabase = true;
      console.log('[BSM] Supabase connected');
    } else {
      console.warn('[BSM] Supabase credentials not set — using localStorage only');
    }
  } catch (e) {
    console.warn('[BSM] Supabase init failed, using localStorage only:', e.message);
  }
}

// --- Cache lokal (sumber data untuk semua pembacaan) ---
const OUTBOX_KEY = 'bsm_outbox_v1';
const SYNC_FLAG  = 'bsm_sb_synced_v1';
const _mem = {};
for (const s of STORE_NAMES) _mem[s] = {};
let _outbox = [];            // [{op:'upsert'|'delete'|'clear', store, rows?, id?}]
let _saveTimer = null;

function scheduleSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_persistNow, 300);
}
function _persistNow() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(_mem)); }
  catch (e) { console.warn('[BSM] localStorage save failed:', e.message); }
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(_outbox)); }
  catch (e) { console.warn('[BSM] outbox save failed:', e.message); }
}
function _loadFromStorage() {
  let ok = false;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const s of STORE_NAMES) if (parsed[s]) _mem[s] = parsed[s];
      ok = true;
    }
  } catch (e) { /* abaikan */ }
  try {
    const ob = localStorage.getItem(OUTBOX_KEY);
    if (ob) _outbox = JSON.parse(ob) || [];
  } catch (e) { _outbox = []; }
  return ok;
}
// Pastikan data & antrean tersimpan saat tab ditutup / disembunyikan
window.addEventListener('beforeunload', () => _persistNow());
window.addEventListener('pagehide', () => _persistNow());
document.addEventListener('visibilitychange', () => { if (document.hidden) _persistNow(); });

// --- Status sinkron (ditampilkan di status bar) ---
let _syncState = 'idle';     // idle | syncing | offline | error
let _syncMsg = '';
let _lastErrToast = '';

function _pendingCount() {
  return _outbox.reduce((a, o) => a + (o.rows ? o.rows.length : 1), 0);
}
function _setSync(st, msg = '') {
  _syncState = st; _syncMsg = msg;
  _renderSyncStatus();
}
function _renderSyncStatus() {
  const dot = document.getElementById('dot-db');
  const txt = document.getElementById('status-db');
  if (!dot || !txt) return;
  const n = _pendingCount();
  txt.title = _syncMsg || '';
  if (!state.dbReady)           { dot.className = 'status-dot err';  txt.textContent = 'DB Error'; }
  else if (!_useSupabase)       { dot.className = 'status-dot warn'; txt.textContent = 'Local only'; }
  else if (_syncState === 'error')   { dot.className = 'status-dot err';  txt.textContent = 'Sync error' + (n ? ` (${n} pending)` : ''); }
  else if (_syncState === 'offline') { dot.className = 'status-dot warn'; txt.textContent = 'Offline' + (n ? ` · ${n} pending` : ''); }
  else if (_syncState === 'syncing' || n > 0) { dot.className = 'status-dot warn'; txt.textContent = 'Syncing…'; }
  else                          { dot.className = 'status-dot ok';   txt.textContent = 'Synced'; }
}

// --- Antrean kirim ke Supabase ---
let _flushing = false, _pulling = false, _flushTimer = null, _retryDelay = 5000;

function _enqueue(op) {
  if (!_useSupabase) return;
  if (op.op === 'clear') _outbox = _outbox.filter(o => o.store !== op.store);
  _outbox.push(op);
  _renderSyncStatus();
  _scheduleFlush(150);   // tunggu sebentar agar banyak tulis jadi 1 request
}
function _scheduleFlush(ms = 150) {
  clearTimeout(_flushTimer);
  _flushTimer = setTimeout(_flush, ms);
}

async function _sendOp(o, rows) {
  const t = _sb.from(o.store);
  const k = keyOf(o.store);
  let res;
  if (o.op === 'upsert')      res = await t.upsert(rows);
  else if (o.op === 'delete') res = await t.delete().eq(k, o.id);
  else if (o.op === 'clear')  res = await t.delete().not(k, 'is', null);
  if (res && res.error) throw new Error(`${o.store}: ${res.error.message}`);
}

async function _flush() {
  if (!_useSupabase || !_sb || _flushing || _pulling) return;
  if (!_outbox.length) { _setSync('idle'); return; }
  if (!navigator.onLine) { _setSync('offline'); return; }
  _flushing = true;
  _setSync('syncing');
  try {
    while (_outbox.length) {
      const first = _outbox[0];
      const batch = [first];
      let rows = null;
      if (first.op === 'upsert') {
        // gabungkan upsert berurutan di tabel yang sama jadi 1 request
        const k = keyOf(first.store);
        const map = new Map();
        for (const o of _outbox) {
          if (o.op !== 'upsert' || o.store !== first.store) break;
          for (const r of o.rows) map.set(r[k], r);
          if (o !== first) batch.push(o);
          if (map.size >= 500) break;
        }
        rows = [...map.values()];
      }
      await _sendOp(first, rows);
      _outbox = _outbox.filter(o => !batch.includes(o));
      scheduleSave();
      _renderSyncStatus();
    }
    _retryDelay = 5000;
    _lastErrToast = '';
    _setSync('idle');
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    const isNet = !navigator.onLine || /fetch|network|load failed/i.test(msg);
    if (isNet) {
      _setSync('offline', msg);
    } else {
      _setSync('error', msg);
      if (_lastErrToast !== msg) {
        _lastErrToast = msg;
        toast('Gagal sinkron ke Supabase: ' + msg, 'error');
      }
    }
    console.error('[BSM sync]', msg);
    _retryDelay = Math.min(_retryDelay * 2, 60000);
    _scheduleFlush(_retryDelay);
  } finally {
    _flushing = false;
  }
}

// --- Tarik data dari Supabase (latar belakang / pertama kali) ---
let _pulledOnce = false;

function _applyToMem(mem, o) {
  const k = keyOf(o.store);
  if (o.op === 'upsert')      for (const r of o.rows) mem[o.store][r[k]] = r;
  else if (o.op === 'delete') delete mem[o.store][o.id];
  else if (o.op === 'clear')  mem[o.store] = {};
}
function _sig(m) {
  return Object.entries(m || {})
    .map(([id, r]) => id + '|' + (r.updated_at || r.created_at || ''))
    .sort().join(',');
}
function _refreshUI() {
  if (!state.dbReady) return;
  if (document.querySelector('#modal-root .modal-overlay')) return; // jangan ganggu modal
  if (state.currentPage === 'live') return;                          // jangan ganggu pertandingan live
  renderPage(state.currentPage).catch(e => console.warn('[BSM] refresh failed', e));
  updateStatusBar();
}

async function _pullAll() {
  if (!_useSupabase || !_sb) return false;
  if (!navigator.onLine) { _setSync('offline'); return false; }
  _pulling = true;
  _setSync('syncing');
  let ok = false;
  try {
    // Ambil semua tabel paralel; per tabel dipaginasi (server membatasi 1000 baris/request)
    const results = await Promise.all(STORE_NAMES.map(async s => {
      const k = keyOf(s), rows = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await _sb.from(s).select('*').order(k).range(from, from + 999);
        if (error) throw new Error(`${s}: ${error.message}`);
        rows.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return [s, rows];
    }));

    let firstSync = true;
    try { firstSync = !localStorage.getItem(SYNC_FLAG); } catch (e) {}
    const serverEmpty = results.every(([, r]) => r.length === 0);
    const localHas = STORE_NAMES.some(s => Object.keys(_mem[s]).length > 0);
    let changed = false;

    if (firstSync && serverEmpty && localHas) {
      // Supabase masih kosong tapi browser ini punya data → unggah data lokal
      for (const s of STORE_NAMES) {
        const rows = Object.values(_mem[s]);
        for (let i = 0; i < rows.length; i += 500) {
          _outbox.push({ op: 'upsert', store: s, rows: rows.slice(i, i + 500).map(_clone) });
        }
      }
    } else {
      if (firstSync && localHas) {
        try { localStorage.setItem('bsm_pre_sync', JSON.stringify(_mem)); } catch (e) {}
      }
      const fresh = {};
      for (const [s, rows] of results) {
        const k = keyOf(s);
        fresh[s] = {};
        for (const r of rows) fresh[s][r[k]] = r;
      }
      // perubahan lokal yang belum terkirim tetap menang
      for (const o of _outbox) _applyToMem(fresh, o);
      for (const s of STORE_NAMES) {
        if (_sig(fresh[s]) !== _sig(_mem[s])) changed = true;
        _mem[s] = fresh[s];
      }
    }
    try { localStorage.setItem(SYNC_FLAG, '1'); } catch (e) {}
    _persistNow();
    _pulledOnce = true;
    ok = true;
    if (changed) setTimeout(_refreshUI, 0);
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    console.error('[BSM pull]', msg);
    _setSync(/fetch|network|load failed/i.test(msg) ? 'offline' : 'error', msg);
  } finally {
    _pulling = false;
  }
  if (ok) { _setSync('idle'); _scheduleFlush(0); }
  return ok;
}

let _bgBusy = false;
async function _bgSync() {
  if (!_useSupabase || _bgBusy) return;
  _bgBusy = true;
  try {
    await _flush();
    if (!_pulledOnce) await _pullAll();
  } finally {
    _bgBusy = false;
  }
  if (!_pulledOnce) setTimeout(_bgSync, 15000);
}

// --- CRUD helpers — semua instan dari cache, tulis diteruskan ke antrean ---

async function txGet(storeName, id) {
  return _mem[storeName]?.[id] ?? null;
}

async function txPut(storeName, obj) {
  _mem[storeName][obj[keyOf(storeName)]] = obj;
  _enqueue({ op: 'upsert', store: storeName, rows: [_clone(obj)] });
  scheduleSave();
  return obj;
}

async function txDelete(storeName, id) {
  delete _mem[storeName][id];
  _enqueue({ op: 'delete', store: storeName, id });
  scheduleSave();
}

async function txGetAll(storeName, indexField, value) {
  const all = Object.values(_mem[storeName] || {});
  if (indexField !== undefined && value !== undefined) {
    return all.filter(r => r[indexField] === value);
  }
  return all;
}

async function txMultiPut(storeName, objs) {
  if (!objs || !objs.length) return;
  const k = keyOf(storeName);
  for (const obj of objs) _mem[storeName][obj[k]] = obj;
  for (let i = 0; i < objs.length; i += 500) {
    _enqueue({ op: 'upsert', store: storeName, rows: objs.slice(i, i + 500).map(_clone) });
  }
  scheduleSave();
}

async function txClear(storeName) {
  _mem[storeName] = {};
  _enqueue({ op: 'clear', store: storeName });
  scheduleSave();
}

// --- Settings shortcuts ---
async function getSetting(key, def = null) {
  const r = await txGet('settings', key);
  return r ? r.value : def;
}
async function setSetting(key, value) {
  await txPut('settings', { key, value, updated_at: now() });
}

// --- Audit log ---
async function audit(entity_type, entity_id, action, data = {}) {
  await txPut('audit_log', { id: uuid(), entity_type, entity_id, action, data, created_at: now() });
}
