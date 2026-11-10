import React, { useState, useEffect } from 'react';
import { FolderOpen, X, Save, RefreshCw, Download, Sun, Moon } from 'lucide-react';
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="rea-add-title"
        style={{ boxShadow: 'var(--shadow-popover)' }}
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[500px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] overflow-hidden animate-dialog-in"
      >
        <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent-primary)]">
              <Download className="w-4 h-4" />
            </div>
            <h3 id="rea-add-title" className="text-[15px] font-semibold text-[var(--text-primary)]">
              Add New Download
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="rea-url-input" className="block text-[12.5px] font-medium text-[var(--text-primary)] mb-1.5">
              Download URL
            </label>
            <input
              id="rea-url-input"
              type="url"
              required
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/archive.zip"
              className="w-full h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] focus:bg-[var(--surface-primary)] transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="rea-name-input" className="block text-[12.5px] font-medium text-[var(--text-primary)] mb-1.5">
                Custom Filename <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
              </label>
              <input
                id="rea-name-input"
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Auto-detected from URL"
                className="w-full h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] focus:bg-[var(--surface-primary)] transition-colors"
              />
            </div>

            <div>
              <label htmlFor="rea-conns-select" className="block text-[12.5px] font-medium text-[var(--text-primary)] mb-1.5">
                Parallel Connections
              </label>
              <select
                id="rea-conns-select"
                value={connections}
                onChange={(e) => setConnections(parseInt(e.target.value, 10))}
                className="w-full h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
              >
                <option value={4}>4 Connections</option>
                <option value={8}>8 Connections (Recommended)</option>
                <option value={16}>16 Connections (High Speed)</option>
                <option value={32}>32 Connections (Maximum)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="rea-folder-input" className="block text-[12.5px] font-medium text-[var(--text-primary)] mb-1.5">
              Save Destination Folder
            </label>
            <div className="flex gap-2">
              <input
                id="rea-folder-input"
                type="text"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] focus:bg-[var(--surface-primary)] transition-colors"
              />
              <button
                type="button"
                onClick={handleBrowse}
                className="h-9 px-3.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[12.5px] font-medium text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Browse
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--surface-secondary)]/60 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8.5 px-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] text-[12.5px] font-medium text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-8.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-[12.5px] font-medium transition-colors cursor-pointer active:scale-[0.99]"
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
  const [speedLimit, setSpeedLimit] = useState(settings.globalSpeedLimit);
  const [clipboardAuto, setClipboardAuto] = useState(settings.clipboardAutoCapture);
  const [savedToast, setSavedToast] = useState('');

  useEffect(() => {
    setDownloadDir(settings.downloadDir);
    setMaxConcurrent(settings.maxConcurrentDownloads);
    setSpeedLimit(settings.globalSpeedLimit);
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
      globalSpeedLimit: speedLimit,
      clipboardAutoCapture: clipboardAuto,
    });
    setSavedToast('Settings saved successfully.');
    setTimeout(() => setSavedToast(''), 2500);
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]">Settings</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
          Manage storage folders, download queue concurrency, bandwidth limits, and appearance.
        </p>
      </div>

      {/* Storage Location Section */}
      <section
        style={{ boxShadow: 'var(--shadow-card)' }}
        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[15.5px] font-semibold text-[var(--text-primary)]">Downloads &amp; Storage</h2>
            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
              Choose where completed downloads are written on disk.
            </p>
          </div>
          <button
            type="button"
            onClick={onScanFolder}
            className="h-8.5 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[12px] font-medium text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Scan Folder
          </button>
        </div>

        <div>
          <label htmlFor="rea-settings-dir" className="block text-[12.5px] font-medium text-[var(--text-primary)] mb-1.5">
            Default Download Directory
          </label>
          <div className="flex gap-2">
            <input
              id="rea-settings-dir"
              type="text"
              value={downloadDir}
              onChange={(e) => setDownloadDir(e.target.value)}
              className="flex-1 h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
            <button
              type="button"
              onClick={handleBrowse}
              className="h-9 px-3.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[12.5px] font-medium text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" /> Browse
            </button>
          </div>
        </div>
      </section>

      {/* Queue, Speed Limits & Clipboard Section */}
      <section
        style={{ boxShadow: 'var(--shadow-card)' }}
        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-5 space-y-4"
      >
        <div>
          <h2 className="text-[15.5px] font-semibold text-[var(--text-primary)]">Queue &amp; Bandwidth</h2>
          <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
            Control active transfer concurrency and global speed throttling.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="rea-max-conns" className="block text-[12.5px] font-medium text-[var(--text-primary)] mb-1.5">
              Max Simultaneous Downloads
            </label>
            <select
              id="rea-max-conns"
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(parseInt(e.target.value, 10))}
              className="w-full h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
            >
              {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {n} concurrent {n === 1 ? 'download' : 'downloads'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rea-speed-cap" className="block text-[12.5px] font-medium text-[var(--text-primary)] mb-1.5">
              Global Speed Limit
            </label>
            <select
              id="rea-speed-cap"
              value={speedLimit}
              onChange={(e) => setSpeedLimit(parseInt(e.target.value, 10))}
              className="w-full h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
            >
              <option value={0}>Unlimited Bandwidth</option>
              <option value={524288}>512 KB/s</option>
              <option value={1048576}>1 MB/s</option>
              <option value={5242880}>5 MB/s</option>
              <option value={10485760}>10 MB/s</option>
            </select>
          </div>
        </div>

        <label className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)] cursor-pointer">
          <div>
            <div className="text-[13px] font-medium text-[var(--text-primary)]">Clipboard Auto-Capture</div>
            <div className="text-[12px] text-[var(--text-secondary)]">
              Automatically queue direct downloadable links copied to the Windows clipboard.
            </div>
          </div>
          <input
            type="checkbox"
            checked={clipboardAuto}
            onChange={(e) => setClipboardAuto(e.target.checked)}
            className="w-4 h-4 accent-indigo-600 cursor-pointer"
          />
        </label>
      </section>

      {/* Appearance Section */}
      <section
        style={{ boxShadow: 'var(--shadow-card)' }}
        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-5 space-y-4"
      >
        <div>
          <h2 className="text-[15.5px] font-semibold text-[var(--text-primary)]">Appearance</h2>
          <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
            Switch between Windows 11 Light and Dark themes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => theme === 'dark' && onToggleTheme()}
            className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
              theme === 'light'
                ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Sun className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <div>
              <div className="text-[13px] font-medium text-[var(--text-primary)]">Light Theme</div>
              <div className="text-[11.5px] text-[var(--text-secondary)]">Crisp Slate &amp; Indigo</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => theme === 'light' && onToggleTheme()}
            className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
              theme === 'dark'
                ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Moon className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <div>
              <div className="text-[13px] font-medium text-[var(--text-primary)]">Dark Theme</div>
              <div className="text-[11.5px] text-[var(--text-secondary)]">Deep Slate &amp; Indigo Glow</div>
            </div>
          </button>
        </div>
      </section>

      {/* Save Action Footer */}
      <div className="flex items-center justify-end gap-3 pt-1">
        {savedToast && (
          <span style={{ color: 'var(--semantic-success)' }} className="text-[12.5px] font-medium">
            {savedToast}
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-[13px] font-medium flex items-center gap-2 transition-colors cursor-pointer active:scale-[0.99]"
        >
          <Save className="w-4 h-4" /> Save Changes
        </button>
      </div>
    </div>
  );
}
