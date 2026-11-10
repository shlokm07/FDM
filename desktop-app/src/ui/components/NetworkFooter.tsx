import React, { useState, useEffect } from 'react';
import { Activity, ChevronUp, ChevronDown, Cpu, Wifi } from 'lucide-react';
import type { DaemonStatus, DownloadItem } from '../types';
import { formatEta, formatSpeed } from '../lib/formatters';

interface NetworkFooterProps {
  status: DaemonStatus;
  selectedItem: DownloadItem | null;
}

export function NetworkFooter({ status, selectedItem }: NetworkFooterProps) {
  const [expanded, setExpanded] = useState<boolean>(() => {
    return localStorage.getItem('rea_idm_monitor_expanded') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('rea_idm_monitor_expanded', String(expanded));
  }, [expanded]);

  const points = status.speedHistory || [];
  const padded =
    points.length >= 2
      ? points
      : [
          { t: 0, speed: 0, connections: 0 },
          ...points,
          { t: 1, speed: 0, connections: 0 },
        ];
  const peakSpeed = Math.max(0, ...padded.map((p) => p.speed));
  const scaleMax = Math.max(1024 * 128, peakSpeed);

  const w = 360;
  const h = 76;
  const coords = padded.map((p, idx) => {
    const x = (idx / Math.max(1, padded.length - 1)) * w;
    const y = h - (p.speed / scaleMax) * (h - 10) - 5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePath = `M ${coords.join(' L ')}`;
  const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`;

  const activeSegments =
    selectedItem && selectedItem.state.status !== 'completed' ? selectedItem.state.segments || [] : [];
  const isOnline = status.status === 'online';
  const hasTraffic = status.totalSpeedBytesPerSec > 0;

  return (
    <footer className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-primary)] select-none">
      {/* Compact Always-Visible Header Strip (Default Collapsed State) */}
      <div className="h-10 px-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {/* Engine Health Indicator */}
          <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-primary)]">
            <span
              style={{ backgroundColor: isOnline ? 'var(--semantic-success)' : 'var(--semantic-error)' }}
              className="w-2 h-2 rounded-full shrink-0"
            />
            <span>{isOnline ? 'Engine Online' : 'Connecting...'}</span>
          </div>

          <span className="text-[var(--border-subtle)]">|</span>

          {/* Live Speed & Activity */}
          <div className="flex items-center gap-2 text-[12px] tabular-nums">
            <Activity
              className={`w-3.5 h-3.5 ${
                hasTraffic ? 'text-[var(--accent-primary)] animate-pulse' : 'text-[var(--text-muted)]'
              }`}
              aria-hidden="true"
            />
            <span className="font-semibold text-[var(--text-primary)]">
              {formatSpeed(status.totalSpeedBytesPerSec)}
            </span>
            <span className="hidden sm:inline text-[var(--text-secondary)]">
              • {status.totalConnections} active threads
              {status.activeDownloads > 0 && ` • ETA ${formatEta(status.overallEtaSeconds, 'downloading')}`}
            </span>
          </div>
        </div>

        {/* Expand / Collapse Control */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="rea-network-monitor-body"
          className="h-7 px-2.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[11.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>Network Monitor</span>
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Collapsible Expanded Details Area */}
      <div
        id="rea-network-monitor-body"
        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
          expanded ? 'max-h-44 opacity-100 border-t border-[var(--border-subtle)]' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-5 py-3 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Speed History Graph */}
          <div className="md:col-span-5 flex items-center gap-3.5">
            <div className="min-w-[110px] space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Throughput (60s)
              </div>
              <div className="text-[16px] font-semibold text-[var(--text-primary)] tabular-nums">
                {formatSpeed(status.totalSpeedBytesPerSec)}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                Peak: {formatSpeed(peakSpeed)}
              </div>
            </div>
            <div className="flex-1 h-20 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] overflow-hidden p-1.5 relative">
              <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
                <defs>
                  <linearGradient id="reaIndigoFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="var(--border-subtle)" strokeDasharray="3 3" strokeWidth="1" />
                <path d={areaPath} fill="url(#reaIndigoFill)" />
                <path d={linePath} fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Active Socket Slices */}
          <div className="md:col-span-4 md:border-l border-[var(--border-subtle)] md:pl-4 space-y-2">
            <div className="flex items-center justify-between text-[11.5px]">
              <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                <Cpu className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                Active Socket Slices
              </span>
              <span className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                {status.totalConnections} threads
              </span>
            </div>

            {activeSegments.length > 0 ? (
              <div className="flex gap-1 h-7 items-center">
                {activeSegments.map((seg) => {
                  const total = Math.max(1, seg.end - seg.start + 1);
                  const done = Math.max(0, seg.current - seg.start);
                  const pct = Math.min(100, (done / total) * 100);
                  return (
                    <div
                      key={seg.id}
                      title={`Thread C${seg.id}: ${pct.toFixed(0)}%`}
                      className="flex-1 h-full rounded-md bg-[var(--surface-secondary)] border border-[var(--border-subtle)] relative overflow-hidden flex items-center justify-center"
                    >
                      <div
                        className="absolute inset-y-0 left-0 transition-[width] duration-300"
                        style={{ width: `${pct}%`, backgroundColor: 'var(--accent-soft)' }}
                      />
                      <span className="relative z-10 text-[10px] font-medium text-[var(--text-primary)] tabular-nums">
                        C{seg.id}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-7 flex items-center text-[11.5px] text-[var(--text-muted)] truncate">
                {selectedItem
                  ? `${selectedItem.filename} — ${selectedItem.state.status === 'completed' ? 'Saved on disk' : selectedItem.state.status}`
                  : 'Select an active download to inspect parallel range slices.'}
              </div>
            )}
          </div>

          {/* Local Daemon Endpoint */}
          <div className="md:col-span-3 md:border-l border-[var(--border-subtle)] md:pl-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Local Daemon
              </div>
              <div className="text-[12.5px] font-medium text-[var(--text-primary)] tabular-nums mt-0.5">
                127.0.0.1:8765
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                Core v{status.version || '2.0.0'} • {status.activeDownloads} active
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
              <Wifi className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
