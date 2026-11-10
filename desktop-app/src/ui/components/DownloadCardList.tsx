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
  Clock,
  Gauge,
  HardDrive,
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
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: DownloadItem;
  } | null>(null);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent, item: DownloadItem) => {
    e.preventDefault();
    onSelect(item.id);
    const x = Math.min(window.innerWidth - 210, e.clientX);
    const y = Math.min(window.innerHeight - 250, e.clientY);
    setContextMenu({ x, y, item });
  };

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const status = item.state.status;
        const isSelected = item.id === selectedId;
        const total = item.state.totalBytes || item.progress.totalBytes || 0;
        const downloaded = item.progress.downloadedBytes || (status === 'completed' ? total : 0);
        const pct = status === 'completed' ? 100 : item.progress.percent || 0;
        const speed = item.progress.speedBytesPerSec || 0;
        const eta = formatEta(item.progress.etaSeconds, status);

        return (
          <div
            key={item.id}
            onClick={() => onSelect(item.id)}
            onDoubleClick={() => (status === 'completed' ? onOpenFile(item.id) : onOpenFolder(item.id))}
            onContextMenu={(e) => handleContextMenu(e, item)}
            className={`group rounded-xl border p-3.5 transition-all cursor-pointer select-none ${
              isSelected
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40 shadow-xs'
                : 'border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              {/* File Icon & Name */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] flex items-center justify-center shrink-0">
                  <FileTypeIcon category={item.category} className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[13px] font-semibold text-[var(--text-primary)] truncate" title={item.filename}>
                      {item.filename}
                    </h4>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--subtle-bg)] text-[var(--text-muted)] shrink-0">
                      {item.category}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <HardDrive className="w-3 h-3 text-[var(--text-muted)]" />
                      {status === 'completed'
                        ? formatBytes(total)
                        : `${formatBytes(downloaded)} / ${total > 0 ? formatBytes(total) : 'Unknown'}`}
                    </span>
                    {status === 'downloading' && (
                      <span className="inline-flex items-center gap-1 tabular-nums text-emerald-500 font-medium">
                        <Gauge className="w-3 h-3" />
                        {formatSpeed(speed)}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 tabular-nums font-medium ${
                        status === 'downloading'
                          ? 'text-[var(--text-primary)]'
                          : status === 'error'
                          ? 'text-rose-500'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {status === 'completed' ? formatDate(item.state.completedAt || item.addedAt) : `ETA: ${eta}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status & Quick Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={status} />

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {status === 'downloading' && (
                    <button
                      onClick={() => onPause(item.id)}
                      title="Pause Download"
                      className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)] cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {(status === 'paused' || status === 'idle') && (
                    <button
                      onClick={() => onResume(item.id)}
                      title="Resume Download"
                      className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] hover:bg-emerald-500/15 hover:text-emerald-500 text-[var(--text-primary)] cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {status === 'error' && (
                    <button
                      onClick={() => onResume(item.id)}
                      title="Retry Download"
                      className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] hover:bg-emerald-500/15 hover:text-emerald-500 text-[var(--text-primary)] cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {status === 'completed' && (
                    <>
                      {item.fileExists && (
                        <button
                          onClick={() => onOpenFile(item.id)}
                          title="Open File"
                          className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] hover:bg-emerald-500/15 hover:text-emerald-500 text-[var(--text-primary)] cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onOpenFolder(item.id)}
                        title="Open Containing Folder"
                        className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)] cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => onCancel(item.id, false)}
                    title="Remove from List"
                    className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--subtle-bg)] hover:bg-rose-500/15 hover:text-rose-500 text-[var(--text-secondary)] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Progress Bar Row (Active, Paused, Queued, Failed) */}
            {status !== 'completed' && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1">
                  <FluentProgress percent={pct} status={status} />
                </div>
                <span className="text-[11px] font-semibold text-[var(--text-primary)] w-12 text-right tabular-nums">
                  {pct.toFixed(1)}%
                </span>
              </div>
            )}

            {/* Failure Reason Banner */}
            {status === 'error' && item.state.error && (
              <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-500 truncate">
                Error: {item.state.error}
              </div>
            )}
          </div>
        );
      })}

      {/* Right-Click Fluent Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-52 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] shadow-2xl p-1.5 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.item.state.status === 'completed' && contextMenu.item.fileExists && (
            <button
              onClick={() => {
                onOpenFile(contextMenu.item.id);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-primary)] cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-500" /> Open File
            </button>
          )}
          <button
            onClick={() => {
              onOpenFolder(contextMenu.item.id);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-primary)] cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[var(--text-secondary)]" /> Open Containing Folder
          </button>

          <div className="my-1 border-t border-[var(--border-color)]" />

          {contextMenu.item.state.status === 'downloading' ? (
            <button
              onClick={() => {
                onPause(contextMenu.item.id);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-primary)] cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5 text-amber-500" /> Pause Download
            </button>
          ) : contextMenu.item.state.status !== 'completed' ? (
            <button
              onClick={() => {
                onResume(contextMenu.item.id);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-primary)] cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-emerald-500" /> Resume / Retry
            </button>
          ) : null}

          <button
            onClick={() => {
              onCopyUrl(contextMenu.item.url);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-primary)] cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-[var(--text-secondary)]" /> Copy Source URL
          </button>

          <div className="my-1 border-t border-[var(--border-color)]" />

          <button
            onClick={() => {
              onCancel(contextMenu.item.id, false);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-secondary)] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Remove from List
          </button>
          <button
            onClick={() => {
              onCancel(contextMenu.item.id, true);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/15 text-rose-500 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete File from Disk
          </button>
        </div>
      )}
    </div>
  );
}

