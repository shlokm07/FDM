import React, { useEffect } from 'react';
import {
  Film,
  Music,
  FileArchive,
  FileText,
  Package,
  Image as ImageIcon,
  File as FileIcon,
  Inbox,
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  Clock,
  ArrowDownCircle,
} from 'lucide-react';
import type { DownloadStatus } from '../types';

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif'];
const ARCHIVE_EXTS = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso'];

export function FileTypeIcon({
  category,
  filename = '',
  className = 'w-5 h-5',
}: {
  category: string;
  filename?: string;
  className?: string;
}) {
  const lower = filename.toLowerCase();
  if (IMAGE_EXTS.some((ext) => lower.endsWith(ext))) {
    return <ImageIcon className={`${className} text-sky-500`} aria-hidden="true" />;
  }
  if (category === 'Compressed' || ARCHIVE_EXTS.some((ext) => lower.endsWith(ext))) {
    return <FileArchive className={`${className} text-amber-500`} aria-hidden="true" />;
  }

  switch (category) {
    case 'Video':
      return <Film className={`${className} text-[var(--accent-primary)]`} aria-hidden="true" />;
    case 'Music':
      return <Music className={`${className} text-sky-500`} aria-hidden="true" />;
    case 'Documents':
      return <FileText className={`${className} text-slate-500 dark:text-slate-300`} aria-hidden="true" />;
    case 'Programs':
      return <Package className={`${className} text-indigo-500 dark:text-indigo-400`} aria-hidden="true" />;
    default:
      return <FileIcon className={`${className} text-[var(--text-secondary)]`} aria-hidden="true" />;
  }
}

export function StatusBadge({ status }: { status: DownloadStatus }) {
  const styles: Record<DownloadStatus, { label: string; style: React.CSSProperties; icon: React.ReactNode }> = {
    downloading: {
      label: 'Downloading',
      style: {
        color: 'var(--accent-primary)',
        backgroundColor: 'var(--accent-soft)',
      },
      icon: <ArrowDownCircle className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    idle: {
      label: 'Queued',
      style: {
        color: 'var(--semantic-warning)',
        backgroundColor: 'var(--semantic-warning-soft)',
      },
      icon: <Clock className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    paused: {
      label: 'Paused',
      style: {
        color: 'var(--semantic-warning)',
        backgroundColor: 'var(--semantic-warning-soft)',
      },
      icon: <PauseCircle className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    completed: {
      label: 'Completed',
      style: {
        color: 'var(--semantic-success)',
        backgroundColor: 'var(--semantic-success-soft)',
      },
      icon: <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    error: {
      label: 'Failed',
      style: {
        color: 'var(--semantic-error)',
        backgroundColor: 'var(--semantic-error-soft)',
      },
      icon: <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    needs_auth: {
      label: 'Auth Needed',
      style: {
        color: 'var(--semantic-warning)',
        backgroundColor: 'var(--semantic-warning-soft)',
      },
      icon: <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />,
    },
  };

  const cfg = styles[status] || styles.idle;
  return (
    <span
      style={cfg.style}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium leading-none"
    >
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
      ? 'var(--semantic-error)'
      : status === 'paused' || status === 'idle'
      ? 'var(--semantic-warning)'
      : status === 'completed'
      ? 'var(--semantic-success)'
      : 'var(--accent-primary)';

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(safePct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full ${height} rounded-full bg-[var(--surface-secondary)] overflow-hidden`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${safePct}%`, backgroundColor: fillColor }}
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
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-primary)]">
      <div className="w-11 h-11 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] flex items-center justify-center mb-3 text-[var(--text-muted)]">
        <Inbox className="w-5 h-5" aria-hidden="true" />
      </div>
      <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="text-[12.5px] text-[var(--text-secondary)] max-w-md mt-1 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 h-8 px-3.5 rounded-lg text-[12px] font-medium bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] cursor-pointer active:scale-[0.99]"
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rea-confirm-title"
        style={{ boxShadow: 'var(--shadow-popover)' }}
        className="w-full max-w-[440px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-5 animate-dialog-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <div
            style={{
              backgroundColor: danger ? 'var(--semantic-error-soft)' : 'var(--accent-soft)',
              color: danger ? 'var(--semantic-error)' : 'var(--accent-primary)',
            }}
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          >
            <AlertTriangle className="w-4.5 h-4.5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="rea-confirm-title" className="text-[15px] font-semibold text-[var(--text-primary)]">
              {title}
            </h3>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onCancel}
            className="h-8.5 px-3.5 rounded-lg text-[12.5px] font-medium border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] cursor-pointer active:scale-[0.99]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              backgroundColor: danger ? 'var(--semantic-error)' : 'var(--accent-primary)',
            }}
            className="h-8.5 px-3.5 rounded-lg text-[12.5px] font-medium text-white hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] cursor-pointer active:scale-[0.99]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
