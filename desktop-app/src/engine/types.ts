export interface DownloadOptions {
  id?: string;
  url: string;
  outputPath?: string | undefined;
  connections?: number | undefined;
  chunkSizeThreshold?: number | undefined;
  headers?: Record<string, string> | undefined;
  cookies?: string | undefined;
  speedLimitBytesPerSec?: number | undefined; // 0 or undefined for unlimited
  onProgress?: ((progress: DownloadProgress) => void) | undefined;
  onSegmentUpdate?: ((segments: SegmentState[]) => void) | undefined;
}

export interface ProbeResult {
  url: string;
  acceptRanges: boolean;
  contentLength: number;
  etag?: string | undefined;
  lastModified?: string | undefined;
  contentType?: string | undefined;
  filename: string;
  statusCode: number;
}

export interface SegmentState {
  id: number;
  start: number;
  current: number;
  end: number;
  totalBytes: number;
  downloadedBytes: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'paused';
  speedBytesPerSec: number;
}

export interface DownloadState {
  id: string;
  url: string;
  filename: string;
  outputPath: string;
  totalBytes: number;
  etag?: string | undefined;
  lastModified?: string | undefined;
  acceptRanges: boolean;
  segments: SegmentState[];
  status: 'idle' | 'downloading' | 'paused' | 'completed' | 'error' | 'needs_auth';
  speedBytesPerSec: number;
  speedLimitBytesPerSec?: number | undefined;
  cookies?: string | undefined;
  encryptedCookies?: string | undefined;
  needsAuth?: boolean | undefined;
  startedAt?: number | undefined;
  updatedAt?: number | undefined;
  completedAt?: number | undefined;
  error?: string | undefined;
}

export interface DownloadProgress {
  id: string;
  totalBytes: number;
  downloadedBytes: number;
  percent: number;
  speedBytesPerSec: number;
  activeConnections: number;
  etaSeconds: number;
}

