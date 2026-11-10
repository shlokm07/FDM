import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Bell,
  Sun,
  Moon,
  Settings,
  Gauge,
  CheckCheck,
  X,
} from 'lucide-react';
import type { AppNotification } from '../types';
import { formatDate } from '../lib/formatters';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onOpenAddModal: () => void;
  onOpenSettings: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  speedLimit: number;
  onSpeedLimitChange: (bytes: number) => void;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onClearNotifications: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
}

export function TopBar({
  searchQuery,
  onSearchChange,
  onOpenAddModal,
  onOpenSettings,
  theme,
  onToggleTheme,
  speedLimit,
  onSpeedLimitChange,
  notifications,
  onMarkAllRead,
  onClearNotifications,
  searchInputRef,
}: TopBarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <header className="h-14 shrink-0 px-5 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-primary)]">
      {/* Global Search Input */}
      <div className="relative flex-1 max-w-md min-w-[180px]">
        <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search downloads"
          placeholder="Search downloads, categories, or paths..."
          className="w-full h-9 pl-9 pr-14 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] focus:bg-[var(--surface-primary)] transition-colors"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            title="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-medium text-[var(--text-muted)] bg-[var(--surface-primary)] border border-[var(--border-subtle)] pointer-events-none">
            Ctrl+F
          </kbd>
        )}
      </div>

      {/* Right Toolbar Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Speed Limit Selector */}
        <div
          title="Global bandwidth limit"
          className="hidden md:flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:border-[var(--text-muted)]/50 transition-colors"
        >
          <Gauge className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
          <select
            aria-label="Global speed limit"
            value={speedLimit}
            onChange={(e) => onSpeedLimitChange(parseInt(e.target.value, 10))}
            className="bg-transparent text-[12.5px] font-medium text-[var(--text-primary)] focus:outline-none cursor-pointer"
          >
            <option value={0} className="bg-[var(--surface-primary)]">Unlimited</option>
            <option value={524288} className="bg-[var(--surface-primary)]">512 KB/s</option>
            <option value={1048576} className="bg-[var(--surface-primary)]">1 MB/s</option>
            <option value={5242880} className="bg-[var(--surface-primary)]">5 MB/s</option>
            <option value={10485760} className="bg-[var(--surface-primary)]">10 MB/s</option>
          </select>
        </div>

        {/* Primary Add Download CTA */}
        <button
          type="button"
          onClick={onOpenAddModal}
          title="Add New Download (Ctrl+N)"
          className="h-9 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-[13px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Add Download</span>
        </button>

        {/* Notifications Bell & Popover */}
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => {
              const next = !notifOpen;
              setNotifOpen(next);
              if (next && unreadCount > 0) onMarkAllRead();
            }}
            aria-label="Notifications"
            title="Notifications"
            className="h-9 w-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              style={{ boxShadow: 'var(--shadow-popover)' }}
              className="absolute right-0 mt-2 w-80 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] z-40 overflow-hidden animate-dialog-in"
            >
              <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">Notifications</span>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearNotifications}
                    className="text-[11.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Clear all
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-[12px] text-[var(--text-muted)]">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="px-4 py-2.5 hover:bg-[var(--surface-secondary)] transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          style={{
                            color:
                              n.type === 'error'
                                ? 'var(--semantic-error)'
                                : n.type === 'success'
                                  ? 'var(--semantic-success)'
                                  : 'var(--text-primary)',
                          }}
                          className="text-[12.5px] font-medium"
                        >
                          {n.title}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                          {formatDate(n.timestamp)}
                        </span>
                      </div>
                      <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 truncate">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Switcher */}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
          title={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
          className="h-9 w-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Settings Shortcut */}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open Settings"
          title="Settings"
          className="h-9 w-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
