import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Trash2, Play, Pause, RefreshCw } from 'lucide-react';
import type { AppNotification, AppSettings, DaemonStatus, DownloadItem, NavSection } from './types';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { OverviewCards } from './components/OverviewCards';
import { DownloadCardList } from './components/DownloadCardList';
import { NetworkFooter } from './components/NetworkFooter';
import { AddDownloadModal, SettingsPanel } from './components/Modals';
import { ConfirmDialog, EmptyState } from './components/Primitives';

const DEFAULT_STATUS: DaemonStatus = {
  status: 'offline',
  version: '2.0.0',
  activeDownloads: 0,
  queuedDownloads: 0,
  pausedDownloads: 0,
  completedDownloads: 0,
  failedDownloads: 0,
  totalDownloads: 0,
  totalSpeedBytesPerSec: 0,
  totalConnections: 0,
  totalDownloadedBytes: 0,
  overallEtaSeconds: 0,
  speedHistory: [],
  settings: {
    downloadDir: '',
    maxConcurrentDownloads: 3,
    globalSpeedLimit: 0,
    clipboardAutoCapture: false,
  },
};

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('rea_idm_theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('rea_idm_sidebar_collapsed') === 'true';
  });

  const [section, setSection] = useState<NavSection>('dashboard');
  const [activeCategory, setActiveCategory] = useState<string>('Video');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [status, setStatus] = useState<DaemonStatus>(DEFAULT_STATUS);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    danger: boolean;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    danger: false,
    onConfirm: () => {},
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const prevStatusesRef = useRef<Map<string, string>>(new Map());
  const firstPollDoneRef = useRef(false);

  // Sync theme class on document root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('rea_idm_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('rea_idm_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setAddModalOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setAddModalOpen(false);
        setConfirmState((prev) => ({ ...prev, open: false }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const refreshData = async () => {
    try {
      const [stRes, dlRes] = await Promise.all([
        fetch('/api/status', { cache: 'no-store' }),
        fetch('/api/downloads', { cache: 'no-store' }),
      ]);
      if (stRes.ok && dlRes.ok) {
        const stData: DaemonStatus = await stRes.json();
        const dlData: DownloadItem[] = await dlRes.json();

        if (firstPollDoneRef.current) {
          const newNotifs: AppNotification[] = [];
          dlData.forEach((d) => {
            const prev = prevStatusesRef.current.get(d.id);
            if (prev && prev !== d.state.status) {
              if (d.state.status === 'completed') {
                newNotifs.push({
                  id: `${d.id}-${Date.now()}`,
                  title: 'Download Completed',
                  message: d.filename,
                  type: 'success',
                  timestamp: Date.now(),
                  read: false,
                });
              } else if (d.state.status === 'error') {
                newNotifs.push({
                  id: `${d.id}-${Date.now()}`,
                  title: 'Download Failed',
                  message: `${d.filename}: ${d.state.error || 'Error'}`,
                  type: 'error',
                  timestamp: Date.now(),
                  read: false,
                });
              }
            }
          });
          if (newNotifs.length > 0) {
            setNotifications((old) => [...newNotifs, ...old].slice(0, 30));
          }
        }

        const nextMap = new Map<string, string>();
        dlData.forEach((d) => nextMap.set(d.id, d.state.status));
        prevStatusesRef.current = nextMap;
        firstPollDoneRef.current = true;

        setStatus(stData);
        setDownloads(dlData);
      }
    } catch {
      setStatus((prev) => ({ ...prev, status: 'offline' }));
    }
  };

  useEffect(() => {
    refreshData();
    const timer = setInterval(refreshData, 550);
    return () => clearInterval(timer);
  }, []);

  const counts = useMemo(() => {
    let downloading = 0;
    let queued = 0;
    let completed = 0;
    let failed = 0;
    const categoryCounts: Record<string, number> = {};

    for (const d of downloads) {
      const s = d.state.status;
      if (s === 'downloading') downloading++;
      else if (s === 'idle' || s === 'paused') queued++;
      else if (s === 'completed') completed++;
      else if (s === 'error') failed++;
      categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
    }
    return {
      all: downloads.length,
      downloading,
      queued,
      completed,
      failed,
      categoryCounts,
    };
  }, [downloads]);

  const filteredDownloads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return downloads.filter((d) => {
      if (section === 'downloading' && d.state.status !== 'downloading') return false;
      if (section === 'queued' && d.state.status !== 'idle' && d.state.status !== 'paused') return false;
      if (section === 'completed' && d.state.status !== 'completed') return false;
      if (section === 'failed' && d.state.status !== 'error') return false;
      if (section === 'categories' && d.category !== activeCategory) return false;

      if (q) {
        return (
          d.filename.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q) ||
          d.outputPath.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [downloads, section, activeCategory, searchQuery]);

  const activeItems = useMemo(
    () =>
      downloads.filter(
        (d) => d.state.status === 'downloading' || d.state.status === 'paused' || d.state.status === 'idle'
      ),
    [downloads]
  );

  const recentCompleted = useMemo(
    () => downloads.filter((d) => d.state.status === 'completed').slice(0, 8),
    [downloads]
  );

  const selectedItem = useMemo(
    () => downloads.find((d) => d.id === selectedId) || null,
    [downloads, selectedId]
  );

  const postApi = async (endpoint: string, body: Record<string, unknown> = {}) => {
    try {
      await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await refreshData();
    } catch {
      // Ignore transient errors
    }
  };

  const handleDelete = (id: string, deleteFile: boolean) => {
    if (!deleteFile) {
      postApi(`downloads/${id}/cancel`, { deleteFile: false });
      return;
    }
    const target = downloads.find((d) => d.id === id);
    setConfirmState({
      open: true,
      title: 'Delete File Permanently?',
      message: `This removes "${target?.filename || 'this item'}" from FDM and permanently deletes it from disk.`,
      confirmLabel: 'Delete File',
      danger: true,
      onConfirm: () => {
        postApi(`downloads/${id}/cancel`, { deleteFile: true });
        setConfirmState((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleClearCompleted = () => {
    setConfirmState({
      open: true,
      title: 'Clear Completed List?',
      message: 'This clears finished entries from the FDM list. Downloaded files on disk are kept.',
      confirmLabel: 'Clear List',
      danger: false,
      onConfirm: () => {
        postApi('downloads/clear-completed');
        setConfirmState((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const sectionTitleMap: Record<NavSection, string> = {
    dashboard: 'Dashboard',
    all: 'All Downloads',
    downloading: 'Downloading',
    queued: 'Queued & Paused',
    completed: 'Completed',
    failed: 'Failed Downloads',
    categories: `${activeCategory} Downloads`,
    settings: 'Settings',
  };

  return (
    <div className="h-screen w-screen flex bg-[var(--app-bg)] text-[var(--text-primary)] overflow-hidden transition-colors duration-200">
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeSection={section}
        activeCategory={activeCategory}
        onSelectSection={setSection}
        onSelectCategory={setActiveCategory}
        onOpenDownloadsDir={() => postApi('downloads/open-dir')}
        counts={counts}
        categoryCounts={counts.categoryCounts}
        downloadDir={status.settings.downloadDir}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenAddModal={() => setAddModalOpen(true)}
          onOpenSettings={() => setSection('settings')}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          speedLimit={status.settings.globalSpeedLimit}
          onSpeedLimitChange={(bytes) => postApi('settings/speed-limit', { bytesPerSecond: bytes })}
          notifications={notifications}
          onMarkAllRead={() => setNotifications((n) => n.map((x) => ({ ...x, read: true })))}
          onClearNotifications={() => setNotifications([])}
          searchInputRef={searchInputRef}
        />

        {/* Scrollable Content Workspace */}
        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {section === 'settings' ? (
            <SettingsPanel
              settings={status.settings}
              theme={theme}
              onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              onSaveSettings={async (updated: Partial<AppSettings>) => {
                await postApi('settings', updated);
              }}
              onScanFolder={async () => {
                await postApi('downloads/scan');
                setNotifications((n) => [
                  {
                    id: `scan-${Date.now()}`,
                    title: 'Folder Synced',
                    message: 'Downloads directory scanned for local files.',
                    type: 'info',
                    timestamp: Date.now(),
                    read: false,
                  },
                  ...n,
                ]);
              }}
            />
          ) : section === 'dashboard' && !searchQuery ? (
            <>
              {/* 1. Page Heading */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text-primary)] leading-tight">
                    Dashboard
                  </h1>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                    Manage active transfers, speed limits, and your downloaded library.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => postApi('downloads/scan')}
                    className="h-8.5 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] text-[12.5px] font-medium text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Sync Folder
                  </button>
                  {counts.completed > 0 && (
                    <button
                      type="button"
                      onClick={handleClearCompleted}
                      className="h-8.5 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear Completed
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Compact Overview Statistics */}
              <OverviewCards status={status} />

              {/* 3. Active & Queued Downloads */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
                    Active &amp; Queued{' '}
                    <span className="text-[13px] font-normal text-[var(--text-muted)] tabular-nums">
                      ({activeItems.length})
                    </span>
                  </h2>
                  {activeItems.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          activeItems.forEach((i) => i.state.status === 'paused' && postApi(`downloads/${i.id}/resume`))
                        }
                        className="h-7.5 px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] text-[12px] font-medium text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3 h-3 text-[var(--accent-primary)]" /> Resume All
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          activeItems.forEach((i) => i.state.status === 'downloading' && postApi(`downloads/${i.id}/pause`))
                        }
                        className="h-7.5 px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] text-[12px] font-medium text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Pause className="w-3 h-3 text-[var(--semantic-warning)]" /> Pause All
                      </button>
                    </div>
                  )}
                </div>

                {activeItems.length === 0 ? (
                  <EmptyState
                    title="No Active Transfers"
                    description="Click Add Download or trigger a capture from Chrome to track live multi-threaded speed and ETA."
                    actionLabel="Add New Download"
                    onAction={() => setAddModalOpen(true)}
                  />
                ) : (
                  <DownloadCardList
                    items={activeItems}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onPause={(id) => postApi(`downloads/${id}/pause`)}
                    onResume={(id) => postApi(`downloads/${id}/resume`)}
                    onCancel={handleDelete}
                    onOpenFile={(id) => postApi(`downloads/${id}/open`)}
                    onOpenFolder={(id) => postApi(`downloads/${id}/open-folder`)}
                    onCopyUrl={(u) => navigator.clipboard?.writeText(u)}
                  />
                )}
              </section>

              {/* 4. Recent Completed Activity */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
                    Recent Completed{' '}
                    <span className="text-[13px] font-normal text-[var(--text-muted)] tabular-nums">
                      ({counts.completed})
                    </span>
                  </h2>
                  {counts.completed > 8 && (
                    <button
                      type="button"
                      onClick={() => setSection('completed')}
                      className="text-[12.5px] font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
                    >
                      View all completed →
                    </button>
                  )}
                </div>

                {recentCompleted.length === 0 ? (
                  <EmptyState
                    title="No Completed Files Yet"
                    description="Completed downloads in your destination folder appear here for quick access."
                  />
                ) : (
                  <DownloadCardList
                    items={recentCompleted}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onPause={(id) => postApi(`downloads/${id}/pause`)}
                    onResume={(id) => postApi(`downloads/${id}/resume`)}
                    onCancel={handleDelete}
                    onOpenFile={(id) => postApi(`downloads/${id}/open`)}
                    onOpenFolder={(id) => postApi(`downloads/${id}/open-folder`)}
                    onCopyUrl={(u) => navigator.clipboard?.writeText(u)}
                  />
                )}
              </section>
            </>
          ) : (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text-primary)] leading-tight">
                    {searchQuery ? `Search: "${searchQuery}"` : sectionTitleMap[section]}
                  </h1>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-0.5 tabular-nums">
                    {filteredDownloads.length} {filteredDownloads.length === 1 ? 'item' : 'items'}
                  </p>
                </div>

                {section === 'completed' && counts.completed > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCompleted}
                    className="h-8.5 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear Completed List
                  </button>
                )}
              </div>

              {filteredDownloads.length === 0 ? (
                <EmptyState
                  title="No Downloads Found"
                  description={
                    searchQuery
                      ? 'No items matched your search query. Try another filename, folder, or category.'
                      : 'There are currently no downloads in this view.'
                  }
                  actionLabel={searchQuery ? 'Clear Search' : 'Add Download'}
                  onAction={() => (searchQuery ? setSearchQuery('') : setAddModalOpen(true))}
                />
              ) : (
                <DownloadCardList
                  items={filteredDownloads}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onPause={(id) => postApi(`downloads/${id}/pause`)}
                  onResume={(id) => postApi(`downloads/${id}/resume`)}
                  onCancel={handleDelete}
                  onOpenFile={(id) => postApi(`downloads/${id}/open`)}
                  onOpenFolder={(id) => postApi(`downloads/${id}/open-folder`)}
                  onCopyUrl={(u) => navigator.clipboard?.writeText(u)}
                />
              )}
            </section>
          )}
        </main>

        {/* Collapsible Bottom Network Monitoring Panel */}
        <NetworkFooter status={status} selectedItem={selectedItem} />
      </div>

      {/* Add Download Modal */}
      <AddDownloadModal
        open={addModalOpen}
        defaultDir={status.settings.downloadDir}
        onClose={() => setAddModalOpen(false)}
        onStartDownload={(payload) => postApi('downloads/add', payload)}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        danger={confirmState.danger}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}

export default App;
