import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { HttpProbe } from './probe.js';
import { StateJournal } from './journal.js';
import { SegmentWorker } from './segment.js';
import { TokenBucketLimiter } from './limiter.js';
import type {
  DownloadOptions,
  DownloadProgress,
  DownloadState,
  ProbeResult,
  SegmentState,
} from './types.js';

export class DownloadManager {
  private state: DownloadState | null = null;
  private workers: Map<number, SegmentWorker> = new Map();
  private isPaused = false;
  private timer: NodeJS.Timeout | null = null;
  private totalDownloadedBytes = 0;
  private recentDownloadedBytes = 0;
  private lastSpeedCalcTime = Date.now();
  private currentSpeed = 0;
  private smoothedSpeed = 0;
  private limiter: TokenBucketLimiter;

  constructor(private readonly options: DownloadOptions) {
    this.limiter = new TokenBucketLimiter(options.speedLimitBytesPerSec || 0);
  }

  public setSpeedLimit(bytesPerSecond: number): void {
    this.limiter.setLimit(bytesPerSecond);
    if (this.state) {
      this.state.speedLimitBytesPerSec = bytesPerSecond;
    }
  }

  public getState(): DownloadState | null {
    return this.state;
  }

  public async start(): Promise<string> {
    this.isPaused = false;
    const probe = await HttpProbe.probe(this.options.url, this.options.headers);

    const outputPath =
      this.options.outputPath || path.resolve(process.cwd(), probe.filename);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const savedState = await StateJournal.load(outputPath);

    if (
      savedState &&
      savedState.url === this.options.url &&
      savedState.totalBytes === probe.contentLength &&
      (!savedState.etag || savedState.etag === probe.etag)
    ) {
      this.state = savedState;
      this.state.status = 'downloading';
    } else {
      this.state = await this.initializeState(probe, outputPath);
    }

    await this.preallocateFile(outputPath, this.state.totalBytes);

    this.totalDownloadedBytes = this.state.segments.reduce(
      (sum, s) => sum + s.downloadedBytes,
      0
    );

    this.startPeriodicTasks();

    try {
      if (!this.state.acceptRanges || this.state.totalBytes <= 0) {
        await this.downloadSingleStream();
      } else {
        await this.runSegmentedDownload();
      }

      if (this.isPaused) {
        throw new Error('Download paused');
      }

      this.state.status = 'completed';
      this.state.completedAt = Date.now();
      if (this.state.totalBytes <= 0 && this.totalDownloadedBytes > 0) {
        this.state.totalBytes = this.totalDownloadedBytes;
      }
      await StateJournal.remove(this.state.outputPath);
      this.stopPeriodicTasks();
      this.emitProgress();

      return this.state.outputPath;
    } catch (err: any) {
      if (this.isPaused) {
        this.state.status = 'paused';
        await StateJournal.save(this.state);
        throw new Error('Download paused');
      }
      this.state.status = 'error';
      this.state.error = err.message;
      await StateJournal.save(this.state);
      throw err;
    } finally {
      this.stopPeriodicTasks();
    }
  }

  public async pause(): Promise<void> {
    this.isPaused = true;
    for (const worker of this.workers.values()) {
      worker.pause();
    }
    this.workers.clear();

    if (this.state) {
      this.state.status = 'paused';
      this.state.speedBytesPerSec = 0;
      await StateJournal.save(this.state);
    }
  }

  private async preallocateFile(filePath: string, totalBytes: number): Promise<void> {
    if (totalBytes <= 0) return;

    // Check physical disk quota before allocating
    try {
      if (typeof fs.statfs === 'function') {
        const stats = await fs.statfs(path.dirname(filePath));
        const freeBytes = stats.bavail * stats.bsize;
        if (freeBytes < totalBytes) {
          throw new Error(`Insufficient disk space: ${totalBytes} bytes required, but only ${freeBytes} bytes free.`);
        }
      }
    } catch (e: any) {
      if (e.message.startsWith('Insufficient disk space')) throw e;
    }

    let handle: fs.FileHandle | null = null;
    try {
      try {
        const stats = await fs.stat(filePath);
        if (stats.size === totalBytes) {
          return;
        }
      } catch {
        // Does not exist
      }

      handle = await fs.open(filePath, fsConstants.O_CREAT | fsConstants.O_RDWR);

      // If file > 5 GB on Windows, enable NTFS sparse allocation for instant 0ms reservation
      if (process.platform === 'win32' && totalBytes > 5 * 1024 * 1024 * 1024) {
        try {
          const { exec } = await import('node:child_process');
          await new Promise((resolve) => exec(`fsutil sparse setflag "${filePath}"`, () => resolve(true)));
        } catch {
          // Fallback to normal truncate
        }
      }

      await handle.truncate(totalBytes);
    } finally {
      if (handle) {
        await handle.close();
      }
    }
  }

  private async initializeState(
    probe: ProbeResult,
    outputPath: string
  ): Promise<DownloadState> {
    const numConnections = probe.acceptRanges
      ? Math.max(1, Math.min(this.options.connections || 8, 32))
      : 1;

    const segments: SegmentState[] = [];
    const totalBytes = probe.contentLength;

    if (probe.acceptRanges && totalBytes > 0) {
      const chunkSize = Math.floor(totalBytes / numConnections);
      let offset = 0;

      for (let i = 0; i < numConnections; i++) {
        const start = offset;
        const end = i === numConnections - 1 ? totalBytes - 1 : offset + chunkSize - 1;
        const segmentTotal = end - start + 1;

        segments.push({
          id: i + 1,
          start,
          current: start,
          end,
          totalBytes: segmentTotal,
          downloadedBytes: 0,
          status: 'pending',
          speedBytesPerSec: 0,
        });

        offset = end + 1;
      }
    } else {
      segments.push({
        id: 1,
        start: 0,
        current: 0,
        end: totalBytes > 0 ? totalBytes - 1 : 0,
        totalBytes: totalBytes > 0 ? totalBytes : 0,
        downloadedBytes: 0,
        status: 'pending',
        speedBytesPerSec: 0,
      });
    }

    const state: DownloadState = {
      id: this.options.id || Math.random().toString(36).substring(2, 10),
      url: probe.url,
      filename: probe.filename,
      outputPath,
      totalBytes,
      etag: probe.etag,
      lastModified: probe.lastModified,
      acceptRanges: probe.acceptRanges,
      segments,
      status: 'idle',
      speedBytesPerSec: 0,
      startedAt: Date.now(),
    };

    await StateJournal.save(state);
    return state;
  }

  private async runSegmentedDownload(): Promise<void> {
    if (!this.state) return;

    const pendingSegments = this.state.segments.filter((s) => s.status !== 'completed');
    const maxConnections = this.options.connections || 8;
    const threshold = this.options.chunkSizeThreshold || 1024 * 1024;

    const runWorker = async (segment: SegmentState): Promise<void> => {
      if (this.isPaused || segment.status === 'completed') return;

      const worker = new SegmentWorker(
        segment,
        this.state!.url,
        this.state!.outputPath,
        this.options.headers,
        this.limiter,
        (id, bytes) => {
          this.totalDownloadedBytes += bytes;
          this.recentDownloadedBytes += bytes;
        }
      );

      this.workers.set(segment.id, worker);
      try {
        await worker.start();
      } catch (err: any) {
        if (err.message?.includes('429') || err.message?.includes('503')) {
          // Adaptive host backoff on rate limits
          await new Promise((r) => setTimeout(r, 2000));
          if (!this.isPaused && (segment.totalBytes === 0 || segment.current <= segment.end)) {
            await worker.start();
          }
        } else if (err.message?.includes('416')) {
          // Gracefully downgrade to single stream without losing downloaded prefix
          await this.downloadSingleStream();
          return;
        } else {
          throw err;
        }
      } finally {
        this.workers.delete(segment.id);
      }

      if (!this.isPaused && this.workers.size < maxConnections) {
        this.tryDynamicSplit(threshold);
      }
    };

    await Promise.all(pendingSegments.map((s) => runWorker(s)));
  }

  private tryDynamicSplit(minChunkSize: number): void {
    if (!this.state || this.isPaused) return;

    let largestSegment: SegmentState | null = null;
    let maxRemaining = 0;

    for (const segment of this.state.segments) {
      if (segment.status === 'downloading') {
        const remaining = segment.end - segment.current + 1;
        if (remaining > maxRemaining) {
          maxRemaining = remaining;
          largestSegment = segment;
        }
      }
    }

    if (!largestSegment || maxRemaining < minChunkSize * 2) {
      return;
    }

    const mid = largestSegment.current + Math.floor(maxRemaining / 2);
    const oldEnd = largestSegment.end;

    largestSegment.end = mid;
    largestSegment.totalBytes = mid - largestSegment.start + 1;

    const newId = this.state.segments.length + 1;
    const newSegment: SegmentState = {
      id: newId,
      start: mid + 1,
      current: mid + 1,
      end: oldEnd,
      totalBytes: oldEnd - (mid + 1) + 1,
      downloadedBytes: 0,
      status: 'pending',
      speedBytesPerSec: 0,
    };

    this.state.segments.push(newSegment);

    const worker = new SegmentWorker(
      newSegment,
      this.state.url,
      this.state.outputPath,
      this.options.headers,
      this.limiter,
      (id, bytes) => {
        this.totalDownloadedBytes += bytes;
        this.recentDownloadedBytes += bytes;
      }
    );

    this.workers.set(newSegment.id, worker);
    worker
      .start()
      .then(() => {
        this.workers.delete(newSegment.id);
        this.tryDynamicSplit(minChunkSize);
      })
      .catch(() => {
        this.workers.delete(newSegment.id);
      });
  }

  private async downloadSingleStream(): Promise<void> {
    if (!this.state) return;
    const segment = this.state.segments[0];
    if (!segment) return;
    const worker = new SegmentWorker(
      segment,
      this.state.url,
      this.state.outputPath,
      this.options.headers ?? {},
      this.limiter,
      (id, bytes) => {
        this.totalDownloadedBytes += bytes;
        this.recentDownloadedBytes += bytes;
      }
    );
    this.workers.set(segment.id, worker);
    try {
      await worker.start();
    } finally {
      this.workers.delete(segment.id);
    }
  }

  private startPeriodicTasks(): void {
    this.stopPeriodicTasks();
    this.timer = setInterval(async () => {
      const now = Date.now();
      const elapsed = (now - this.lastSpeedCalcTime) / 1000;
      if (elapsed > 0) {
        const instantSpeed = Math.round(this.recentDownloadedBytes / elapsed);
        this.currentSpeed = instantSpeed;
        this.smoothedSpeed =
          this.smoothedSpeed === 0
            ? instantSpeed
            : Math.round(this.smoothedSpeed * 0.65 + instantSpeed * 0.35);
        this.recentDownloadedBytes = 0;
        this.lastSpeedCalcTime = now;
        if (this.state) {
          this.state.speedBytesPerSec = this.currentSpeed;
        }
      }

      this.emitProgress();

      if (this.state && !this.isPaused) {
        await StateJournal.save(this.state).catch(() => {});
      }
    }, 500);
  }

  private stopPeriodicTasks(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private emitProgress(): void {
    if (!this.state) return;

    const totalBytes = this.state.totalBytes;
    const downloaded = this.totalDownloadedBytes;
    const percent =
      totalBytes > 0
        ? Math.min(100, parseFloat(((downloaded / totalBytes) * 100).toFixed(2)))
        : 0;

    const remainingBytes = Math.max(0, totalBytes - downloaded);
    const effectiveSpeed = this.smoothedSpeed > 0 ? this.smoothedSpeed : this.currentSpeed;
    const etaSeconds =
      totalBytes > 0 && effectiveSpeed > 0
        ? Math.max(1, Math.round(remainingBytes / effectiveSpeed))
        : 0;

    const progress: DownloadProgress = {
      id: this.state.id,
      totalBytes,
      downloadedBytes: downloaded,
      percent,
      speedBytesPerSec: this.currentSpeed,
      activeConnections: this.workers.size,
      etaSeconds,
    };

    if (this.options.onProgress) {
      this.options.onProgress(progress);
    }

    if (this.options.onSegmentUpdate) {
      this.options.onSegmentUpdate([...this.state.segments]);
    }
  }
}

