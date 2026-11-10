import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { EventEmitter } from 'node:events';
import { DownloadManager } from '../engine/manager.js';
import { HlsStreamDownloader } from './stream-downloader.js';
import type { DownloadState, DownloadProgress } from '../engine/types.js';

export interface QueueItem {
  id: string;
  url: string;
  filename: string;
  outputPath: string;
  category: string;
  connections: number;
  headers?: Record<string, string> | undefined;
  state: DownloadState;
  manager: DownloadManager | null;
  progress: DownloadProgress;
  addedAt: number;
}

export interface AppSettings {
  downloadDir: string;
  maxConcurrentDownloads: number;
  globalSpeedLimit: number;
  clipboardAutoCapture: boolean;
}

interface PersistedData {
  settings?: Partial<AppSettings>;
  items?: Array<{
    id: string;
    url: string;
    filename: string;
    outputPath: string;
    category: string;
    connections?: number;
    state: DownloadState;
    progress: DownloadProgress;
    addedAt?: number;
  }>;
}

export class QueueManager extends EventEmitter {
  private queue: Map<string, QueueItem> = new Map();
  private maxConcurrentDownloads = 3;
  private globalSpeedLimit = 0; // 0 = unlimited
  private defaultDownloadDir = path.join(os.homedir(), 'Downloads', 'REA-IDM');
  private clipboardAutoCapture = false;
  private readonly historyPath: string;
  private saveTimer: NodeJS.Timeout | null = null;
  private lastFocusRequestAt = 0;

  constructor() {
    super();
    const appDataBase =
      process.env.LOCALAPPDATA ||
      path.join(os.homedir(), '.config');
    this.historyPath = path.join(appDataBase, 'REA-IDM', 'history.json');
  }

  public async init(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.historyPath), { recursive: true });
      await fs.mkdir(this.defaultDownloadDir, { recursive: true });

      if (fsSync.existsSync(this.historyPath)) {
        const raw = await fs.readFile(this.historyPath, 'utf-8');
        const parsed = JSON.parse(raw) as PersistedData;

        if (parsed.settings) {
          if (parsed.settings.downloadDir) this.defaultDownloadDir = parsed.settings.downloadDir;
          if (typeof parsed.settings.maxConcurrentDownloads === 'number') {
            this.maxConcurrentDownloads = Math.max(1, Math.min(10, parsed.settings.maxConcurrentDownloads));
          }
          if (typeof parsed.settings.globalSpeedLimit === 'number') {
            this.globalSpeedLimit = Math.max(0, parsed.settings.globalSpeedLimit);
          }
          if (typeof parsed.settings.clipboardAutoCapture === 'boolean') {
            this.clipboardAutoCapture = parsed.settings.clipboardAutoCapture;
          }
        }

        if (Array.isArray(parsed.items)) {
          for (const saved of parsed.items) {
            const restoredStatus =
              saved.state.status === 'downloading' || saved.state.status === 'idle'
                ? 'paused'
                : saved.state.status;

            // Check actual file size on disk for completed downloads
            let totalBytes = saved.state.totalBytes || saved.progress?.totalBytes || 0;
            let downloadedBytes = saved.progress?.downloadedBytes || 0;
            if (restoredStatus === 'completed' && fsSync.existsSync(saved.outputPath)) {
              try {
                const st = fsSync.statSync(saved.outputPath);
                totalBytes = st.size;
                downloadedBytes = st.size;
              } catch {
                // Keep saved values
              }
            }

            const item: QueueItem = {
              id: saved.id,
              url: saved.url,
              filename: saved.filename,
              outputPath: saved.outputPath,
              category: saved.category || this.detectCategory(saved.filename),
              connections: saved.connections || 8,
              state: {
                ...saved.state,
                status: restoredStatus,
                totalBytes,
                speedBytesPerSec: 0,
              },
              manager: null,
              progress: {
                ...(saved.progress || {
                  id: saved.id,
                  totalBytes,
                  downloadedBytes,
                  percent: restoredStatus === 'completed' ? 100 : 0,
                  speedBytesPerSec: 0,
                  activeConnections: 0,
                  etaSeconds: 0,
                }),
                totalBytes,
                downloadedBytes,
                speedBytesPerSec: 0,
                activeConnections: 0,
              },
              addedAt: saved.addedAt || saved.state.startedAt || Date.now(),
            };
            this.queue.set(item.id, item);
          }
        }
      }
    } catch {
      // Continue cleanly if history doesn't exist or is corrupted
    }

    await this.scanDownloadsFolder();
  }

  public async scanDownloadsFolder(): Promise<number> {
    let addedCount = 0;
    try {
      await fs.mkdir(this.defaultDownloadDir, { recursive: true });
      const entries = await fs.readdir(this.defaultDownloadDir, { withFileTypes: true });
      const knownPaths = new Set(
        Array.from(this.queue.values()).map((q) => path.resolve(q.outputPath).toLowerCase())
      );

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (entry.name.endsWith('.idm-state.json') || entry.name.endsWith('.idm-state.json.tmp')) {
          continue;
        }

        const fullPath = path.join(this.defaultDownloadDir, entry.name);
        if (knownPaths.has(path.resolve(fullPath).toLowerCase())) {
          continue;
        }

        // Skip partial files that still have an active state journal
        if (fsSync.existsSync(`${fullPath}.idm-state.json`)) {
          continue;
        }

        const stat = await fs.stat(fullPath);
        const id = 'disk-' + Math.random().toString(36).substring(2, 10);
        const item: QueueItem = {
          id,
          url: `file:///${fullPath.replace(/\\/g, '/')}`,
          filename: entry.name,
          outputPath: fullPath,
          category: this.detectCategory(entry.name),
          connections: 1,
          state: {
            id,
            url: `file:///${fullPath.replace(/\\/g, '/')}`,
            filename: entry.name,
            outputPath: fullPath,
            totalBytes: stat.size,
            acceptRanges: true,
            segments: [],
            status: 'completed',
            speedBytesPerSec: 0,
            startedAt: stat.birthtimeMs || stat.mtimeMs,
            completedAt: stat.mtimeMs,
          },
          manager: null,
          progress: {
            id,
            totalBytes: stat.size,
            downloadedBytes: stat.size,
            percent: 100,
            speedBytesPerSec: 0,
            activeConnections: 0,
            etaSeconds: 0,
          },
          addedAt: stat.mtimeMs,
        };

        this.queue.set(id, item);
        addedCount++;
      }

      if (addedCount > 0) {
        this.scheduleSave();
      }
    } catch {
      // Ignore folder scan errors
    }
    return addedCount;
  }

  public getItems(): QueueItem[] {
    // Newest first so recent and completed downloads appear immediately at top
    return Array.from(this.queue.values()).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  }

  public getItem(id: string): QueueItem | undefined {
    return this.queue.get(id);
  }

  public getSettings(): AppSettings {
    return {
      downloadDir: this.defaultDownloadDir,
      maxConcurrentDownloads: this.maxConcurrentDownloads,
      globalSpeedLimit: this.globalSpeedLimit,
      clipboardAutoCapture: this.clipboardAutoCapture,
    };
  }

  public updateSettings(partial: Partial<AppSettings>): AppSettings {
    if (partial.downloadDir && partial.downloadDir.trim()) {
      this.defaultDownloadDir = partial.downloadDir.trim();
      fsSync.mkdirSync(this.defaultDownloadDir, { recursive: true });
    }
    if (typeof partial.maxConcurrentDownloads === 'number') {
      this.setMaxConcurrent(partial.maxConcurrentDownloads);
    }
    if (typeof partial.globalSpeedLimit === 'number') {
      this.setGlobalSpeedLimit(partial.globalSpeedLimit);
    }
    if (typeof partial.clipboardAutoCapture === 'boolean') {
      this.clipboardAutoCapture = partial.clipboardAutoCapture;
    }
    this.scheduleSave();
    return this.getSettings();
  }

  public requestFocus(): void {
    this.lastFocusRequestAt = Date.now();
  }

  public getLastFocusRequestAt(): number {
    return this.lastFocusRequestAt;
  }

  public setMaxConcurrent(limit: number): void {
    this.maxConcurrentDownloads = Math.max(1, Math.min(10, limit));
    this.scheduleSave();
    this.processQueue();
  }

  public setGlobalSpeedLimit(bytesPerSec: number): void {
    this.globalSpeedLimit = Math.max(0, bytesPerSec);
    const active = this.getActiveItems();
    if (active.length > 0) {
      const perItemLimit =
        this.globalSpeedLimit > 0 ? Math.floor(this.globalSpeedLimit / active.length) : 0;
      for (const item of active) {
        if (item.manager) {
          item.manager.setSpeedLimit(perItemLimit);
        }
      }
    }
    this.scheduleSave();
  }

  public async add(options: {
    url: string;
    filename?: string;
    outputPath?: string;
    category?: string;
    connections?: number;
    headers?: Record<string, string>;
    title?: string;
    downloadMode?: string;
  }): Promise<QueueItem> {
    let targetUrl = options.url.trim();

    // Strip ranged chunk parameters from captured streaming URLs so full file downloads from byte 0
    try {
      const parsed = new URL(targetUrl);
      if (parsed.pathname.includes('videoplayback') && parsed.searchParams.has('range')) {
        parsed.searchParams.delete('range');
        targetUrl = parsed.toString();
      }
    } catch {
      // Keep original URL if URL parsing fails
    }

    const id = Math.random().toString(36).substring(2, 10);
    const derivedName = this.deriveFilename(targetUrl, options.filename, options.title, options.downloadMode);
    const targetDir = options.outputPath
      ? path.dirname(options.outputPath)
      : this.defaultDownloadDir;
    fsSync.mkdirSync(targetDir, { recursive: true });

    const finalOutputPath = options.outputPath
      ? options.outputPath
      : this.ensureUniquePath(path.join(targetDir, derivedName));
    const finalFilename = path.basename(finalOutputPath);
    const category = options.category || this.detectCategory(finalFilename);
    const connections = Math.max(1, Math.min(32, options.connections || 8));

    const initialProgress: DownloadProgress = {
      id,
      totalBytes: 0,
      downloadedBytes: 0,
      percent: 0,
      speedBytesPerSec: 0,
      activeConnections: 0,
      etaSeconds: 0,
    };

    const initialState: DownloadState = {
      id,
      url: targetUrl,
      filename: finalFilename,
      outputPath: finalOutputPath,
      totalBytes: 0,
      acceptRanges: true,
      segments: [],
      status: 'idle',
      speedBytesPerSec: 0,
      startedAt: Date.now(),
    };

    const item: QueueItem = {
      id,
      url: targetUrl,
      filename: finalFilename,
      outputPath: finalOutputPath,
      category,
      connections,
      headers: options.headers,
      state: initialState,
      manager: null,
      progress: initialProgress,
      addedAt: Date.now(),
    };

    this.queue.set(id, item);
    this.emit('item_added', item);
    this.scheduleSave();
    this.processQueue();

    return item;
  }

  public async pause(id: string): Promise<void> {
    const item = this.queue.get(id);
    if (!item) return;

    if (item.manager) {
      await item.manager.pause();
    }
    item.state.status = 'paused';
    item.progress.speedBytesPerSec = 0;
    item.progress.activeConnections = 0;
    this.emit('item_updated', item);
    this.scheduleSave();
    this.processQueue();
  }

  public async resume(id: string): Promise<void> {
    const item = this.queue.get(id);
    if (!item) return;

    if (item.state.status === 'completed' && fsSync.existsSync(item.outputPath)) {
      return;
    }

    item.state.status = 'idle';
    item.state.error = undefined;
    this.emit('item_updated', item);
    this.scheduleSave();
    this.processQueue();
  }

  public async cancel(id: string, deleteFile: boolean = false): Promise<void> {
    const item = this.queue.get(id);
    if (!item) return;

    if (item.manager) {
      await item.manager.pause();
    }
    this.queue.delete(id);

    if (deleteFile) {
      try {
        if (fsSync.existsSync(item.outputPath)) await fs.unlink(item.outputPath);
        if (fsSync.existsSync(`${item.outputPath}.idm-state.json`)) {
          await fs.unlink(`${item.outputPath}.idm-state.json`);
        }
      } catch {
        // Ignore deletion failures
      }
    }

    this.emit('item_removed', id);
    this.scheduleSave();
    this.processQueue();
  }

  public clearCompleted(): number {
    let count = 0;
    for (const [id, item] of this.queue.entries()) {
      if (item.state.status === 'completed') {
        this.queue.delete(id);
        count++;
      }
    }
    if (count > 0) {
      this.scheduleSave();
    }
    return count;
  }

  private getActiveItems(): QueueItem[] {
    return Array.from(this.queue.values()).filter(
      (item) => item.state.status === 'downloading'
    );
  }

  private processQueue(): void {
    const active = this.getActiveItems();
    if (active.length >= this.maxConcurrentDownloads) return;

    const pending = Array.from(this.queue.values()).filter(
      (item) => item.state.status === 'idle'
    );

    for (const item of pending) {
      if (this.getActiveItems().length >= this.maxConcurrentDownloads) break;
      this.startDownload(item);
    }
  }

  private async startDownload(item: QueueItem): Promise<void> {
    item.state.status = 'downloading';
    item.state.error = undefined;
    this.emit('item_updated', item);

    // Handle HLS .m3u8 streams through HlsStreamDownloader
    if (item.url.toLowerCase().includes('.m3u8')) {
      const hlsStart = Date.now();
      try {
        await HlsStreamDownloader.downloadM3u8(item.url, item.outputPath, (done, total) => {
          const percent = total > 0 ? Math.min(100, parseFloat(((done / total) * 100).toFixed(2))) : 0;
          const elapsedSec = Math.max(0.5, (Date.now() - hlsStart) / 1000);
          const rate = done / elapsedSec;
          const etaSeconds = rate > 0 && total > done ? Math.max(1, Math.round((total - done) / rate)) : 0;
          item.progress = {
            id: item.id,
            totalBytes: total,
            downloadedBytes: done,
            percent,
            speedBytesPerSec: 0,
            activeConnections: 6,
            etaSeconds,
          };
          this.emit('progress', item.progress);
        });

        const stat = await fs.stat(item.outputPath);
        item.state.status = 'completed';
        item.state.completedAt = Date.now();
        item.state.totalBytes = stat.size;
        item.progress = {
          id: item.id,
          totalBytes: stat.size,
          downloadedBytes: stat.size,
          percent: 100,
          speedBytesPerSec: 0,
          activeConnections: 0,
          etaSeconds: 0,
        };
        this.emit('item_completed', item);
        this.scheduleSave();
      } catch (err: any) {
        item.state.status = 'error';
        item.state.error = err.message;
        this.emit('item_error', { id: item.id, error: err.message });
        this.scheduleSave();
      } finally {
        this.processQueue();
      }
      return;
    }

    const manager = new DownloadManager({
      id: item.id,
      url: item.url,
      outputPath: item.outputPath,
      connections: item.connections || 8,
      headers: item.headers,
      speedLimitBytesPerSec:
        this.globalSpeedLimit > 0
          ? Math.floor(this.globalSpeedLimit / Math.max(1, this.getActiveItems().length))
          : 0,
      onProgress: (p) => {
        item.progress = p;
        item.state.totalBytes = p.totalBytes;
        item.state.speedBytesPerSec = p.speedBytesPerSec;
        this.emit('progress', p);
      },
      onSegmentUpdate: (segments) => {
        item.state.segments = segments;
        this.emit('segments', { id: item.id, segments });
      },
    });

    item.manager = manager;

    try {
      await manager.start();
      let finalSize = item.progress.totalBytes || item.progress.downloadedBytes;
      try {
        const st = await fs.stat(item.outputPath);
        finalSize = st.size;
      } catch {
        // Ignore stat error
      }

      item.state.status = 'completed';
      item.state.completedAt = Date.now();
      item.state.totalBytes = finalSize;
      item.state.speedBytesPerSec = 0;
      item.progress.totalBytes = finalSize;
      item.progress.downloadedBytes = finalSize;
      item.progress.percent = 100;
      item.progress.speedBytesPerSec = 0;
      item.progress.activeConnections = 0;
      this.emit('item_completed', item);
      this.scheduleSave();
    } catch (err: any) {
      if (err.message !== 'Download paused') {
        item.state.status = 'error';
        item.state.error = err.message;
        item.progress.speedBytesPerSec = 0;
        item.progress.activeConnections = 0;
        this.emit('item_error', { id: item.id, error: err.message });
        this.scheduleSave();
      }
    } finally {
      item.manager = null;
      this.processQueue();
    }
  }

  private deriveFilename(
    targetUrl: string,
    explicitName?: string,
    pageTitle?: string,
    downloadMode?: string
  ): string {
    if (explicitName && explicitName.trim()) {
      return this.sanitizeFilename(path.basename(explicitName.trim()));
    }

    try {
      const u = new URL(targetUrl);
      const rawBase = decodeURIComponent(path.basename(u.pathname));
      const cleanBase = this.sanitizeFilename(rawBase);
      const ext = path.extname(cleanBase).toLowerCase();

      if (targetUrl.toLowerCase().includes('.m3u8')) {
        const baseTitle = pageTitle ? this.sanitizeFilename(pageTitle).slice(0, 60) : `Stream-${Date.now()}`;
        return `${baseTitle}.ts`;
      }

      if (u.pathname.includes('videoplayback') || !cleanBase || cleanBase === '/' || (!ext && pageTitle)) {
        let inferredExt = downloadMode === 'audio' ? '.m4a' : '.mp4';
        const mime = u.searchParams.get('mime') || '';
        if (mime.includes('webm')) inferredExt = '.webm';
        else if (mime.includes('audio/mp4')) inferredExt = '.m4a';
        else if (mime.includes('mpeg')) inferredExt = '.mp3';
        else if (ext) inferredExt = ext;

        const baseTitle = pageTitle ? this.sanitizeFilename(pageTitle).slice(0, 60) : `Video-${Date.now()}`;
        return `${baseTitle}${inferredExt}`;
      }

      if (cleanBase && cleanBase.length > 0) {
        return cleanBase;
      }
    } catch {
      // Ignore parse errors
    }

    return `download-${Date.now()}.bin`;
  }

  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/, '');
  }

  private ensureUniquePath(desiredPath: string): string {
    if (!fsSync.existsSync(desiredPath)) {
      return desiredPath;
    }

    const dir = path.dirname(desiredPath);
    const ext = path.extname(desiredPath);
    const base = path.basename(desiredPath, ext);
    let counter = 1;
    while (counter < 1000) {
      const candidate = path.join(dir, `${base} (${counter})${ext}`);
      if (!fsSync.existsSync(candidate)) {
        return candidate;
      }
      counter++;
    }
    return desiredPath;
  }

  private detectCategory(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.ts', '.m3u8', '.flv', '.wmv'];
    const musicExts = ['.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a', '.opus'];
    const archiveExts = ['.zip', '.rar', '.7z', '.tar', '.gz', '.iso', '.xz'];
    const docExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.md'];
    const progExts = ['.exe', '.msi', '.apk', '.dmg', '.pkg', '.deb', '.rpm', '.msix'];

    if (videoExts.includes(ext)) return 'Video';
    if (musicExts.includes(ext)) return 'Music';
    if (archiveExts.includes(ext)) return 'Compressed';
    if (docExts.includes(ext)) return 'Documents';
    if (progExts.includes(ext)) return 'Programs';
    return 'Other';
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.persistNow().catch(() => {});
    }, 300);
  }

  public async persistNow(): Promise<void> {
    const data: PersistedData = {
      settings: this.getSettings(),
      items: Array.from(this.queue.values()).map((i) => ({
        id: i.id,
        url: i.url,
        filename: i.filename,
        outputPath: i.outputPath,
        category: i.category,
        connections: i.connections,
        state: i.state,
        progress: i.progress,
        addedAt: i.addedAt,
      })),
    };

    const temp = `${this.historyPath}.tmp`;
    await fs.mkdir(path.dirname(this.historyPath), { recursive: true });
    await fs.writeFile(temp, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(temp, this.historyPath);
  }
}
