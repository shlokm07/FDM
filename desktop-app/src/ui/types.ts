export type DownloadStatus = 'idle' | 'downloading' | 'paused' | 'completed' | 'error' | 'needs_auth';

export interface SegmentSlice {
  id: number;
  start: number;
  current: number;
  end: number;
  totalBytes: number;
  downloadedBytes: number;
  status: string;
  speedBytesPerSec: number;
}

export interface DownloadItem {
  id: string;
  url: string;
  filename: string;
  outputPath: string;
  category: string;
  connections: number;
  addedAt: number;
  fileExists: boolean;
  state: {
    id: string;
    url: string;
    filename: string;
    outputPath: string;
    totalBytes: number;
    acceptRanges: boolean;
    segments: SegmentSlice[];
    status: DownloadStatus;
    speedBytesPerSec: number;
    startedAt?: number;
    completedAt?: number;
    error?: string;
  };
  progress: {
    id: string;
    totalBytes: number;
    downloadedBytes: number;
    percent: number;
    speedBytesPerSec: number;
    activeConnections: number;
    etaSeconds: number;
  };
}

export interface SpeedPoint {
  t: number;
  speed: number;
  connections: number;
}

export interface AppSettings {
  downloadDir: string;
  maxConcurrentDownloads: number;
  globalSpeedLimit: number;
  clipboardAutoCapture: boolean;
}

export interface DaemonStatus {
  status: 'online' | 'offline';
  version: string;
  activeDownloads: number;
  queuedDownloads: number;
  pausedDownloads: number;
  completedDownloads: number;
  failedDownloads: number;
  totalDownloads: number;
  totalSpeedBytesPerSec: number;
  totalConnections: number;
  totalDownloadedBytes: number;
  overallEtaSeconds: number;
  speedHistory: SpeedPoint[];
  settings: AppSettings;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
  timestamp: number;
  read: boolean;
}

export type NavSection =
  | 'dashboard'
  | 'all'
  | 'downloading'
  | 'queued'
  | 'completed'
  | 'failed'
  | 'categories'
  | 'settings';

