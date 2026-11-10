import React from 'react';
import {
  LayoutDashboard,
  Layers,
  ArrowDownCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Settings,
  FolderOpen,
  Film,
  Music,
  FileArchive,
  FileText,
  Package,
  File,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { NavSection } from '../types';
import appIconUrl from '../assets/app-icon.png';

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
  collapsed: boolean;
  onToggleCollapse: () => void;
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
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const navItems: Array<{ id: NavSection; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
    { id: 'all', label: 'All Downloads', icon: <Layers className="w-4 h-4 shrink-0" />, count: counts.all },
    { id: 'downloading', label: 'Downloading', icon: <ArrowDownCircle className="w-4 h-4 shrink-0" />, count: counts.downloading },
    { id: 'queued', label: 'Queued', icon: <Clock className="w-4 h-4 shrink-0" />, count: counts.queued },
    { id: 'completed', label: 'Completed', icon: <CheckCircle2 className="w-4 h-4 shrink-0" />, count: counts.completed },
    { id: 'failed', label: 'Failed', icon: <AlertTriangle className="w-4 h-4 shrink-0" />, count: counts.failed },
  ];

  const categories: Array<{ id: string; label: string; icon: React.ReactNode }> = [
    { id: 'Video', label: 'Videos', icon: <Film className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'Music', label: 'Music & Audio', icon: <Music className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'Compressed', label: 'Compressed', icon: <FileArchive className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'Documents', label: 'Documents', icon: <FileText className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'Programs', label: 'Programs', icon: <Package className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'Other', label: 'Other', icon: <File className="w-3.5 h-3.5 shrink-0" /> },
  ];

  return (
    <aside
      className={`${
        collapsed ? 'w-[68px]' : 'w-[242px]'
      } shrink-0 h-full flex flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-primary)] transition-[width] duration-200 ease-out select-none`}
    >
      {/* Brand Header */}
      <div className="h-14 px-3.5 flex items-center justify-between border-b border-[var(--border-subtle)]">
        <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'mx-auto' : ''}`}>
          <img
            src={appIconUrl}
            alt="FDM - Fluent Download Manager"
            title="FDM - Fluent Download Manager"
            className="w-8 h-8 rounded-lg shrink-0 select-none"
          />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)] truncate">
                FDM
              </div>
              <div className="text-[11px] text-[var(--text-muted)] truncate">
                Fluent Download Manager
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="px-2.5 pt-2.5 flex justify-center">
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="w-full h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
        <nav className="space-y-0.5" aria-label="Download Views">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={collapsed ? `${item.label}${typeof item.count === 'number' ? ` (${item.count})` : ''}` : undefined}
                onClick={() => onSelectSection(item.id)}
                className={`w-full flex items-center ${
                  collapsed ? 'justify-center px-0' : 'justify-between px-3'
                } h-9 rounded-lg text-[13px] transition-colors cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  isActive
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] font-medium'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[var(--accent-primary)]"
                  />
                )}
                <span className="flex items-center gap-2.5 min-w-0">
                  {item.icon}
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </span>
                {!collapsed && typeof item.count === 'number' && (
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-md tabular-nums ${
                      isActive
                        ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-medium'
                        : 'bg-[var(--surface-secondary)] text-[var(--text-muted)]'
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
          {!collapsed && (
            <div className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Categories
            </div>
          )}
          <div className="space-y-0.5">
            {categories.map((cat) => {
              const isSelected = activeSection === 'categories' && activeCategory === cat.id;
              const cnt = categoryCounts[cat.id] || 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  title={collapsed ? `${cat.label} (${cnt})` : undefined}
                  onClick={() => {
                    onSelectCategory(cat.id);
                    onSelectSection('categories');
                  }}
                  className={`w-full flex items-center ${
                    collapsed ? 'justify-center px-0' : 'justify-between px-3'
                  } h-8 rounded-lg text-[12.5px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                    isSelected
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] font-medium'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {cat.icon}
                    {!collapsed && <span className="truncate">{cat.label}</span>}
                  </span>
                  {!collapsed && cnt > 0 && (
                    <span className="text-[11px] text-[var(--text-muted)] tabular-nums">{cnt}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Section: Settings & Folder Shortcut */}
      <div className="p-2.5 border-t border-[var(--border-subtle)] space-y-1.5">
        <button
          type="button"
          title={collapsed ? 'Settings' : undefined}
          onClick={() => onSelectSection('settings')}
          className={`w-full flex items-center ${
            collapsed ? 'justify-center px-0' : 'gap-2.5 px-3'
          } h-9 rounded-lg text-[13px] transition-colors cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
            activeSection === 'settings'
              ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] font-medium'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {activeSection === 'settings' && (
            <span
              aria-hidden="true"
              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[var(--accent-primary)]"
            />
          )}
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>

        <button
          type="button"
          onClick={onOpenDownloadsDir}
          title={downloadDir ? `Open ${downloadDir}` : 'Open Downloads Folder'}
          aria-label="Open Downloads Folder"
          className={`w-full flex items-center ${
            collapsed ? 'justify-center px-0 h-9' : 'gap-2.5 px-3 py-2'
          } rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]`}
        >
          <FolderOpen className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium text-[var(--text-primary)] leading-tight">
                Downloads Folder
              </div>
              <div className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                {downloadDir || 'Downloads\\FDM'}
              </div>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
