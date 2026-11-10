const DAEMON_API = 'http://127.0.0.1:8765/api';

let activeTabId = null;
let activeTabUrl = '';
let activeTabTitle = '';
let mediaItems = [];
let mediaFilter = 'All';
let daemonItems = [];

const statusBadge = document.getElementById('status-badge');
const speedSummary = document.getElementById('speed-summary');
const openAppBtn = document.getElementById('open-app-btn');
const mediaListEl = document.getElementById('media-list');
const downloadsListEl = document.getElementById('downloads-list');
const tabMediaCnt = document.getElementById('tab-media-cnt');
const tabDlCnt = document.getElementById('tab-dl-cnt');

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.getAttribute('data-tab')}`).classList.add('active');
  });
});

// Media category filters
document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    mediaFilter = chip.getAttribute('data-filter');
    renderMediaList();
  });
});

// Open or focus native Windows REA-IDM app
openAppBtn.addEventListener('click', () => {
  openAppBtn.textContent = 'Opening...';
  chrome.runtime.sendMessage({ type: 'OPEN_DESKTOP_APP' }, () => {
    setTimeout(() => {
      openAppBtn.textContent = 'Open App';
    }, 1000);
  });
});

// Gather media from active tab (background webRequest + live DOM scan)
async function scanCurrentTabMedia() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab) return;
    activeTabId = tab.id;
    activeTabUrl = tab.url || '';
    activeTabTitle = tab.title || '';

    const combined = new Map();

    // 1. Network sniffed items tracked by service worker
    const bgRes = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_TAB_MEDIA', tabId: tab.id }, resolve);
    });
    if (bgRes && Array.isArray(bgRes.media)) {
      bgRes.media.forEach((m) => {
        if (m && m.url) combined.set(m.url, m);
      });
    }

    // 2. DOM media & links from content script
    try {
      const domRes = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_DOM_MEDIA' });
      if (domRes && Array.isArray(domRes.items)) {
        domRes.items.forEach((m) => {
          if (m && m.url && !combined.has(m.url)) combined.set(m.url, m);
        });
      }
    } catch {
      // Content script might not run on chrome:// pages
    }

    mediaItems = Array.from(combined.values());
    tabMediaCnt.textContent = String(mediaItems.length);
    renderMediaList();
  } catch {
    renderMediaList();
  }
}

function renderMediaList() {
  const filtered = mediaItems.filter((m) => {
    if (mediaFilter === 'All') return true;
    if (mediaFilter === 'Files') return m.category === 'Files' || m.category === 'Images';
    return m.category === mediaFilter;
  });

  if (filtered.length === 0) {
    mediaListEl.innerHTML = `<div class="empty-state">No ${mediaFilter === 'All' ? 'media or links' : mediaFilter.toLowerCase()} detected on this tab yet.<br>Play a video or click <strong>Rescan</strong>.</div>`;
    return;
  }

  mediaListEl.innerHTML = '';
  filtered.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'media-row';

    const meta = [item.category || 'Media'];
    if (item.qualityHint) meta.push(item.qualityHint);
    if (item.sizeBytes > 0) meta.push(formatBytes(item.sizeBytes));

    row.innerHTML = `
      <span class="ext-badge">${escapeHtml(item.ext || 'FILE')}</span>
      <div class="row-info">
        <div class="row-title" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</div>
        <div class="row-sub">${escapeHtml(meta.join(' • '))}</div>
      </div>
      <div class="row-actions">
        <button class="mini-btn copy-btn" title="Copy URL">⧉</button>
        <button class="mini-btn go dl-btn">↓ Get</button>
      </div>
    `;

    row.querySelector('.copy-btn').addEventListener('click', () => {
      navigator.clipboard?.writeText(item.url);
      const btn = row.querySelector('.copy-btn');
      btn.textContent = '✓';
      setTimeout(() => (btn.textContent = '⧉'), 1200);
    });

    row.querySelector('.dl-btn').addEventListener('click', () => {
      const btn = row.querySelector('.dl-btn');
      btn.textContent = '...';
      chrome.runtime.sendMessage(
        {
          type: 'START_DOWNLOAD',
          data: {
            url: item.url,
            referer: activeTabUrl,
            title: item.label || activeTabTitle,
            downloadMode: item.category === 'Audio' ? 'audio' : 'best'
          }
        },
        (res) => {
          btn.textContent = res && res.success ? '✓ Sent' : 'Offline';
          setTimeout(() => (btn.textContent = '↓ Get'), 2000);
          refreshDaemonState();
        }
      );
    });

    mediaListEl.appendChild(row);
  });
}

// Rescan, Batch Grabber & Download All
document.getElementById('btn-rescan').addEventListener('click', scanCurrentTabMedia);

document.getElementById('btn-open-grabber').addEventListener('click', async () => {
  if (activeTabId !== null) {
    chrome.tabs.sendMessage(activeTabId, { type: 'OPEN_BATCH_GRABBER', networkMedia: mediaItems }).catch(() => {});
    window.close();
  }
});

document.getElementById('btn-download-all-media').addEventListener('click', () => {
  const visible = mediaItems.filter((m) => {
    if (mediaFilter === 'All') return true;
    if (mediaFilter === 'Files') return m.category === 'Files' || m.category === 'Images';
    return m.category === mediaFilter;
  });
  if (visible.length === 0) return;

  const batch = visible.map((m) => ({
    url: m.url,
    referer: activeTabUrl,
    title: m.label || activeTabTitle,
    downloadMode: m.category === 'Audio' ? 'audio' : 'best'
  }));

  chrome.runtime.sendMessage({ type: 'BATCH_DOWNLOAD', items: batch }, () => {
    refreshDaemonState();
  });
});

// Daemon status & live downloads list
async function refreshDaemonState() {
  try {
    const [stRes, dlRes] = await Promise.all([
      fetch(`${DAEMON_API}/status`, { cache: 'no-store' }),
      fetch(`${DAEMON_API}/downloads`, { cache: 'no-store' })
    ]);

    if (!stRes.ok || !dlRes.ok) throw new Error('Offline');

    const status = await stRes.json();
    daemonItems = await dlRes.json();

    statusBadge.textContent = 'Online';
    statusBadge.className = 'badge online';
    speedSummary.textContent = `${status.activeDownloads || 0} active • ${status.completedDownloads || 0} downloaded • ${formatBytes(status.totalSpeedBytesPerSec || 0)}/s`;
    tabDlCnt.textContent = String(daemonItems.length);

    renderDownloadsList();
  } catch {
    statusBadge.textContent = 'Offline';
    statusBadge.className = 'badge offline';
    speedSummary.textContent = 'Desktop engine offline — Click Open App';
    downloadsListEl.innerHTML = `<div class="empty-state">REA-IDM Desktop App is not running.<br>Click <strong>Open App</strong> at the top-right to start it.</div>`;
  }
}

function renderDownloadsList() {
  if (!Array.isArray(daemonItems) || daemonItems.length === 0) {
    downloadsListEl.innerHTML = `<div class="empty-state">No downloads in REA-IDM yet.</div>`;
    return;
  }

  downloadsListEl.innerHTML = '';
  daemonItems.slice(0, 20).forEach((d) => {
    const st = d.state?.status || 'idle';
    const pct = st === 'completed' ? 100 : (d.progress?.percent || 0);
    const total = d.state?.totalBytes || d.progress?.totalBytes || 0;
    const speed = d.progress?.speedBytesPerSec || 0;

    const row = document.createElement('div');
    row.className = 'dl-row';

    let subText = '';
    if (st === 'completed') subText = `Downloaded • ${formatBytes(total)}`;
    else if (st === 'downloading') subText = `${pct.toFixed(1)}% • ${formatBytes(speed)}/s`;
    else if (st === 'paused') subText = `Paused • ${pct.toFixed(1)}%`;
    else if (st === 'error') subText = `Error: ${d.state?.error || 'Failed'}`;
    else subText = 'Queued';

    const actionHtml = st === 'completed'
      ? `<button class="mini-btn open-folder-btn">Folder</button>`
      : st === 'downloading'
      ? `<button class="mini-btn pause-btn">Pause</button>`
      : `<button class="mini-btn go resume-btn">Resume</button>`;

    row.innerHTML = `
      <div class="dl-top">
        <div class="row-info">
          <div class="row-title" title="${escapeHtml(d.filename)}">${escapeHtml(d.filename)}</div>
          <div class="row-sub">${escapeHtml(subText)}</div>
        </div>
        <div class="row-actions">
          ${actionHtml}
          <button class="mini-btn cancel-btn" title="Remove">✕</button>
        </div>
      </div>
      <div class="dl-progress-bg">
        <div class="dl-progress-fill" style="width:${pct}%"></div>
      </div>
    `;

    row.querySelector('.pause-btn')?.addEventListener('click', () => postDaemon(`downloads/${d.id}/pause`));
    row.querySelector('.resume-btn')?.addEventListener('click', () => postDaemon(`downloads/${d.id}/resume`));
    row.querySelector('.open-folder-btn')?.addEventListener('click', () => postDaemon(`downloads/${d.id}/open-folder`));
    row.querySelector('.cancel-btn')?.addEventListener('click', () => postDaemon(`downloads/${d.id}/cancel`));

    downloadsListEl.appendChild(row);
  });
}

async function postDaemon(path) {
  try {
    await fetch(`${DAEMON_API}/${path}`, { method: 'POST', body: '{}' });
    refreshDaemonState();
  } catch {
    // Ignore
  }
}

document.getElementById('btn-open-dl-folder').addEventListener('click', () => postDaemon('downloads/open-dir'));

// Quick Add Download
document.getElementById('btn-quick-start').addEventListener('click', () => {
  const urlInput = document.getElementById('quick-url');
  const url = urlInput.value.trim();
  const conns = parseInt(document.getElementById('quick-conns').value, 10) || 8;
  if (!url) return;

  const btn = document.getElementById('btn-quick-start');
  btn.textContent = 'Starting...';

  chrome.runtime.sendMessage(
    { type: 'START_DOWNLOAD', data: { url, connections: conns } },
    (res) => {
      urlInput.value = '';
      btn.textContent = res && res.success ? '✓ Added!' : 'Offline';
      setTimeout(() => (btn.textContent = 'Download Now'), 1500);
      refreshDaemonState();
    }
  );
});

// Settings Binding
const toggleInterception = document.getElementById('toggle-interception');
const toggleSniffer = document.getElementById('toggle-sniffer');
const minSizeSelect = document.getElementById('min-size-select');

chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
  if (res && res.settings) {
    toggleInterception.checked = res.settings.interceptionEnabled;
    toggleSniffer.checked = res.settings.mediaSnifferEnabled;
    if (res.settings.minFileSizeKB !== undefined) {
      minSizeSelect.value = String(res.settings.minFileSizeKB);
    }
  }
});

toggleInterception.addEventListener('change', () => {
  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: { interceptionEnabled: toggleInterception.checked } });
});
toggleSniffer.addEventListener('change', () => {
  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: { mediaSnifferEnabled: toggleSniffer.checked } });
});
minSizeSelect.addEventListener('change', () => {
  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: { minFileSizeKB: parseInt(minSizeSelect.value, 10) } });
});

scanCurrentTabMedia();
refreshDaemonState();
setInterval(refreshDaemonState, 1500);
