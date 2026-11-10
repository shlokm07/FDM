import React, { useState, useEffect } from 'react';
import { FolderOpen, X, Save, RefreshCw, Download } from 'lucide-react';
import type { AppSettings } from '../types';
import { getHostBridge } from '../lib/formatters';

interface AddDownloadModalProps {
  open: boolean;
  defaultDir: string;
  onClose: () => void;
  onStartDownload: (payload: {
    url: string;
    filename?: string;
    outputPath?: string;
    connections: number;
  }) => void;
}

export function AddDownloadModal({ open, defaultDir, onClose, onStartDownload }: AddDownloadModalProps) {
  const [url, setUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [folder, setFolder] = useState(defaultDir);
  const [connections, setConnections] = useState(8);

  useEffect(() => {
    if (open) {
      setFolder(defaultDir);
    }
  }, [open, defaultDir]);

  if (!open) return null;

  const handleBrowse = async () => {
    const picked = await getHostBridge().pickFolder(folder);
    if (picked) setFolder(picked);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    const cleanName = filename.trim();
    const cleanDir = folder.trim();
    const payload: { url: string; filename?: string; outputPath?: string; connections: number } = {
      url: cleanUrl,
      connections,
    };

    if (cleanName) {
      payload.filename = cleanName;
      if (cleanDir) payload.outputPath = `${cleanDir}\\${cleanName}`;
    } else if (cleanDir && cleanDir !== defaultDir) {
      let inferred = `download-${Date.now()}.bin`;
      try {
        const parsed = new URL(cleanUrl);
        const base = parsed.pathname.split('/').pop();
        if (base) inferred = decodeURIComponent(base);
      } catch {
        // Keep fallback
      }
      payload.outputPath = `${cleanDir}\\${inferred}`;
    }

    onStartDownload(payload);
    setUrl('');
    setFilename('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-3.5 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Add New Download</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Download URL (HTTP / HTTPS / M3U8)
            </label>
            <input
              type="url"
              required
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/archive.zip"
              className="w-full h-9 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Custom Filename (Optional)
              </label>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Auto-detected from server"
                className="w-full h-9 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Parallel Connections
              </label>
              <select
                value={connections}
                onChange={(e) => setConnections(parseInt(e.target.value, 10))}
                className="w-full h-9 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value={4}>4 Connections</option>
                <option value={8}>8 Connections (Recommended)</option>
                <option value={16}>16 Connections (High Speed)</option>
                <option value={32}>32 Connections (Maximum)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Save Destination Folder
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={handleBrowse}
                className="h-9 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] hover:bg-[var(--hover-bg)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Browse
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--border-color)] bg-[var(--subtle-bg)]/50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] hover:bg-[var(--hover-bg)] text-xs font-medium text-[var(--text-primary)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold cursor-pointer"
          >
            Start Download
          </button>
        </div>
      </form>
    </div>
  );
}

interface SettingsPanelProps {
  settings: AppSettings;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSaveSettings: (updated: Partial<AppSettings>) => Promise<void>;
  onScanFolder: () => Promise<void>;
}

export function SettingsPanel({
  settings,
  theme,
  onToggleTheme,
  onSaveSettings,
  onScanFolder,
}: SettingsPanelProps) {
  const [downloadDir, setDownloadDir] = useState(settings.downloadDir);
  const [maxConcurrent, setMaxConcurrent] = useState(settings.maxConcurrentDownloads);
  const [clipboardAuto, setClipboardAuto] = useState(settings.clipboardAutoCapture);
  const [savedToast, setSavedToast] = useState('');

  useEffect(() => {
    setDownloadDir(settings.downloadDir);
    setMaxConcurrent(settings.maxConcurrentDownloads);
    setClipboardAuto(settings.clipboardAutoCapture);
  }, [settings]);

  const handleBrowse = async () => {
    const picked = await getHostBridge().pickFolder(downloadDir);
    if (picked) setDownloadDir(picked);
  };

  const handleSave = async () => {
    await onSaveSettings({
      downloadDir,
      maxConcurrentDownloads: maxConcurrent,
      clipboardAutoCapture: clipboardAuto,
    });
    setSavedToast('Settings saved successfully.');
    setTimeout(() => setSavedToast(''), 2500);
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Application Settings</h2>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Configure storage paths, queue concurrency, clipboard interception, and theme preferences.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
            Default Download Location
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={downloadDir}
              onChange={(e) => setDownloadDir(e.target.value)}
              className="flex-1 h-9 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] text-xs text-[var(--text-primary)]"
            />
            <button
              type="button"
              onClick={handleBrowse}
              className="h-9 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] hover:bg-[var(--hover-bg)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" /> Browse
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-color)]">
          <div>
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
              Max Simultaneous Downloads
            </label>
            <select
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(parseInt(e.target.value, 10))}
              className="w-full h-9 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] text-xs text-[var(--text-primary)]"
            >
              {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {n} concurrent {n === 1 ? 'download' : 'downloads'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
              Appearance Theme
            </label>
            <button
              type="button"
              onClick={onToggleTheme}
              className="w-full h-9 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] hover:bg-[var(--hover-bg)] text-xs font-medium text-[var(--text-primary)] text-left cursor-pointer"
            >
              Active: {theme === 'dark' ? 'Windows 11 Dark (Obsidian)' : 'Windows 11 Light (Mica)'} — Click to Switch
            </button>
          </div>
        </div>

        <label className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] cursor-pointer">
          <div>
            <div className="text-xs font-medium text-[var(--text-primary)]">Clipboard Auto-Capture</div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Automatically queue direct downloadable URLs copied to the Windows clipboard.
            </div>
          </div>
          <input
            type="checkbox"
            checked={clipboardAuto}
            onChange={(e) => setClipboardAuto(e.target.checked)}
            className="w-4 h-4 accent-emerald-500 cursor-pointer"
          />
        </label>

        <div className="pt-3 border-t border-[var(--border-color)] flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onScanFolder}
            className="h-9 px-3.5 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] hover:bg-[var(--hover-bg)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Scan Downloads Folder
          </button>

          <div className="flex items-center gap-3">
            {savedToast && <span className="text-xs text-emerald-500 font-medium">{savedToast}</span>}
            <button
              type="button"
              onClick={handleSave}
              className="h-9 px-4 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

