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
    <header className="h-14 shrink-0 px-5 flex items-center justify-between gap-4 border-b border-[var(--border-color)] bg-[var(--surface-bg)]">
      {/* Search Downloads */}
      <div className="relative flex-1 max-w-md">
        <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search downloads, categories, or paths... (Ctrl+F)"
          className="w-full h-9 pl-9 pr-8 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Right Toolbar Actions */}
      <div className="flex items-center gap-2">
        {/* Global Speed Limiter */}
        <div className="hidden sm:flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)]">
          <Gauge className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <select
            aria-label="Global speed limit"
            value={speedLimit}
            onChange={(e) => onSpeedLimitChange(parseInt(e.target.value, 10))}
            className="bg-transparent text-xs font-medium text-[var(--text-primary)] focus:outline-none cursor-pointer"
          >
            <option value={0} className="bg-[var(--surface-bg)]">Unlimited Speed</option>
            <option value={524288} className="bg-[var(--surface-bg)]">Limit 512 KB/s</option>
            <option value={1048576} className="bg-[var(--surface-bg)]">Limit 1 MB/s</option>
            <option value={5242880} className="bg-[var(--surface-bg)]">Limit 5 MB/s</option>
            <option value={10485760} className="bg-[var(--surface-bg)]">Limit 10 MB/s</option>
          </select>
        </div>

        {/* Add New Download CTA */}
        <button
          onClick={onOpenAddModal}
          className="h-9 px-3.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Download</span>
        </button>

        {/* Notifications Popover */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => {
              const next = !notifOpen;
              setNotifOpen(next);
              if (next && unreadCount > 0) onMarkAllRead();
            }}
            aria-label="Notifications"
            className="h-9 w-9 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] hover:bg-[var(--hover-bg)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors relative cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] shadow-2xl z-40 overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-[var(--border-color)] flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-primary)]">Notifications</span>
                {notifications.length > 0 && (
                  <button
                    onClick={onClearNotifications}
                    className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border-color)]">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[var(--text-muted)]">No recent notifications.</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="px-3.5 py-2.5 hover:bg-[var(--hover-bg)]">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-medium ${
                            n.type === 'error'
                              ? 'text-rose-500'
                              : n.type === 'success'
                              ? 'text-emerald-500'
                              : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {n.title}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">{formatDate(n.timestamp)}</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Switcher */}
        <button
          onClick={onToggleTheme}
          aria-label="Toggle color theme"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="h-9 w-9 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] hover:bg-[var(--hover-bg)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Settings Shortcut */}
        <button
          onClick={onOpenSettings}
          aria-label="Open Settings"
          title="Settings"
          className="h-9 w-9 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] hover:bg-[var(--hover-bg)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

