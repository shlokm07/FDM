import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  X,
  FolderOpen,
  ExternalLink,
  RotateCcw,
  Copy,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import type { DownloadItem } from '../types';
import { formatBytes, formatDate, formatEta, formatSpeed } from '../lib/formatters';
import { FileTypeIcon, FluentProgress, StatusBadge } from './Primitives';

interface DownloadCardListProps {
  items: DownloadItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string, deleteFile: boolean) => void;
  onOpenFile: (id: string) => void;
  onOpenFolder: (id: string) => void;
  onCopyUrl: (url: string) => void;
}

export function DownloadCardList({
  items,
  selectedId,
  onSelect,
  onPause,
  onResume,
  onCancel,
  onOpenFile,
  onOpenFolder,
  onCopyUrl,
}: DownloadCardListProps) {
  const [menuState, setMenuState] = useState<{
    x: number;
    y: number;
    item: DownloadItem;
  } | null>(null);

  useEffect(() => {
    const closeMenu = () => setMenuState(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, []);

  const openActionsAt = (x: number, y: number, item: DownloadItem) => {
    onSelect(item.id);
    const safeX = Math.max(12, Math.min(window.innerWidth - 216, x));
    const safeY = Math.max(12, Math.min(window.innerHeight - 250, y));
    setMenuState({ x: safeX, y: safeY, item });
  };

  const handleContextMenu = (e: React.MouseEvent, item: DownloadItem) => {
    e.preventDefault();
    openActionsAt(e.clientX, e.clientY, item);
  };

  const handleMoreClick = (e: React.MouseEvent<HTMLButtonElement>, item: DownloadItem) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    openActionsAt(rect.right - 200, rect.bottom + 6, item);
  };

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const status = item.state.status;
        const isSelected = item.id === selectedId;
        const total = item.state.totalBytes || item.progress.totalBytes || 0;
        const downloaded = item.progress.downloadedBytes || (status === 'completed' ? total : 0);
        const pct = status === 'completed' ? 100 : item.progress.percent || 0;
        const speed = item.progress.speedBytesPerSec || 0;
        const etaText = formatEta(item.progress.etaSeconds, status);
        const isDownloading = status === 'downloading';
        const isCompleted = status === 'completed';

        return (
          <div
            key={item.id}
            onClick={() => onSelect(item.id)}
            onDoubleClick={() => (isCompleted ? onOpenFile(item.id) : onOpenFolder(item.id))}
            onContextMenu={(e) => handleContextMenu(e, item)}
            style={{ boxShadow: 'var(--shadow-card)' }}
            className={`group rounded-xl border px-4 py-3 transition-colors cursor-pointer select-none ${
              isSelected
                ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]/50'
                : 'border-[var(--border-subtle)] bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)]/70'
            }`}
          >
            {/* Balanced 3-Zone Desktop Layout: LEFT | CENTRE | RIGHT */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.4fr)_auto] items-center gap-3.5 lg:gap-5">
              {/* LEFT: File Icon, Filename, Category */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] flex items-center justify-center shrink-0">
                  <FileTypeIcon category={item.category} filename={item.filename} className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[14px] font-medium text-[var(--text-primary)] truncate leading-snug"
                    title={item.filename}
                  >
                    {item.filename}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-[var(--text-secondary)]">
                    <span>{item.category}</span>
                    <span className="text-[var(--text-muted)]">•</span>
                    <span className="truncate text-[var(--text-muted)]" title={item.outputPath}>
                      {item.outputPath}
                    </span>
                  </div>
                </div>
              </div>

              {/* CENTRE: Size / Progress Bar / Percentage / Speed / ETA */}
              {isCompleted ? (
                <div className="flex flex-col justify-center gap-1 min-w-0">
                  <div className="flex items-center justify-between text-[12px] tabular-nums">
                    <span className="font-medium text-[var(--text-primary)]">{formatBytes(total)}</span>
                    <span className="text-[var(--text-muted)]">
                      {formatDate(item.state.completedAt || item.addedAt)}
                    </span>
                  </div>
                  <FluentProgress percent={100} status={status} height="h-1" />
                  <div className="flex items-center justify-between text-[11.5px] text-[var(--text-secondary)]">
                    <span>{item.fileExists ? 'Saved on disk' : 'File moved or missing'}</span>
                    <span style={{ color: 'var(--semantic-success)' }} className="font-medium tabular-nums">
                      100%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col justify-center gap-1.5 min-w-0">
                  <div className="flex items-center justify-between text-[12px] tabular-nums">
                    <span className="text-[var(--text-primary)] font-medium">
                      {formatBytes(downloaded)}{' '}
                      <span className="text-[var(--text-muted)] font-normal">
                        / {total > 0 ? formatBytes(total) : 'Unknown'}
                      </span>
                    </span>
                    <span className="font-semibold text-[var(--text-primary)]">{pct.toFixed(1)}%</span>
                  </div>

                  <FluentProgress percent={pct} status={status} height="h-1.5" />

                  <div className="flex items-center justify-between text-[11.5px] tabular-nums">
                    <span
                      className={
                        isDownloading
                          ? 'font-medium text-[var(--accent-primary)]'
                          : 'text-[var(--text-secondary)]'
                      }
                    >
                      {isDownloading ? formatSpeed(speed) : status === 'paused' ? '0 B/s (Paused)' : '0 B/s'}
                    </span>
                    <span
                      className={
                        status === 'error'
                          ? 'text-[var(--semantic-error)] font-medium'
                          : 'text-[var(--text-secondary)]'
                      }
                    >
                      ETA: {etaText}
                    </span>
                  </div>
                </div>
              )}

              {/* RIGHT: Status & Controls */}
              <div
                className="flex items-center justify-between lg:justify-end gap-2 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <StatusBadge status={status} />

                <div className="flex items-center gap-1">
                  {isDownloading && (
                    <button
                      type="button"
                      onClick={() => onPause(item.id)}
                      title="Pause download"
                      aria-label={`Pause ${item.filename}`}
                      className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-primary)] transition-colors cursor-pointer active:scale-[0.97]"
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {(status === 'paused' || status === 'idle') && (
                    <button
                      type="button"
                      onClick={() => onResume(item.id)}
                      title="Resume download"
                      aria-label={`Resume ${item.filename}`}
                      className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)] flex items-center justify-center text-[var(--text-primary)] transition-colors cursor-pointer active:scale-[0.97]"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {status === 'error' && (
                    <button
                      type="button"
                      onClick={() => onResume(item.id)}
                      title="Retry download"
                      aria-label={`Retry ${item.filename}`}
                      className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)] flex items-center justify-center text-[var(--text-primary)] transition-colors cursor-pointer active:scale-[0.97]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isCompleted && item.fileExists && (
                    <button
                      type="button"
                      onClick={() => onOpenFile(item.id)}
                      title="Open file"
                      aria-label={`Open ${item.filename}`}
                      className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)] flex items-center justify-center text-[var(--text-primary)] transition-colors cursor-pointer active:scale-[0.97]"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onCancel(item.id, false)}
                    title="Cancel / Remove from list"
                    aria-label={`Remove ${item.filename}`}
                    className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--semantic-error-soft)] hover:text-[var(--semantic-error)] flex items-center justify-center text-[var(--text-secondary)] transition-colors cursor-pointer active:scale-[0.97]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleMoreClick(e, item)}
                    title="More actions"
                    aria-label={`More actions for ${item.filename}`}
                    className="h-8 w-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer active:scale-[0.97]"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Inline Error Detail */}
            {status === 'error' && item.state.error && (
              <div
                style={{
                  backgroundColor: 'var(--semantic-error-soft)',
                  color: 'var(--semantic-error)',
                }}
                className="mt-2.5 px-3 py-1.5 rounded-lg text-[12px] truncate"
              >
                Error: {item.state.error}
              </div>
            )}
          </div>
        );
      })}

      {/* Context / More Actions Menu */}
      {menuState && (
        <div
          role="menu"
          style={{ top: menuState.y, left: menuState.x, boxShadow: 'var(--shadow-popover)' }}
          className="fixed z-50 w-52 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-1.5 text-[12.5px] animate-dialog-in"
          onClick={(e) => e.stopPropagation()}
        >
          {menuState.item.state.status === 'completed' && menuState.item.fileExists && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onOpenFile(menuState.item.id);
                setMenuState(null);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] cursor-pointer text-left"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[var(--accent-primary)]" /> Open File
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpenFolder(menuState.item.id);
              setMenuState(null);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] cursor-pointer text-left"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[var(--text-secondary)]" /> Open Containing Folder
          </button>

          <div className="my-1 border-t border-[var(--border-subtle)]" />

          {menuState.item.state.status === 'downloading' ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onPause(menuState.item.id);
                setMenuState(null);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] cursor-pointer text-left"
            >
              <Pause className="w-3.5 h-3.5 text-[var(--semantic-warning)]" /> Pause Download
            </button>
          ) : menuState.item.state.status !== 'completed' ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onResume(menuState.item.id);
                setMenuState(null);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] cursor-pointer text-left"
            >
              <Play className="w-3.5 h-3.5 text-[var(--accent-primary)]" /> Resume / Retry
            </button>
          ) : null}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onCopyUrl(menuState.item.url);
              setMenuState(null);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] cursor-pointer text-left"
          >
            <Copy className="w-3.5 h-3.5 text-[var(--text-secondary)]" /> Copy Source URL
          </button>

          <div className="my-1 border-t border-[var(--border-subtle)]" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onCancel(menuState.item.id, false);
              setMenuState(null);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] cursor-pointer text-left"
          >
            <X className="w-3.5 h-3.5" /> Remove from List
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onCancel(menuState.item.id, true);
              setMenuState(null);
            }}
            style={{ color: 'var(--semantic-error)' }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--semantic-error-soft)] cursor-pointer text-left"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete File from Disk
          </button>
        </div>
      )}
    </div>
  );
}
