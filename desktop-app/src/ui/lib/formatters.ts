export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0 || Number.isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return `${val >= 100 ? val.toFixed(0) : val >= 10 ? val.toFixed(1) : val.toFixed(2)} ${units[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(seconds: number, status?: string): string {
  if (status === 'completed') return 'Completed';
  if (status === 'paused') return 'Paused';
  if (status === 'idle') return 'In queue';
  if (status === 'error') return 'Failed';
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds)) {
    return status === 'downloading' ? 'Calculating...' : '--';
  }

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function formatDate(epochMs?: number): string {
  if (!epochMs || epochMs <= 0) return '--';
  const d = new Date(epochMs);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  if (isToday) {
    return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function getHostBridge(): {
  pickFolder: (initialDir?: string) => Promise<string | null>;
} {
  const w = window as any;
  return {
    pickFolder: (initialDir?: string) => {
      return new Promise((resolve) => {
        if (w.chrome?.webview) {
          const reqId = `pick-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const handler = (ev: any) => {
            try {
              const msg = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
              if (msg && msg.type === 'FOLDER_PICKED' && msg.reqId === reqId) {
                w.chrome.webview.removeEventListener('message', handler);
                resolve(msg.path || null);
              }
            } catch {
              // Ignore unrelated messages
            }
          };
          w.chrome.webview.addEventListener('message', handler);
          w.chrome.webview.postMessage(JSON.stringify({ type: 'PICK_FOLDER', reqId, initialDir: initialDir || '' }));
          setTimeout(() => {
            w.chrome.webview.removeEventListener('message', handler);
            resolve(null);
          }, 60000);
        } else {
          resolve(null);
        }
      });
    },
  };
}

