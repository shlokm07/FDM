import React from 'react';
import { ArrowDownToLine, Gauge, CheckCircle2, Timer } from 'lucide-react';
import type { DaemonStatus } from '../types';
import { formatBytes, formatEta, formatSpeed } from '../lib/formatters';

export function OverviewCards({ status }: { status: DaemonStatus }) {
  const cards = [
    {
      label: 'Active Transfers',
      value: `${status.activeDownloads}`,
      sub: `${status.queuedDownloads} queued • ${status.pausedDownloads} paused`,
      icon: <ArrowDownToLine className="w-4 h-4 text-emerald-500" />,
    },
    {
      label: 'Download Speed',
      value: formatSpeed(status.totalSpeedBytesPerSec),
      sub: `${status.totalConnections} active socket threads`,
      icon: <Gauge className="w-4 h-4 text-sky-500" />,
    },
    {
      label: 'Estimated Time Remaining',
      value:
        status.activeDownloads > 0
          ? formatEta(status.overallEtaSeconds, 'downloading')
          : 'Idle',
      sub: status.activeDownloads > 0 ? 'Queue completion estimate' : 'No active transfers',
      icon: <Timer className="w-4 h-4 text-amber-500" />,
    },
    {
      label: 'Downloaded Library',
      value: `${status.completedDownloads} files`,
      sub: `${formatBytes(status.totalDownloadedBytes)} total stored`,
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-3.5 shadow-xs transition-colors hover:border-[var(--accent)]/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">{c.label}</span>
            <div className="w-7 h-7 rounded-lg bg-[var(--subtle-bg)] flex items-center justify-center">{c.icon}</div>
          </div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-primary)] tabular-nums">
            {c.value}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-muted)] truncate">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

