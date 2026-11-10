import React from 'react';
import {
  LayoutDashboard,
  Layers,
  ArrowDownCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FolderKanban,
  Settings,
  FolderOpen,
  Film,
  Music,
  FileArchive,
  FileText,
  Package,
  File,
  Zap,
} from 'lucide-react';
import type { NavSection } from '../types';

interface SidebarProps {
  activeSection: NavSection;
  activeCategory: string;
  onSelectSection: (section: NavSection) => void;
  onSelectCategory: (category: string) => void;
  onOpenDownloadsDir: () => void;
  counts: {
    all: number;
    downloading: number;
    queued: number;
    completed: number;
    failed: number;
  };
  categoryCounts: Record<string, number>;
  downloadDir?: string;
}

export function Sidebar({
  activeSection,
  activeCategory,
  onSelectSection,
  onSelectCategory,
  onOpenDownloadsDir,
  counts,
  categoryCounts,
  downloadDir,
}: SidebarProps) {
  const navItems: Array<{ id: NavSection; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'all', label: 'All Downloads', icon: <Layers className="w-4 h-4" />, count: counts.all },
    { id: 'downloading', label: 'Downloading', icon: <ArrowDownCircle className="w-4 h-4" />, count: counts.downloading },
    { id: 'queued', label: 'Queued', icon: <Clock className="w-4 h-4" />, count: counts.queued },
    { id: 'completed', label: 'Completed', icon: <CheckCircle2 className="w-4 h-4" />, count: counts.completed },
    { id: 'failed', label: 'Failed', icon: <AlertTriangle className="w-4 h-4" />, count: counts.failed },
  ];

  const categories: Array<{ id: string; label: string; icon: React.ReactNode }> = [
    { id: 'Video', label: 'Videos', icon: <Film className="w-3.5 h-3.5" /> },
    { id: 'Music', label: 'Music & Audio', icon: <Music className="w-3.5 h-3.5" /> },
    { id: 'Compressed', label: 'Compressed', icon: <FileArchive className="w-3.5 h-3.5" /> },
    { id: 'Documents', label: 'Documents', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'Programs', label: 'Programs', icon: <Package className="w-3.5 h-3.5" /> },
    { id: 'Other', label: 'Other', icon: <File className="w-3.5 h-3.5" /> },
  ];

  return (
    <aside className="w-60 shrink-0 h-full flex flex-col border-r border-[var(--border-color)] bg-[var(--surface-bg)] select-none">
      {/* Brand Logo Header */}
      <div className="h-14 px-4 flex items-center gap-3 border-b border-[var(--border-color)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white shadow-xs">
          <Zap className="w-4 h-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">REA-IDM</div>
          <div className="text-[11px] text-[var(--text-muted)]">Fluent Download Suite</div>
        </div>
      </div>

      {/* Primary Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        <nav className="space-y-0.5" aria-label="Primary Navigation">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectSection(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-colors cursor-pointer relative ${
                  isActive
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
                }`}
              >
                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[var(--accent)]" />}
                <span className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-md tabular-nums ${
                      isActive ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-[var(--subtle-bg)] text-[var(--text-muted)]'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Categories */}
        <div>
          <button
            onClick={() => {
              onSelectSection('categories');
              if (activeCategory === 'all') onSelectCategory('Video');
            }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider cursor-pointer ${
              activeSection === 'categories' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>Categories</span>
          </button>
          <div className="mt-1 space-y-0.5">
            {categories.map((cat) => {
              const isSelected = activeSection === 'categories' && activeCategory === cat.id;
              const cnt = categoryCounts[cat.id] || 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    onSelectCategory(cat.id);
                    onSelectSection('categories');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {cat.icon}
                    <span>{cat.label}</span>
                  </span>
                  {cnt > 0 && <span className="text-[11px] text-[var(--text-muted)] tabular-nums">{cnt}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Nav */}
        <div className="pt-2 border-t border-[var(--border-color)]">
          <button
            onClick={() => onSelectSection('settings')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors cursor-pointer relative ${
              activeSection === 'settings'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
            }`}
          >
            {activeSection === 'settings' && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[var(--accent)]" />
            )}
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Bottom Storage Shortcut */}
      <div className="p-3 border-t border-[var(--border-color)]">
        <button
          onClick={onOpenDownloadsDir}
          title={downloadDir || 'Open Downloads Folder'}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] hover:bg-[var(--hover-bg)] text-left transition-colors cursor-pointer"
        >
          <FolderOpen className="w-4 h-4 text-[var(--accent)] shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-[var(--text-primary)]">Downloads Folder</div>
            <div className="text-[10px] text-[var(--text-muted)] truncate">{downloadDir || 'Downloads\\REA-IDM'}</div>
          </div>
        </button>
      </div>
    </aside>
  );
}

