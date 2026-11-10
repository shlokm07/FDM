(function () {
  const networkStreams = new Map(); // url -> mediaObj
  let snifferBar = null;
  let activeVideoEl = null;
  let hideTimeout = null;
  let menuOpen = false;

  // Hydrate previously detected media for this tab on load
  chrome.runtime.sendMessage({ type: 'GET_TAB_MEDIA' }, (res) => {
    if (res && Array.isArray(res.media)) {
      res.media.forEach((m) => {
        if (m && m.url) networkStreams.set(m.url, m);
      });
      refreshDropdownItems();
    }
  });

  // Listen for live stream detections, toast feedback, and DOM scan requests
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'MEDIA_DETECTED' && msg.media?.url) {
      networkStreams.set(msg.media.url, msg.media);
      if (Array.isArray(msg.allMedia)) {
        msg.allMedia.forEach((m) => {
          if (m && m.url) networkStreams.set(m.url, m);
        });
      }
      refreshDropdownItems();
      updateBarVisibility();
    } else if (msg.type === 'SCAN_DOM_MEDIA') {
      sendResponse({ items: collectPageDomMedia() });
    } else if (msg.type === 'OPEN_BATCH_GRABBER') {
      if (Array.isArray(msg.networkMedia)) {
        msg.networkMedia.forEach((m) => {
          if (m && m.url) networkStreams.set(m.url, m);
        });
      }
      openBatchGrabberModal();
    } else if (msg.type === 'REA_TOAST') {
      showPageToast(msg.message, msg.success);
    }
  });

  function collectDirectVideoSources() {
    const found = [];
    document.querySelectorAll('video, audio').forEach((el) => {
      const candidates = [];
      if (el.currentSrc && !el.currentSrc.startsWith('blob:') && !el.currentSrc.startsWith('data:')) {
        candidates.push(el.currentSrc);
      }
      if (el.src && !el.src.startsWith('blob:') && !el.src.startsWith('data:')) {
        candidates.push(el.src);
      }
      el.querySelectorAll('source').forEach((srcEl) => {
        if (srcEl.src && !srcEl.src.startsWith('blob:') && !srcEl.src.startsWith('data:')) {
          candidates.push(srcEl.src);
        }
      });

      candidates.forEach((u) => {
        if (!found.some((x) => x.url === u)) {
          const isAudio = el.tagName === 'AUDIO' || /\.(mp3|m4a|aac|ogg|flac|wav)(\?|$)/i.test(u);
          found.push({
            url: u,
            label: cleanLabelFromUrl(u, isAudio ? 'Page Audio' : 'Page Video'),
            ext: guessExt(u, isAudio ? 'MP3' : 'MP4'),
            category: isAudio ? 'Audio' : 'Video',
            qualityHint: el.videoHeight ? `${el.videoHeight}p` : 'Direct Source',
            sizeBytes: 0
          });
        }
      });
    });
    return found;
  }

  function collectPageDomMedia() {
    const items = new Map();

    // 1. Add all network-sniffed streams
    for (const [url, m] of networkStreams.entries()) {
      items.set(url, m);
    }

    // 2. Add HTML5 video/audio sources
    collectDirectVideoSources().forEach((m) => {
      if (!items.has(m.url)) items.set(m.url, m);
    });

    // 3. Downloadable anchor links (archives, docs, programs, media)
    const fileExtRegex = /\.(mp4|mkv|webm|mov|mp3|m4a|flac|zip|rar|7z|tar|gz|iso|exe|msi|apk|pdf|docx?|xlsx?|pptx?)(\?|$)/i;
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.href;
      if (!href || !href.startsWith('http')) return;
      if (fileExtRegex.test(href) && !items.has(href)) {
        const ext = guessExt(href, 'FILE');
        let cat = 'Files';
        if (['MP4', 'MKV', 'WEBM', 'MOV'].includes(ext)) cat = 'Video';
        else if (['MP3', 'M4A', 'FLAC'].includes(ext)) cat = 'Audio';

        const linkText = (a.textContent || '').trim();
        items.set(href, {
          url: href,
          label: linkText.length > 2 && linkText.length < 48 ? linkText : cleanLabelFromUrl(href, 'Download Link'),
          ext,
          category: cat,
          qualityHint: 'Page Link',
          sizeBytes: 0
        });
      }
    });

    // 4. High-res images (> 200px)
    document.querySelectorAll('img[src]').forEach((img) => {
      if (img.src && img.src.startsWith('http') && img.naturalWidth >= 260 && img.naturalHeight >= 200) {
        if (!items.has(img.src)) {
          items.set(img.src, {
            url: img.src,
            label: img.alt ? img.alt.slice(0, 42) : cleanLabelFromUrl(img.src, 'Image'),
            ext: guessExt(img.src, 'IMG'),
            category: 'Images',
            qualityHint: `${img.naturalWidth}×${img.naturalHeight}`,
            sizeBytes: 0
          });
        }
      }
    });

    return Array.from(items.values());
  }

  function monitorVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach((vid) => {
      if (!vid.dataset.reaMonitored) {
        vid.dataset.reaMonitored = 'true';

        vid.addEventListener('play', () => {
          activeVideoEl = vid;
          showBarForVideo(vid);
        });

        vid.addEventListener('mouseenter', () => {
          clearTimeout(hideTimeout);
          activeVideoEl = vid;
          showBarForVideo(vid);
        });

        vid.addEventListener('mouseleave', () => {
          scheduleHideBar();
        });

        if (!vid.paused && vid.currentTime > 0) {
          activeVideoEl = vid;
          showBarForVideo(vid);
        }
      }
    });
  }

  function scheduleHideBar() {
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      if (!menuOpen && snifferBar && !snifferBar.matches(':hover')) {
        snifferBar.style.display = 'none';
      }
    }, 1800);
  }

  function ensureSnifferBar() {
    if (snifferBar) return snifferBar;

    snifferBar = document.createElement('div');
    snifferBar.className = 'rea-idm-video-bar';
    snifferBar.innerHTML = `
      <div class="rea-idm-btn-main" title="Click to choose quality or grab media">
        <span class="rea-idm-logo-dot">↓</span>
        <span class="rea-idm-text">Download Video</span>
        <span class="rea-idm-count-badge">0</span>
        <span class="rea-idm-chevron">▾</span>
      </div>
      <div class="rea-idm-menu hidden">
        <div class="rea-idm-menu-header">
          <span>Detected Streams</span>
          <button type="button" class="rea-idm-grab-all-btn">⚡ Grab All Media</button>
        </div>
        <div class="rea-idm-stream-list"></div>
      </div>
    `;

    document.documentElement.appendChild(snifferBar);

    snifferBar.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
    snifferBar.addEventListener('mouseleave', () => scheduleHideBar());

    const mainBtn = snifferBar.querySelector('.rea-idm-btn-main');
    const menu = snifferBar.querySelector('.rea-idm-menu');
    const grabAllBtn = snifferBar.querySelector('.rea-idm-grab-all-btn');

    mainBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menuOpen = menu.classList.contains('hidden');
      menu.classList.toggle('hidden');
      if (menuOpen) refreshDropdownItems();
    });

    grabAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menuOpen = false;
      menu.classList.add('hidden');
      openBatchGrabberModal();
    });

    document.addEventListener('click', (e) => {
      if (snifferBar && !snifferBar.contains(e.target)) {
        menuOpen = false;
        menu.classList.add('hidden');
      }
    });

    return snifferBar;
  }

  function getPlayableStreamList() {
    const combined = new Map(networkStreams);
    collectDirectVideoSources().forEach((m) => {
      if (!combined.has(m.url)) combined.set(m.url, m);
    });
    return Array.from(combined.values()).filter((m) => m.category === 'Video' || m.category === 'Audio');
  }

  function refreshDropdownItems() {
    if (!snifferBar) return;

    const streams = getPlayableStreamList();
    const badge = snifferBar.querySelector('.rea-idm-count-badge');
    const listEl = snifferBar.querySelector('.rea-idm-stream-list');

    badge.textContent = String(streams.length);
    badge.style.display = streams.length > 0 ? 'inline-flex' : 'none';
    listEl.innerHTML = '';

    if (streams.length === 0) {
      listEl.innerHTML = `
        <div class="rea-idm-empty-hint">
          No direct media URL sniffed yet for this player.<br>
          Try playing for a few seconds or click <strong>Grab All Media</strong> above.
        </div>
      `;
      return;
    }

    streams.slice(0, 8).forEach((stream) => {
      const row = document.createElement('div');
      row.className = 'rea-idm-menu-item';

      const metaParts = [stream.ext];
      if (stream.qualityHint) metaParts.push(stream.qualityHint);
      if (stream.sizeBytes > 0) metaParts.push(formatSize(stream.sizeBytes));

      row.innerHTML = `
        <div class="rea-idm-item-info">
          <div class="rea-idm-item-title">${escapeHtml(stream.label)}</div>
          <div class="rea-idm-item-meta">${escapeHtml(metaParts.join(' • '))}</div>
        </div>
        <div class="rea-idm-item-actions">
          <button type="button" class="rea-idm-copy-btn" title="Copy URL">⧉</button>
          <span class="rea-idm-dl-pill">Download</span>
        </div>
      `;

      row.querySelector('.rea-idm-copy-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(stream.url);
        showPageToast('Stream URL copied to clipboard!', true);
      });

      row.addEventListener('click', (e) => {
        e.stopPropagation();
        menuOpen = false;
        snifferBar.querySelector('.rea-idm-menu').classList.add('hidden');
        sendDownloadToRea(stream);
      });

      listEl.appendChild(row);
    });
  }

  function showBarForVideo(videoEl) {
    if (!videoEl) return;
    const rect = videoEl.getBoundingClientRect();
    if (rect.width < 140 || rect.height < 90 || rect.bottom < 0 || rect.top > window.innerHeight) {
      if (snifferBar && !menuOpen) snifferBar.style.display = 'none';
      return;
    }

    const bar = ensureSnifferBar();
    refreshDropdownItems();

    const barWidth = 195;
    const left = Math.min(window.innerWidth - barWidth - 12, Math.max(8, rect.right - barWidth - 12));
    const top = Math.max(8, rect.top + 12);

    bar.style.top = `${top}px`;
    bar.style.left = `${left}px`;
    bar.style.display = 'block';
  }

  function updateBarVisibility() {
    if (activeVideoEl) {
      showBarForVideo(activeVideoEl);
    } else {
      const playing = Array.from(document.querySelectorAll('video')).find((v) => !v.paused);
      if (playing) {
        activeVideoEl = playing;
        showBarForVideo(playing);
      }
    }
  }

  function sendDownloadToRea(stream) {
    const textSpan = snifferBar?.querySelector('.rea-idm-text');
    if (textSpan) textSpan.textContent = 'Sending...';

    chrome.runtime.sendMessage(
      {
        type: 'START_DOWNLOAD',
        data: {
          url: stream.url,
          pageUrl: window.location.href,
          referer: window.location.href,
          title: document.title,
          downloadMode: stream.category === 'Audio' ? 'audio' : 'best'
        }
      },
      (res) => {
        if (res && res.success) {
          if (textSpan) textSpan.textContent = '✓ Added!';
          showPageToast(`Downloading: ${res.filename || stream.label}`, true);
        } else {
          if (textSpan) textSpan.textContent = 'Offline';
          showPageToast('REA-IDM Desktop App is offline. Open extension to launch.', false);
        }
        setTimeout(() => {
          if (textSpan) textSpan.textContent = 'Download Video';
        }, 2500);
      }
    );
  }

  function openBatchGrabberModal() {
    const existing = document.getElementById('rea-idm-batch-overlay');
    if (existing) existing.remove();

    const allItems = collectPageDomMedia();
    let currentFilter = 'All';

    const overlay = document.createElement('div');
    overlay.id = 'rea-idm-batch-overlay';
    overlay.innerHTML = `
      <div class="rea-idm-modal">
        <div class="rea-idm-modal-head">
          <div>
            <h3>REA-IDM Page Media & Link Grabber</h3>
            <p>${allItems.length} downloadable resources found on this page</p>
          </div>
          <button type="button" class="rea-idm-modal-close">✕</button>
        </div>
        <div class="rea-idm-modal-filters">
          <button type="button" class="active" data-cat="All">All</button>
          <button type="button" data-cat="Video">Video</button>
          <button type="button" data-cat="Audio">Audio</button>
          <button type="button" data-cat="Files">Archives & Docs</button>
          <button type="button" data-cat="Images">Images</button>
        </div>
        <div class="rea-idm-modal-list"></div>
        <div class="rea-idm-modal-foot">
          <label class="rea-idm-select-all">
            <input type="checkbox" id="rea-idm-chk-all" checked> Select All Visible
          </label>
          <div class="rea-idm-modal-btns">
            <button type="button" class="rea-idm-btn-cancel">Cancel</button>
            <button type="button" class="rea-idm-btn-go">Download Selected</button>
          </div>
        </div>
      </div>
    `;

    document.documentElement.appendChild(overlay);

    const listContainer = overlay.querySelector('.rea-idm-modal-list');
    const chkAll = overlay.querySelector('#rea-idm-chk-all');
    const selectedUrls = new Set(allItems.map((i) => i.url));

    function renderList() {
      const visible = allItems.filter((i) => currentFilter === 'All' || i.category === currentFilter);
      listContainer.innerHTML = '';

      if (visible.length === 0) {
        listContainer.innerHTML = '<div class="rea-idm-empty-modal">No items in this category.</div>';
        return;
      }

      visible.forEach((item) => {
        const row = document.createElement('label');
        row.className = 'rea-idm-grab-row';
        const checked = selectedUrls.has(item.url) ? 'checked' : '';
        const sizeStr = item.sizeBytes > 0 ? formatSize(item.sizeBytes) : item.qualityHint || item.category;

        row.innerHTML = `
          <input type="checkbox" ${checked}>
          <span class="rea-idm-ext-tag">${escapeHtml(item.ext)}</span>
          <div class="rea-idm-grab-info">
            <div class="rea-idm-grab-name">${escapeHtml(item.label)}</div>
            <div class="rea-idm-grab-url">${escapeHtml(item.url)}</div>
          </div>
          <span class="rea-idm-grab-size">${escapeHtml(sizeStr)}</span>
        `;

        row.querySelector('input').addEventListener('change', (ev) => {
          if (ev.target.checked) selectedUrls.add(item.url);
          else selectedUrls.delete(item.url);
        });

        listContainer.appendChild(row);
      });
    }

    overlay.querySelectorAll('.rea-idm-modal-filters button').forEach((btn) => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.rea-idm-modal-filters button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-cat');
        renderList();
      });
    });

    chkAll.addEventListener('change', () => {
      const visible = allItems.filter((i) => currentFilter === 'All' || i.category === currentFilter);
      visible.forEach((i) => {
        if (chkAll.checked) selectedUrls.add(i.url);
        else selectedUrls.delete(i.url);
      });
      renderList();
    });

    overlay.querySelector('.rea-idm-modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.rea-idm-btn-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.rea-idm-btn-go').addEventListener('click', () => {
      const batch = allItems
        .filter((i) => selectedUrls.has(i.url))
        .map((i) => ({
          url: i.url,
          referer: window.location.href,
          title: i.label,
          downloadMode: i.category === 'Audio' ? 'audio' : 'best'
        }));

      if (batch.length === 0) return;

      chrome.runtime.sendMessage({ type: 'BATCH_DOWNLOAD', items: batch }, (res) => {
        if (res && res.success) {
          showPageToast(`Queued ${batch.length} downloads in REA-IDM!`, true);
        } else {
          showPageToast('REA-IDM Desktop App is offline.', false);
        }
        overlay.remove();
      });
    });

    renderList();
  }

  function showPageToast(message, isSuccess) {
    let toast = document.getElementById('rea-idm-page-toast');
    if (toast) toast.remove();

    toast = document.createElement('div');
    toast.id = 'rea-idm-page-toast';
    toast.className = isSuccess ? 'rea-idm-toast success' : 'rea-idm-toast error';
    toast.textContent = message;
    document.documentElement.appendChild(toast);

    setTimeout(() => {
      toast?.remove();
    }, 3200);
  }

  function cleanLabelFromUrl(url, fallback) {
    try {
      const u = new URL(url);
      const name = decodeURIComponent(u.pathname.split('/').pop() || '');
      if (name && name.length > 2) return name.slice(0, 44);
    } catch {
      // Ignore
    }
    return fallback;
  }

  function guessExt(url, fallback) {
    const m = url.toLowerCase().match(/\.([a-z0-9]{2,5})(\?|$)/);
    return m ? m[1].toUpperCase() : fallback;
  }

  function formatSize(bytes) {
    if (!bytes || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  setInterval(monitorVideos, 1500);
  monitorVideos();

  window.addEventListener('scroll', () => {
    if (activeVideoEl && snifferBar && snifferBar.style.display !== 'none') {
      showBarForVideo(activeVideoEl);
    }
  }, { passive: true });
})();
