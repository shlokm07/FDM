import React from 'react';
import { ArrowDownToLine, Gauge, Timer, Library } from 'lucide-react';
import type { DaemonStatus } from '../types';
import { formatBytes, formatEta, formatSpeed } from '../lib/formatters';

export function OverviewCards({ status }: { status: DaemonStatus }) {
  const cards = [
    {
      label: 'Active Downloads',
      value: `${status.activeDownloads}`,
      meta: `${status.queuedDownloads} queued • ${status.pausedDownloads} paused`,
      icon: <ArrowDownToLine className="w-4 h-4 text-[var(--accent-primary)]" />,
    },
    {
      label: 'Current Speed',
      value: formatSpeed(status.totalSpeedBytesPerSec),
      meta: `${status.totalConnections} active socket threads`,
      icon: <Gauge className="w-4 h-4 text-[var(--semantic-info)]" />,
    },
    {
      label: 'Overall ETA',
      value:
        status.activeDownloads > 0
          ? formatEta(status.overallEtaSeconds, 'downloading')
          : 'Idle',
      meta: status.activeDownloads > 0 ? 'Estimated time remaining' : 'All transfers idle',
      icon: <Timer className="w-4 h-4 text-[var(--semantic-warning)]" />,
    },
    {
      label: 'Library Count',
      value: `${status.completedDownloads}`,
      meta: `${formatBytes(status.totalDownloadedBytes)} total downloaded`,
      icon: <Library className="w-4 h-4 text-[var(--semantic-success)]" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          style={{ boxShadow: 'var(--shadow-card)' }}
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-4 py-3.5 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-[var(--text-secondary)] truncate">{c.label}</div>
            <div className="mt-1 text-[20px] font-semibold tracking-tight text-[var(--text-primary)] tabular-nums leading-none">
              {c.value}
            </div>
            <div className="mt-1.5 text-[11.5px] text-[var(--text-muted)] truncate tabular-nums">{c.meta}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[var(--surface-secondary)] flex items-center justify-center shrink-0">
            {c.icon}
          </div>
        </div>
      ))}
    </div>
  );
}
