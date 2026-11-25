// ============================================================
// MANUAL STATS INPUT  (Home + Opponent tabs, with MIN column)
// ============================================================

// Kolom input mengikuti susunan FIBA:
// # | Player | MIN | PTS | 2PT M | 2PT A | 3PT M | 3PT A | FT A | FT M | ORB | DRB | REB | AST | TO | STL | BLK | PF
// PTS dan REB dihitung otomatis (tidak diinput).
const MS_COLS = [
  { key:'min', label:'MIN',   type:'min',  color:'var(--text-muted)' },
  { key:'pts', label:'PTS',   type:'calc', color:'var(--text-secondary)' },
  { key:'pm2', label:'2PT M', type:'in', color:'var(--accent-success)', max:99 },
  { key:'pa2', label:'2PT A', type:'in', color:'var(--text-muted)',     max:99 },
  { key:'pm3', label:'3PT M', type:'in', color:'var(--accent-success)', max:99 },
  { key:'pa3', label:'3PT A', type:'in', color:'var(--text-muted)',     max:99 },
  { key:'fta', label:'FT A',  type:'in', color:'var(--text-muted)',     max:99 },
  { key:'ftm', label:'FT M',  type:'in', color:'var(--accent-success)', max:99 },
  { key:'orb', label:'ORB',   type:'in', color:'var(--accent-primary)', max:50 },
  { key:'drb', label:'DRB',   type:'in', color:'var(--accent-primary)', max:50 },
  { key:'reb', label:'REB',   type:'calc', color:'var(--accent-primary)' },
  { key:'ast', label:'AST',   type:'in', color:'#a78bfa',               max:50 },
  { key:'tov', label:'TO',    type:'in', color:'var(--accent-danger)',  max:50 },
  { key:'stl', label:'STL',   type:'in', color:'#a78bfa',               max:50 },
  { key:'blk', label:'BLK',   type:'in', color:'#a78bfa',               max:50 },
  { key:'pf',  label:'PF',    type:'in', color:'var(--accent-warning)', max:10 },
];

// MIN: terima "23", "23.5" atau "23:30" -> menit (desimal). Kosong -> null
function parseMinutes(v) {
  v = String(v ?? '').trim();
  if (!v) return null;
  if (v.includes(':')) {
    const [m, s] = v.split(':');
    return (parseInt(m) || 0) + Math.min(59, parseInt(s) || 0) / 60;
  }
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? null : n;
}
function fmtMinutes(m) {
  if (m == null || m === '' || isNaN(Number(m))) return '';
  const t = Math.round(Number(m) * 60);
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}
function normalizeMinInput(el) {
  let m = parseMinutes(el.value);
  if (m != null && m > 48) m = 48;
  el.value = m == null ? '' : fmtMinutes(m);
}

const MS_INPUT_STYLE = 'text-align:center;background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;padding:3px 1px;color:var(--text-primary);font-size:12px;font-variant-numeric:tabular-nums';
const MS_OPP_STYLE   = 'text-align:center;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:4px;padding:3px 1px;color:var(--text-primary);font-size:12px;font-variant-numeric:tabular-nums';

function msTableHead() {
  const th = 'padding:5px 2px;text-align:center;font-size:10px;white-space:nowrap';
  return `<thead style="position:sticky;top:0;z-index:5">
    <tr style="background:var(--bg-elevated)">
      <th style="${th};color:var(--text-muted);min-width:44px">#</th>
      <th style="${th};color:var(--text-muted);text-align:left;padding-left:8px">Player</th>
      ${MS_COLS.map(c => `<th style="${th};color:${c.color}">${c.label}</th>`).join('')}
    </tr>
  </thead>`;
}

// Baris pemain (dipakai tabel awal dan tombol "+ Pemain Lain").
// s = stats pemain; hasData=false -> semua kolom dikosongkan
function msPlayerRowHtml(p, s, hasData, inRoster) {
  const val = k => (hasData && s && s[k] != null) ? s[k] : '';
  const cells = MS_COLS.map(c => {
    if (c.type === 'calc') {
      const color = c.key === 'pts' ? 'var(--accent-primary)' : 'var(--text-primary)';
      return `<td style="padding:2px 1px;text-align:center"><div style="font-weight:700;font-size:13px;color:${color};min-width:30px" id="ms-${c.key}-${p.id}"></div></td>`;
    }
    if (c.type === 'min') {
      return `<td style="padding:2px 1px"><input type="text" inputmode="numeric" placeholder="mm:ss" value="${hasData ? fmtMinutes(s?.min) : ''}"
        class="ms-input" data-pid="${p.id}" data-field="min" id="ms-${p.id}-min"
        oninput="onManualInputChange('${p.id}')" onblur="normalizeMinInput(this)"
        style="width:54px;${MS_INPUT_STYLE}"></td>`;
    }
    return `<td style="padding:2px 1px"><input type="number" inputmode="numeric" min="0" max="${c.max}" value="${val(c.key)}"
      class="ms-input" data-pid="${p.id}" data-field="${c.key}" id="ms-${p.id}-${c.key}"
      oninput="onManualInputChange('${p.id}')" style="width:38px;${MS_INPUT_STYLE}"></td>`;
  }).join('');
  return `<tr data-pid="${p.id}">
    <td style="padding:3px 4px;text-align:center;white-space:nowrap">
      <label style="display:flex;align-items:center;justify-content:center;gap:5px;cursor:pointer" title="Centang = ikut bermain">
        <input type="checkbox" class="ms-play-check" data-pid="${p.id}" ${inRoster ? 'checked' : ''} onchange="toggleManualRow('${p.id}', this.checked)">
        <span style="font-weight:700;color:var(--accent-secondary);font-size:13px">${p.number ?? '?'}</span>
      </label>
    </td>
    <td style="padding:3px 8px;white-space:nowrap">
      <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${p.name}</div>
      <div style="font-size:10px;color:var(--text-muted)">${p.position || ''}</div>
    </td>
    ${cells}
  </tr>`;
}

async function showManualStatsModal(matchId) {
  const match = await txGet('matches', matchId);
  if (!match) { toast('Match not found', 'error'); return; }

  const players = await txGetAll('players');
  const activePlayers = players.filter(p => p.status === 'active');
  activePlayers.sort((a,b) => (a.number||999) - (b.number||999));

  // Load roster
  const roster = await txGetAll('match_rosters', 'match_id', matchId);
  const rosterIds = roster.length ? roster.map(r => r.player_id) : activePlayers.map(p => p.id);

  // Load existing events for pre-fill
  const existingEvents = await txGetAll('game_events', 'match_id', matchId);
  const valid = existingEvents.filter(e => !e.voided);

  // Pre-fill helpers — pull MIN from stored player_match_stats if present
  const pmStats = await txGetAll('player_match_stats', 'match_id', matchId);
  const pmMap = Object.fromEntries(pmStats.map(s => [s.player_id, s]));

  function prefill(pid, team='home') {
    const s = calcBoxScore(valid.filter(e => e.team===team), pid);
    s.min = pmMap[pid]?.minutes ?? null;
    return s;
  }
  // Pemain dianggap sudah punya data kalau ada event atau record statistik; selain itu kolom dikosongkan
  function playerHasData(pid) {
    return !!pmMap[pid] || valid.some(e => e.team === 'home' && e.player_id === pid);
  }

  function homePlayerRow(p) {
    return msPlayerRowHtml(p, prefill(p.id, 'home'), playerHasData(p.id), rosterIds.includes(p.id));
  }

  // ---- Opponent aggregate row (single row, no player breakdown) ----
  function oppRow() {
    const oppEvts = valid.filter(e => e.team === 'away');
    const c = {pm2:0,pa2:0,pm3:0,pa3:0,ftm:0,fta:0,orb:0,drb:0,ast:0,stl:0,blk:0,tov:0,pf:0};
    for (const e of oppEvts) {
      if (e.type==='2PM'){c.pm2++;c.pa2++;} else if (e.type==='2PA'){c.pa2++;}
      else if (e.type==='3PM'){c.pm3++;c.pa3++;} else if (e.type==='3PA'){c.pa3++;}
      else if (e.type==='FTM'){c.ftm++;c.fta++;} else if (e.type==='FTA'){c.fta++;}
      else if (e.type==='ORB')c.orb++; else if (e.type==='DRB')c.drb++;
      else if (e.type==='AST')c.ast++; else if (e.type==='STL')c.stl++;
      else if (e.type==='BLK')c.blk++; else if (e.type==='TOV')c.tov++;
      else if (e.type==='PF')c.pf++;
    }
    const stored = match.opp_stats || null;
    const hasData = !!stored || oppEvts.length > 0;
    const val = k => !hasData ? '' : (stored && stored[k] !== undefined ? stored[k] : c[k]);
    const cells = MS_COLS.map(col => {
      if (col.type === 'min') return `<td style="padding:2px 1px;text-align:center;color:var(--text-muted)">—</td>`;
      if (col.type === 'calc') {
        const color = col.key === 'pts' ? 'var(--accent-danger)' : 'var(--text-primary)';
        return `<td style="padding:2px 1px;text-align:center"><div style="font-weight:700;font-size:13px;color:${color};min-width:30px" id="opp-${col.key}-display"></div></td>`;
      }
      return `<td style="padding:2px 1px"><input type="number" inputmode="numeric" min="0" max="${col.max}" value="${val(col.key)}"
        class="opp-input" data-field="${col.key}" id="opp-${col.key}" oninput="onOppInputChange()"
        style="width:38px;${MS_OPP_STYLE}"></td>`;
    }).join('');
    return `<tr>
      <td colspan="2" style="padding:6px 8px;font-weight:700;color:var(--accent-danger)">${match.opponent} (Tim Lawan)</td>
      ${cells}
    </tr>`;
  }

  const hasExistingManual = existingEvents.some(e => e.source === 'manual');
  const warningHtml = valid.length > 0 && !hasExistingManual
    ? `<div style="padding:8px 12px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:6px;font-size:12px;color:#fbbf24;margin-bottom:10px">
        ⚠ Pertandingan ini sudah punya <strong>${valid.length} event live</strong>. Simpan manual → event lama diganti.
       </div>` : '';

  const tableHead = msTableHead();

  const scoreBar = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:10px;background:var(--bg-elevated);border-radius:8px;flex-wrap:wrap">
      <span style="font-weight:600;font-size:13px;color:var(--text-muted)">Skor Akhir:</span>
      <span style="color:var(--accent-primary);font-weight:700">Kami</span>
      <input type="number" id="ms-home-score" min="0" max="999" value="${match.home_score ?? ''}"
        oninput="validateManualStats()"
        style="width:55px;text-align:center;background:var(--bg-base);border:1px solid var(--border);border-radius:6px;padding:5px;color:var(--text-primary);font-size:15px;font-weight:700">
      <span style="color:var(--text-muted)">—</span>
      <input type="number" id="ms-away-score" min="0" max="999" value="${match.away_score ?? ''}"
        oninput="validateManualStats()"
        style="width:55px;text-align:center;background:var(--bg-base);border:1px solid rgba(239,68,68,.4);border-radius:6px;padding:5px;color:var(--text-primary);font-size:15px;font-weight:700">
      <span style="color:var(--accent-danger);font-weight:700">${match.opponent}</span>
    </div>`;

  // Tabs
  const tabContent = `
    <div class="tab-bar" style="margin-bottom:0">
      <div class="tab active" id="tab-home" onclick="switchStatsTab('home')">🏠 Tim Kami</div>
      <div class="tab" id="tab-opp"  onclick="switchStatsTab('opp')">⚡ ${match.opponent} (Lawan)</div>
    </div>

    <!-- HOME PLAYERS TAB -->
    <div id="ms-tab-home" style="overflow-x:auto;max-height:52vh;overflow-y:auto;margin-top:0">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        ${tableHead}
        <tbody id="ms-player-tbody">
          ${activePlayers.map(p => homePlayerRow(p)).join('')}
        </tbody>
      </table>
    </div>

    <!-- OPPONENT STATS TAB -->
    <div id="ms-tab-opp" style="display:none;overflow-x:auto;max-height:52vh;overflow-y:auto">
      <div style="padding:8px 0 6px;font-size:12px;color:var(--text-muted)">
        Input statistik <strong style="color:var(--accent-danger)">${match.opponent}</strong> sebagai tim lawan (aggregate — tidak per pemain).
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        ${tableHead}
        <tbody>${oppRow()}</tbody>
      </table>
    </div>

    <div style="margin-top:10px;padding:8px 12px;background:var(--bg-elevated);border-radius:8px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:12px;color:var(--text-muted)">Total poin pemain kami:</div>
      <div id="ms-total-pts" style="font-size:18px;font-weight:700;color:var(--accent-primary)">0</div>
    </div>
    <div id="ms-validation-msg" style="font-size:11px;color:var(--accent-warning);margin-top:5px;min-height:14px"></div>`;

  const root = document.getElementById('modal-root');
  root.innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal modal-lg" style="max-width:98vw;width:1040px">
      <div class="modal-header">
        <div class="modal-title">📝 Input Statistik Manual — vs ${match.opponent}</div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div id="modal-body">
        ${warningHtml}
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
          ${match.date ? match.date.split('T')[0] : '—'} · ${match.competition||'—'} · ${match.venue||''}
        </div>
        ${scoreBar}
        ${tabContent}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Batal</button>
        <button class="btn btn-secondary" onclick="addPlayerToManualStats()">+ Pemain Lain</button>
        <button class="btn btn-primary" onclick="saveManualStats('${matchId}')">💾 Simpan Stats</button>
      </div>
    </div>
  </div>`;

  window._manualStatsCtx = { matchId, activePlayers };
  for (const p of activePlayers) onManualInputChange(p.id);
  updateManualTotalPts();
  onOppInputChange();
}

function switchStatsTab(tab) {
  document.getElementById('ms-tab-home').style.display = tab === 'home' ? '' : 'none';
  document.getElementById('ms-tab-opp').style.display  = tab === 'opp'  ? '' : 'none';
  document.getElementById('tab-home').classList.toggle('active', tab === 'home');
  document.getElementById('tab-opp').classList.toggle('active', tab === 'opp');
}

function onOppInputChange() {
  const raw = (f) => document.getElementById(`opp-${f}`)?.value ?? '';
  const get = (f) => parseInt(raw(f)) || 0;
  const any = (...fs) => fs.some(f => String(raw(f)).trim() !== '');
  const ptsEl = document.getElementById('opp-pts-display');
  const rebEl = document.getElementById('opp-reb-display');
  if (ptsEl) ptsEl.textContent = any('pm2','pm3','ftm') ? get('pm2')*2 + get('pm3')*3 + get('ftm') : '';
  if (rebEl) rebEl.textContent = any('orb','drb') ? get('orb') + get('drb') : '';
  validateManualStats();
}

// Update PTS / REB otomatis saat mengetik (kosong kalau belum ada input)
function onManualInputChange(pid) {
  const raw = (f) => document.getElementById(`ms-${pid}-${f}`)?.value ?? '';
  const get = (f) => parseInt(raw(f)) || 0;
  const any = (...fs) => fs.some(f => String(raw(f)).trim() !== '');
  const ptsEl = document.getElementById(`ms-pts-${pid}`);
  const rebEl = document.getElementById(`ms-reb-${pid}`);
  if (ptsEl) ptsEl.textContent = any('pm2','pm3','ftm') ? get('pm2')*2 + get('pm3')*3 + get('ftm') : '';
  if (rebEl) rebEl.textContent = any('orb','drb') ? get('orb') + get('drb') : '';
  updateManualTotalPts();
  validateManualStats();
}

function updateManualTotalPts() {
  const ctx = window._manualStatsCtx;
  if (!ctx) return;
  let total = 0;
  for (const p of ctx.activePlayers) {
    const check = document.querySelector(`.ms-play-check[data-pid="${p.id}"]`);
    if (!check?.checked) continue;
    const get = (f) => parseInt(document.getElementById(`ms-${p.id}-${f}`)?.value) || 0;
    total += get('pm2') * 2 + get('pm3') * 3 + get('ftm');
  }
  const el = document.getElementById('ms-total-pts');
  if (el) el.textContent = total;
}

function validateManualStats() {
  const ctx = window._manualStatsCtx;
  if (!ctx) return;
  const msgs = [];
  for (const p of ctx.activePlayers) {
    const check = document.querySelector(`.ms-play-check[data-pid="${p.id}"]`);
    if (!check?.checked) continue;
    const get = (f) => parseInt(document.getElementById(`ms-${p.id}-${f}`)?.value) || 0;
    const pm2=get('pm2'), pa2=get('pa2'), pm3=get('pm3'), pa3=get('pa3'), ftm=get('ftm'), fta=get('fta');
    if (pm2 > pa2) msgs.push(`${p.name}: 2PM>2PA`);
    if (pm3 > pa3) msgs.push(`${p.name}: 3PM>3PA`);
    if (ftm > fta) msgs.push(`${p.name}: FTM>FTA`);
  }
  // Opponent validation
  const getO = (f) => parseInt(document.getElementById(`opp-${f}`)?.value) || 0;
  if (getO('pm2') > getO('pa2')) msgs.push(`Lawan: 2PM>2PA`);
  if (getO('pm3') > getO('pa3')) msgs.push(`Lawan: 3PM>3PA`);
  if (getO('ftm') > getO('fta')) msgs.push(`Lawan: FTM>FTA`);

  // Score vs computed total check
  const homeScore = parseInt(document.getElementById('ms-home-score')?.value);
  const totalPts  = parseInt(document.getElementById('ms-total-pts')?.textContent) || 0;
  if (!isNaN(homeScore) && homeScore !== totalPts)
    msgs.push(`Skor kami (${homeScore}) ≠ total poin pemain (${totalPts})`);

  const awayScore = parseInt(document.getElementById('ms-away-score')?.value);
  const oppPts    = getO('pm2')*2 + getO('pm3')*3 + getO('ftm');
  if (!isNaN(awayScore) && awayScore !== 0 && oppPts !== 0 && awayScore !== oppPts)
    msgs.push(`Skor lawan (${awayScore}) ≠ total poin lawan dari stats (${oppPts})`);

  const msgEl = document.getElementById('ms-validation-msg');
  if (msgEl) msgEl.textContent = msgs.length ? '⚠ ' + msgs.join(' · ') : '';
}

function toggleManualRow(pid, checked) {
  // Disable inputs for players not in game
  const inputs = document.querySelectorAll(`input.ms-input[data-pid="${pid}"]`);
  inputs.forEach(inp => { inp.disabled = !checked; inp.style.opacity = checked ? '1' : '0.3'; });
  updateManualTotalPts();
  validateManualStats();
}

// Allow adding inactive/extra players not in the default list
async function addPlayerToManualStats() {
  const ctx = window._manualStatsCtx;
  if (!ctx) return;
  const allPlayers = await txGetAll('players');
  const listedIds = ctx.activePlayers.map(p => p.id);
  const unlisted = allPlayers.filter(p => !listedIds.includes(p.id));
  if (!unlisted.length) { toast('Semua pemain sudah ditampilkan', 'info'); return; }
  const opts = unlisted.map(p => `<option value="${p.id}">#${p.number ?? '?'} ${p.name} (${p.status})</option>`).join('');
  const html = `<select id="add-player-sel" class="form-select">${opts}</select>`;
  const root2 = document.createElement('div');
  root2.id = 'mini-modal-overlay';
  root2.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:2000';
  root2.innerHTML = `<div class="modal" style="max-width:360px">
    <div class="modal-header"><div class="modal-title">Tambah Pemain</div></div>
    <div style="padding:8px 0">${html}</div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="document.getElementById('mini-modal-overlay').remove()">Batal</button>
      <button class="btn btn-primary" onclick="confirmAddExtraPlayer()">Tambah</button>
    </div>
  </div>`;
  document.body.appendChild(root2);
  window._addPlayerCallback = async () => {
    const pid = document.getElementById('add-player-sel').value;
    const player = allPlayers.find(p => p.id === pid);
    if (!player) return;
    ctx.activePlayers.push(player);
    // Inject row into table
    const tbody = document.getElementById('ms-player-tbody');
    if (tbody) {
      tbody.insertAdjacentHTML('beforeend', msPlayerRowHtml(player, {}, false, true));
      onManualInputChange(pid);
    }
    document.getElementById('mini-modal-overlay').remove();
    toast(`${player.name} ditambahkan`, 'success');
  };
}

function confirmAddExtraPlayer() {
  if (window._addPlayerCallback) window._addPlayerCallback();
}

async function saveManualStats(matchId) {
  const ctx = window._manualStatsCtx;
  if (!ctx) return;

  // Collect played players
  const playedIds = [];
  for (const p of ctx.activePlayers) {
    const check = document.querySelector(`.ms-play-check[data-pid="${p.id}"]`);
    if (check?.checked) playedIds.push(p.id);
  }
  if (!playedIds.length) { toast('Pilih minimal 1 pemain yang bermain', 'error'); return; }

  // Hard validation
  const errors = [];
  for (const pid of playedIds) {
    const get = (f) => parseInt(document.getElementById(`ms-${pid}-${f}`)?.value) || 0;
    const p = ctx.activePlayers.find(pl => pl.id === pid);
    if (get('pm2') > get('pa2')) errors.push(`${p?.name}: 2PM>2PA`);
    if (get('pm3') > get('pa3')) errors.push(`${p?.name}: 3PM>3PA`);
    if (get('ftm') > get('fta')) errors.push(`${p?.name}: FTM>FTA`);
  }
  const getO = (f) => parseInt(document.getElementById(`opp-${f}`)?.value) || 0;
  if (getO('pm2') > getO('pa2')) errors.push('Lawan: 2PM>2PA');
  if (getO('pm3') > getO('pa3')) errors.push('Lawan: 3PM>3PA');
  if (getO('ftm') > getO('fta')) errors.push('Lawan: FTM>FTA');
  if (errors.length) { toast('Perbaiki dulu: ' + errors.slice(0,3).join(' | '), 'error'); return; }

  const homeScore = parseInt(document.getElementById('ms-home-score')?.value);
  const awayScore = parseInt(document.getElementById('ms-away-score')?.value);

  if (!confirm(`Simpan statistik manual untuk ${playedIds.length} pemain?\n\nEvent lama akan dihapus dan diganti data manual.\n\nLanjut?`)) return;

  const createdAt = now();

  // 1. Void existing events
  const existing = await txGetAll('game_events', 'match_id', matchId);
  for (const ev of existing) {
    ev.voided = true; ev.voided_at = createdAt;
    ev.voided_reason = 'replaced_by_manual_input';
    await txPut('game_events', ev);
  }

  // 2. Generate home player events
  const newEvents = [];
  const statsPerPlayer = {}; // store for player_match_stats

  for (const pid of playedIds) {
    const get = (f) => parseInt(document.getElementById(`ms-${pid}-${f}`)?.value) || 0;
    const pm2=get('pm2'),pa2=get('pa2'),pm3=get('pm3'),pa3=get('pa3'),ftm=get('ftm'),fta=get('fta');
    const minutes = parseMinutes(document.getElementById(`ms-${pid}-min`)?.value);  // null kalau kosong
    statsPerPlayer[pid] = { pm2,pa2,pm3,pa3,ftm,fta,
      orb:get('orb'),drb:get('drb'),ast:get('ast'),stl:get('stl'),blk:get('blk'),tov:get('tov'),pf:get('pf'),
      minutes, pts: pm2*2+pm3*3+ftm };

    const types = [
      ...Array(pm2).fill('2PM'), ...Array(Math.max(0,pa2-pm2)).fill('2PA'),
      ...Array(pm3).fill('3PM'), ...Array(Math.max(0,pa3-pm3)).fill('3PA'),
      ...Array(ftm).fill('FTM'), ...Array(Math.max(0,fta-ftm)).fill('FTA'),
      ...Array(get('orb')).fill('ORB'), ...Array(get('drb')).fill('DRB'),
      ...Array(get('ast')).fill('AST'), ...Array(get('stl')).fill('STL'),
      ...Array(get('blk')).fill('BLK'), ...Array(get('tov')).fill('TOV'),
      ...Array(get('pf')).fill('PF'),
    ];
    for (const type of types) {
      newEvents.push({ id:uuid(), match_id:matchId, period:1, player_id:pid,
        team:'home', type, voided:false, source:'manual', created_at:createdAt });
    }
  }

  // 3. Generate opponent (away) aggregate events — so box score & analytics work
  const oppPm2=getO('pm2'),oppPa2=getO('pa2'),oppPm3=getO('pm3'),oppPa3=getO('pa3');
  const oppFtm=getO('ftm'),oppFta=getO('fta');
  const oppStats = {
    pts: oppPm2*2 + oppPm3*3 + oppFtm,
    pm2: oppPm2, pa2: oppPa2, pm3: oppPm3, pa3: oppPa3,
    fgm: oppPm2 + oppPm3, fga: oppPa2 + oppPa3,
    ftm: oppFtm, fta: oppFta,
    orb: getO('orb'), drb: getO('drb'), trb: getO('orb') + getO('drb'),
    ast: getO('ast'), stl: getO('stl'), blk: getO('blk'), tov: getO('tov'), pf: getO('pf'),
  };
  const oppTypes = [
    ...Array(oppPm2).fill('2PM'), ...Array(Math.max(0,oppPa2-oppPm2)).fill('2PA'),
    ...Array(oppPm3).fill('3PM'), ...Array(Math.max(0,oppPa3-oppPm3)).fill('3PA'),
    ...Array(oppFtm).fill('FTM'), ...Array(Math.max(0,oppFta-oppFtm)).fill('FTA'),
    ...Array(getO('orb')).fill('ORB'), ...Array(getO('drb')).fill('DRB'),
    ...Array(getO('ast')).fill('AST'), ...Array(getO('stl')).fill('STL'),
    ...Array(getO('blk')).fill('BLK'), ...Array(getO('tov')).fill('TOV'),
    ...Array(getO('pf')).fill('PF'),
  ];
  for (const type of oppTypes) {
    newEvents.push({ id:uuid(), match_id:matchId, period:1, player_id:null,
      team:'away', type, voided:false, source:'manual_opp', created_at:createdAt });
  }

  await txMultiPut('game_events', newEvents);

  // 4. Save player_match_stats (including MIN)
  const existingPMS = await txGetAll('player_match_stats', 'match_id', matchId);
  for (const s of existingPMS) await txDelete('player_match_stats', s.id);
  for (const [pid, s] of Object.entries(statsPerPlayer)) {
    await txPut('player_match_stats', { id:uuid(), match_id:matchId, player_id:pid, minutes:s.minutes,
      pts:s.pts, pm2:s.pm2, pa2:s.pa2, pm3:s.pm3, pa3:s.pa3, ftm:s.ftm, fta:s.fta,
      orb:s.orb, drb:s.drb, ast:s.ast, stl:s.stl, blk:s.blk, tov:s.tov, pf:s.pf,
      created_at:createdAt });
  }

  // 6. Update roster
  const existingRoster = await txGetAll('match_rosters', 'match_id', matchId);
  for (const r of existingRoster) await txDelete('match_rosters', r.id);
  for (const pid of playedIds) {
    await txPut('match_rosters', { id: uuid(), match_id: matchId, player_id: pid, created_at: createdAt });
  }

  // 7. Update match: status, scores, opp_stats
  const matchRec = await txGet('matches', matchId);
  const calcHome = newEvents.filter(e=>e.team==='home').reduce((a,e)=>{
    if(e.type==='2PM')return a+2; if(e.type==='3PM')return a+3; if(e.type==='FTM')return a+1; return a;
  }, 0);
  matchRec.status     = 'completed';
  matchRec.home_score = isNaN(homeScore) ? calcHome : homeScore;
  matchRec.away_score = isNaN(awayScore) ? oppStats.pts : awayScore;
  matchRec.opp_stats  = oppStats;
  matchRec.updated_at = createdAt;
  await txPut('matches', matchRec);

  await audit('match', matchId, 'manual_stats_input', {
    players: playedIds.length, events: newEvents.length,
    home_score: matchRec.home_score, away_score: matchRec.away_score,
  });

  const homeEventCount = newEvents.filter(e => e.team === 'home').length;
  const oppEventCount  = newEvents.filter(e => e.team === 'away').length;
  toast(`✅ Disimpan! ${homeEventCount} event kami + ${oppEventCount} event lawan.`, 'success');
  closeModal();

  await openBoxScore(matchId);
}
