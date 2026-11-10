import React from 'react';
import { Activity, Cpu, Wifi } from 'lucide-react';
import type { DaemonStatus, DownloadItem } from '../types';
import { formatEta, formatSpeed } from '../lib/formatters';

interface NetworkFooterProps {
  status: DaemonStatus;
  selectedItem: DownloadItem | null;
}

export function NetworkFooter({ status, selectedItem }: NetworkFooterProps) {
  const points = status.speedHistory || [];
  const padded = points.length >= 2 ? points : [{ t: 0, speed: 0, connections: 0 }, ...points, { t: 1, speed: 0, connections: 0 }];
  const maxSpeed = Math.max(1024 * 128, ...padded.map((p) => p.speed));

  const w = 320;
  const h = 54;
  const coords = padded.map((p, idx) => {
    const x = (idx / Math.max(1, padded.length - 1)) * w;
    const y = h - (p.speed / maxSpeed) * (h - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePath = `M ${coords.join(' L ')}`;
  const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`;

  const activeSegments = selectedItem && selectedItem.state.status !== 'completed' ? selectedItem.state.segments || [] : [];

  return (
    <footer className="h-28 shrink-0 px-5 py-2.5 border-t border-[var(--border-color)] bg-[var(--surface-bg)] grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
      {/* Live Speed Graph */}
      <div className="md:col-span-5 flex items-center gap-3 h-full">
        <div className="min-w-[115px]">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>Live Speed</span>
          </div>
          <div className="text-base font-semibold text-[var(--text-primary)] tabular-nums mt-0.5">
            {formatSpeed(status.totalSpeedBytesPerSec)}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] tabular-nums">
            Peak: {formatSpeed(Math.max(0, ...padded.map((p) => p.speed)))}
          </div>
        </div>
        <div className="flex-1 h-16 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] overflow-hidden p-1">
          <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <linearGradient id="reaSpeedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#reaSpeedFill)" />
            <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Network Activity & Connections */}
      <div className="md:col-span-4 flex flex-col justify-center gap-1.5 border-l border-[var(--border-color)] pl-4 h-full">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 font-semibold text-[var(--text-secondary)]">
            <Cpu className="w-3.5 h-3.5 text-sky-500" />
            Active Socket Slices
          </span>
          <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
            {status.totalConnections} threads • ETA: {status.activeDownloads > 0 ? formatEta(status.overallEtaSeconds, 'downloading') : 'Idle'}
          </span>
        </div>

        {activeSegments.length > 0 ? (
          <div className="flex gap-1 h-6 items-center">
            {activeSegments.map((seg) => {
              const total = Math.max(1, seg.end - seg.start + 1);
              const done = Math.max(0, seg.current - seg.start);
              const pct = Math.min(100, (done / total) * 100);
              return (
                <div
                  key={seg.id}
                  title={`Connection ${seg.id}: ${pct.toFixed(0)}%`}
                  className="flex-1 h-full rounded bg-[var(--subtle-bg)] border border-[var(--border-color)] relative overflow-hidden flex items-center justify-center"
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-[var(--accent)]/60 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative z-10 text-[9px] font-semibold text-[var(--text-primary)] tabular-nums">
                    C{seg.id}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[11px] text-[var(--text-muted)] truncate">
            {selectedItem
              ? `${selectedItem.filename} — ${selectedItem.state.status === 'completed' ? 'Saved on disk' : selectedItem.state.status}`
              : 'Select an active download to inspect parallel TCP segments.'}
          </div>
        )}
      </div>

      {/* Engine Connection Status */}
      <div className="md:col-span-3 flex items-center justify-end gap-2.5 border-l border-[var(--border-color)] pl-4 h-full">
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5 text-xs font-medium text-[var(--text-primary)]">
            <span className={`w-2 h-2 rounded-full ${status.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span>{status.status === 'online' ? 'Engine Online' : 'Connecting...'}</span>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
            127.0.0.1:8765 • v{status.version || '2.0.0'}
          </div>
        </div>
        <div className="w-8 h-8 rounded-lg bg-[var(--subtle-bg)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)]">
          <Wifi className="w-4 h-4" />
        </div>
      </div>
    </footer>
  );
}

