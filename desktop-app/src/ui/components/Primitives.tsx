import React from 'react';
import {
  Film,
  Music,
  FileArchive,
  FileText,
  Package,
  File as FileIcon,
  Inbox,
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  Clock,
  ArrowDownCircle,
} from 'lucide-react';
import type { DownloadStatus } from '../types';

export function FileTypeIcon({ category, className = 'w-5 h-5' }: { category: string; className?: string }) {
  switch (category) {
    case 'Video':
      return <Film className={`${className} text-emerald-500`} />;
    case 'Music':
      return <Music className={`${className} text-sky-500`} />;
    case 'Compressed':
      return <FileArchive className={`${className} text-amber-500`} />;
    case 'Documents':
      return <FileText className={`${className} text-indigo-400`} />;
    case 'Programs':
      return <Package className={`${className} text-violet-400`} />;
    default:
      return <FileIcon className={`${className} text-slate-400`} />;
  }
}

export function StatusBadge({ status }: { status: DownloadStatus }) {
  const styles: Record<DownloadStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    downloading: {
      label: 'Downloading',
      cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
      icon: <ArrowDownCircle className="w-3.5 h-3.5" />,
    },
    idle: {
      label: 'Queued',
      cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    paused: {
      label: 'Paused',
      cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
      icon: <PauseCircle className="w-3.5 h-3.5" />,
    },
    completed: {
      label: 'Completed',
      cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    error: {
      label: 'Failed',
      cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    needs_auth: {
      label: 'Auth Needed',
      cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
  };

  const cfg = styles[status] || styles.idle;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      {cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
}

export function FluentProgress({
  percent,
  status,
  height = 'h-1.5',
}: {
  percent: number;
  status: DownloadStatus;
  height?: string;
}) {
  const safePct = Math.max(0, Math.min(100, percent || 0));
  const fillColor =
    status === 'error'
      ? 'bg-rose-500'
      : status === 'paused'
      ? 'bg-amber-500'
      : status === 'idle'
      ? 'bg-sky-500'
      : 'bg-emerald-500';

  return (
    <div className={`w-full ${height} rounded-full bg-[var(--subtle-bg)] overflow-hidden`}>
      <div
        className={`h-full rounded-full transition-all duration-300 ease-out ${fillColor}`}
        style={{ width: `${safePct}%` }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--surface-bg)]/50">
      <div className="w-12 h-12 rounded-xl bg-[var(--subtle-bg)] flex items-center justify-center mb-3 text-[var(--text-muted)]">
        <Inbox className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="text-xs text-[var(--text-secondary)] max-w-sm mt-1 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              danger ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/15 text-emerald-500'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-color)] bg-[var(--subtle-bg)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer ${
              danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

