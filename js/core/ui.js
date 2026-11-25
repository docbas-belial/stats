// ============================================================
// MODAL SYSTEM
// ============================================================
function showModal(title, bodyHtml, onConfirm, confirmLabel = 'Save') {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">${title}</div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div id="modal-body">${bodyHtml}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        ${onConfirm ? `<button class="btn btn-primary" onclick="window._modalConfirm()">${confirmLabel}</button>` : `<button class="btn btn-secondary" onclick="closeModal()">${confirmLabel}</button>`}
      </div>
    </div>
  </div>`;
  window._modalConfirm = onConfirm;
}
function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
  window._modalConfirm = null;
}

// ============================================================
// TOAST
// ============================================================
function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const icons = {success:'✓',error:'✕',warning:'⚠',info:'ℹ'};
  el.innerHTML = `<span style="color:${type==='success'?'var(--accent-success)':type==='error'?'var(--accent-danger)':type==='warning'?'var(--accent-warning)':'var(--accent-primary)'}">${icons[type]||'•'}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, 3500);
}

// ============================================================
// STATUS BAR
// ============================================================
async function updateStatusBar() {
  const dbDot = document.getElementById('dot-db');
  const dbStatus = document.getElementById('status-db');
  const backupDot = document.getElementById('dot-backup');
  const backupStatus = document.getElementById('status-backup');
  const offlineDot = document.getElementById('dot-offline');
  const offlineStatus = document.getElementById('status-offline');
  
  _renderSyncStatus();
  
  const lastBackup = await getSetting('last_backup');
  if (lastBackup) {
    const ago = Math.floor((Date.now()-new Date(lastBackup))/1000/60);
    backupDot.className = ago > 1440 ? 'status-dot warn' : 'status-dot ok';
    backupStatus.textContent = ago < 60 ? `Backup ${ago}m ago` : `Backup ${Math.floor(ago/60)}h ago`;
  } else {
    backupDot.className = 'status-dot warn';
    backupStatus.textContent = 'No backup yet';
  }
  
  const online = navigator.onLine;
  offlineDot.className = 'status-dot ok';
  offlineStatus.textContent = online ? 'Online' : 'Offline';
}

// ============================================================
// NAVIGATION
// ============================================================
const PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: '⬛', section: 'Overview' },
  { id: 'players', label: 'Players', icon: '👤', section: 'Roster' },
  { id: 'seasons', label: 'Seasons', icon: '📅', section: 'Roster' },
  { id: 'matches', label: 'Matches', icon: '🗒️', section: 'Games' },
  { id: 'live', label: 'Live Tracker', icon: '🔴', section: 'Games' },
  { id: 'boxscore', label: 'Box Score', icon: '📊', section: 'Stats' },
  { id: 'analytics', label: 'Team Analytics', icon: '📈', section: 'Stats' },
  { id: 'player-analytics', label: 'Player Analytics', icon: '🏃', section: 'Stats' },
  { id: 'history', label: 'Game History', icon: '📚', section: 'Reports' },
  { id: 'reports', label: 'Reports & Export', icon: '📤', section: 'Reports' },
  { id: 'backup', label: 'Backup & Restore', icon: '💾', section: 'System' },
  { id: 'settings', label: 'Settings', icon: '⚙️', section: 'System' },
];

function buildNav() {
  const nav = document.getElementById('nav-menu');
  let lastSection = '';
  nav.innerHTML = PAGES.map(p => {
    let sectionHtml = '';
    if (p.section !== lastSection) {
      sectionHtml = `<div class="nav-section">${p.section}</div>`;
      lastSection = p.section;
    }
    return `${sectionHtml}<div class="nav-item" onclick="navigateFromMenu('${p.id}')" data-page="${p.id}">
      <span>${p.icon}</span><span>${p.label}</span></div>`;
  }).join('');
}

async function navigateFromMenu(pageId) {
  if (pageId === 'boxscore') state.bsView = 'list';
  await navigate(pageId);
}
async function navigate(pageId) {
  state.currentPage = pageId;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const el = document.querySelector(`[data-page="${pageId}"]`);
  if (el) el.classList.add('active');
  const page = PAGES.find(p => p.id === pageId);
  document.getElementById('page-title').textContent = page?.label || pageId;
  document.getElementById('topbar-actions').innerHTML = '';
  await renderPage(pageId);
}

async function renderPage(pageId) {
  const content = document.getElementById('content');
  switch (pageId) {
    case 'dashboard': await renderDashboard(); break;
    case 'players': await renderPlayers(); break;
    case 'seasons': await renderSeasons(); break;
    case 'matches': await renderMatches(); break;
    case 'live': await renderLive(); break;
    case 'boxscore': await renderBoxScore(); break;
    case 'analytics': await renderAnalytics(); break;
    case 'player-analytics': await renderPlayerAnalytics(); break;
    case 'history': await renderHistory(); break;
    case 'reports': await renderReports(); break;
    case 'backup': await renderBackup(); break;
    case 'settings': await renderSettings(); break;
    default: content.innerHTML = '<div class="empty-state"><div class="empty-state-title">Page not found</div></div>';
  }
}
