const NATIVE_HOST_NAME = 'com.rea.idm';
const DAEMON_API_URL = 'http://127.0.0.1:8765/api';

let settings = {
  interceptionEnabled: true,
  mediaSnifferEnabled: true,
  minFileSizeKB: 100
};

// Track sniffed network streams per tabId -> Map<url, mediaObj>
const tabMediaMap = new Map();

chrome.storage.local.get(['settings'], (res) => {
  if (res.settings) {
    settings = { ...settings, ...res.settings };
  }
});

// Setup interactive right-click context menus
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'rea-download-link',
      title: 'Download with FDM - Fluent Download Manager',
      contexts: ['link', 'image', 'video', 'audio']
    });

    chrome.contextMenus.create({
      id: 'rea-download-page-media',
      title: 'FDM: Grab All Media & Links on Page',
      contexts: ['page']
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'rea-download-page-media' && tab && tab.id >= 0) {
    const networkMedia = getTabMediaList(tab.id);
    chrome.tabs.sendMessage(tab.id, {
      type: 'OPEN_BATCH_GRABBER',
      networkMedia
    }).catch(() => {});
    return;
  }

  const targetUrl = info.linkUrl || info.srcUrl;
  if (targetUrl && !targetUrl.startsWith('blob:') && !targetUrl.startsWith('data:')) {
    const result = await dispatchDownloadToDaemon({
      url: targetUrl,
      referer: tab ? tab.url : '',
      title: tab ? tab.title : ''
    });
    if (tab && tab.id >= 0) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'REA_TOAST',
        success: result.success,
        message: result.success
          ? `Sent to FDM: ${result.filename || 'Download started'}`
          : 'FDM - Fluent Download Manager is offline. Please open FDM.'
      }).catch(() => {});
    }
  }
});

// Intercept standard browser downloads cleanly
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  if (!settings.interceptionEnabled) return;
  if (downloadItem.byExtensionId === chrome.runtime.id) return;

  const url = downloadItem.finalUrl || downloadItem.url;
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return;

  // Respect minimum size filter if known (>0 bytes)
  const minBytes = (settings.minFileSizeKB || 0) * 1024;
  if (downloadItem.totalBytes > 0 && minBytes > 0 && downloadItem.totalBytes < minBytes) {
    return;
  }

  try {
    await chrome.downloads.cancel(downloadItem.id);
    await chrome.downloads.erase({ id: downloadItem.id });
  } catch {
    // Already completed or cancelled
  }

  await dispatchDownloadToDaemon({
    url,
    filename: downloadItem.filename ? downloadItem.filename.split(/[\\/]/).pop() : undefined,
    referer: downloadItem.referrer || '',
    totalBytes: downloadItem.totalBytes
  });
});

// Sniff streaming video/audio & media URLs in real time per tab
const mediaMimePrefixes = [
  'video/',
  'audio/',
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
  'application/dash+xml'
];

const mediaExtRegex = /\.(mp4|mkv|webm|mov|flv|m4v|mp3|m4a|aac|flac|ogg|opus|m3u8|mpd)(\?|$)/i;

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!settings.mediaSnifferEnabled) return;
    if (details.tabId < 0) return;

    let contentType = '';
    let contentLength = 0;

    if (details.responseHeaders) {
      for (const h of details.responseHeaders) {
        const name = h.name.toLowerCase();
        if (name === 'content-type' && h.value) contentType = h.value.toLowerCase();
        if (name === 'content-length' && h.value) contentLength = parseInt(h.value, 10) || 0;
      }
    }

    const lowerUrl = details.url.toLowerCase();
    const isManifest = lowerUrl.includes('.m3u8') || lowerUrl.includes('.mpd');
    const isMimeMatch = mediaMimePrefixes.some((p) => contentType.startsWith(p));
    const isExtMatch = mediaExtRegex.test(lowerUrl);

    if (!isMimeMatch && !isExtMatch && !isManifest) return;

    // Ignore tiny media chunks/thumbnails (< 40 KB) unless HLS/DASH manifest
    if (!isManifest && contentLength > 0 && contentLength < 40 * 1024) return;
    // Skip raw HLS .ts segment spam when manifest or main video exists
    if (lowerUrl.includes('.ts') && (lowerUrl.includes('seg') || lowerUrl.includes('chunk'))) return;

    const mediaObj = buildMediaEntry(details.url, contentType, contentLength, isManifest);
    addTabMedia(details.tabId, mediaObj);
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

function buildMediaEntry(rawUrl, contentType, contentLength, isManifest) {
  let cleanUrl = rawUrl;
  let ext = 'MP4';
  let category = 'Video';
  let qualityHint = '';

  try {
    const u = new URL(rawUrl);
    // Strip partial range param from videoplayback URLs
    if (u.pathname.includes('videoplayback') && u.searchParams.has('range')) {
      u.searchParams.delete('range');
      cleanUrl = u.toString();
    }

    const mimeParam = (u.searchParams.get('mime') || contentType || '').toLowerCase();
    if (isManifest || u.pathname.toLowerCase().endsWith('.m3u8')) {
      ext = 'HLS';
    } else if (u.pathname.toLowerCase().endsWith('.mpd')) {
      ext = 'DASH';
    } else if (mimeParam.includes('audio') || /\.(mp3|m4a|aac|flac|ogg|opus)(\?|$)/i.test(rawUrl)) {
      category = 'Audio';
      if (mimeParam.includes('mpeg') || rawUrl.includes('.mp3')) ext = 'MP3';
      else if (mimeParam.includes('webm')) ext = 'WEBM';
      else ext = 'M4A';
    } else if (mimeParam.includes('webm') || rawUrl.includes('.webm')) {
      ext = 'WEBM';
    } else if (rawUrl.includes('.mkv')) {
      ext = 'MKV';
    }

    const qMatch = rawUrl.match(/(2160p|1440p|1080p|720p|480p|360p|hd|4k)/i);
    if (qMatch) qualityHint = qMatch[1].toUpperCase();
    else if (category === 'Audio') qualityHint = 'Audio Stream';
    else if (isManifest) qualityHint = 'Adaptive Stream';
  } catch {
    // Keep defaults
  }

  let label = cleanUrl.split('/').pop()?.split('?')[0] || 'Media Stream';
  if (label.length > 44) label = label.slice(0, 41) + '...';
  if (label === 'videoplayback' || label.length < 3) {
    label = `${category} Stream (${ext})`;
  }

  return {
    url: cleanUrl,
    label,
    ext,
    category,
    qualityHint,
    contentType,
    sizeBytes: contentLength,
    isStreamManifest: isManifest,
    detectedAt: Date.now()
  };
}

function addTabMedia(tabId, mediaObj) {
  if (!tabMediaMap.has(tabId)) {
    tabMediaMap.set(tabId, new Map());
  }
  const map = tabMediaMap.get(tabId);
  if (!map.has(mediaObj.url)) {
    map.set(mediaObj.url, mediaObj);
    const list = Array.from(map.values());
    updateBadgeForTab(tabId, list.length);

    chrome.tabs.sendMessage(tabId, {
      type: 'MEDIA_DETECTED',
      media: mediaObj,
      allMedia: list
    }).catch(() => {});
  }
}

function getTabMediaList(tabId) {
  const map = tabMediaMap.get(tabId);
  return map ? Array.from(map.values()) : [];
}

function updateBadgeForTab(tabId, count) {
  try {
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#4F46E5', tabId });
  } catch {
    // Ignore closed tabs
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  tabMediaMap.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    tabMediaMap.delete(tabId);
    updateBadgeForTab(tabId, 0);
  }
});

// Native Messaging + Local HTTP Daemon Bridge
async function dispatchDownloadToDaemon(downloadData) {
  // 1. Direct HTTP check first if daemon is already listening
  try {
    const resp = await fetch(`${DAEMON_API_URL}/downloads/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(downloadData)
    });
    if (resp.ok) {
      const json = await resp.json();
      flashActionBadge('↓');
      return { success: true, filename: json.item?.filename || downloadData.filename };
    }
  } catch {
    // Fall back to Native Messaging Host (which auto-starts REA-IDM if offline)
  }

  // 2. Native Messaging Host fallback (will wake up REA-IDM daemon automatically!)
  try {
    const res = await new Promise((resolve, reject) => {
      chrome.runtime.sendNativeMessage(
        NATIVE_HOST_NAME,
        { action: 'DOWNLOAD', data: downloadData },
        (response) => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve(response);
        }
      );
    });
    if (res && res.success) {
      flashActionBadge('↓');
      return { success: true, filename: res.filename || downloadData.filename };
    }
  } catch {
    // Both paths unreachable
  }

  return { success: false, offline: true };
}

async function dispatchBatchToDaemon(items) {
  try {
    const resp = await fetch(`${DAEMON_API_URL}/downloads/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    if (resp.ok) {
      flashActionBadge('↓');
      return { success: true, count: items.length };
    }
  } catch {
    // Fallback via native host
  }

  try {
    const res = await new Promise((resolve, reject) => {
      chrome.runtime.sendNativeMessage(
        NATIVE_HOST_NAME,
        { action: 'BATCH_DOWNLOAD', data: { items } },
        (response) => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve(response);
        }
      );
    });
    if (res && res.success) {
      flashActionBadge('↓');
      return { success: true, count: items.length };
    }
  } catch {
    // Offline
  }

  return { success: false, offline: true };
}

async function openDesktopApp() {
  try {
    const resp = await fetch(`${DAEMON_API_URL}/app/focus`, { method: 'POST' });
    if (resp.ok) return { success: true };
  } catch {
    // Try launching via Native Host
  }

  return new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, { action: 'OPEN_APP' }, () => {
        resolve({ success: !chrome.runtime.lastError });
      });
    } catch {
      resolve({ success: false });
    }
  });
}

function flashActionBadge(text) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' });
  setTimeout(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const count = getTabMediaList(tabs[0].id).length;
        updateBadgeForTab(tabs[0].id, count);
      }
    });
  }, 2200);
}

// Unified Message Handler for Content Scripts & Popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === 'START_DOWNLOAD') {
      const result = await dispatchDownloadToDaemon(msg.data);
      sendResponse(result);
    } else if (msg.type === 'BATCH_DOWNLOAD') {
      const result = await dispatchBatchToDaemon(msg.items || []);
      sendResponse(result);
    } else if (msg.type === 'OPEN_DESKTOP_APP') {
      const result = await openDesktopApp();
      sendResponse(result);
    } else if (msg.type === 'GET_TAB_MEDIA') {
      const tabId = msg.tabId ?? sender.tab?.id;
      sendResponse({ media: tabId >= 0 ? getTabMediaList(tabId) : [] });
    } else if (msg.type === 'GET_SETTINGS') {
      sendResponse({ settings });
    } else if (msg.type === 'UPDATE_SETTINGS') {
      settings = { ...settings, ...msg.settings };
      chrome.storage.local.set({ settings });
      sendResponse({ success: true, settings });
    } else {
      sendResponse({ error: 'Unknown message' });
    }
  })();
  return true;
});
