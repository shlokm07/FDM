import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { QueueManager } from './queue.js';

export class DaemonServer {
  private server: http.Server | null = null;
  private wsClients: Set<any> = new Set();
  private staticDir: string;
  private speedHistory: Array<{ t: number; speed: number; connections: number }> = [];
  private telemetryTimer: NodeJS.Timeout | null = null;

  constructor(public readonly queueManager: QueueManager) {
    const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
    const adjacentUi = path.resolve(path.dirname(process.execPath), 'ui');
    this.staticDir = fsSync.existsSync(path.join(adjacentUi, 'index.html'))
      ? adjacentUi
      : path.resolve(currentDir, '../ui');

    this.queueManager.on('progress', () => this.broadcastQueue());
    this.queueManager.on('item_updated', () => this.broadcastQueue());
    this.queueManager.on('item_added', () => this.broadcastQueue());
    this.queueManager.on('item_completed', () => this.broadcastQueue());
    this.queueManager.on('item_removed', () => this.broadcastQueue());

    this.telemetryTimer = setInterval(() => {
      const items = this.queueManager.getItems();
      const active = items.filter((i) => i.state.status === 'downloading');
      const totalSpeed = active.reduce((sum, i) => sum + (i.progress?.speedBytesPerSec || 0), 0);
      const totalConns = active.reduce((sum, i) => sum + (i.progress?.activeConnections || 0), 0);
      this.speedHistory.push({ t: Date.now(), speed: totalSpeed, connections: totalConns });
      if (this.speedHistory.length > 60) {
        this.speedHistory.shift();
      }
    }, 1000);
  }

  public async start(port: number = 8765): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });

      this.server.on('upgrade', (req, socket) => {
        if (req.url === '/ws') {
          this.handleWebSocketUpgrade(socket);
        } else {
          socket.destroy();
        }
      });

      this.server.listen(port, '127.0.0.1', () => {
        resolve(port);
      });

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(port);
        } else {
          reject(err);
        }
      });
    });
  }

  public async stop(): Promise<void> {
    if (this.telemetryTimer) {
      clearInterval(this.telemetryTimer);
      this.telemetryTimer = null;
    }
    await this.queueManager.persistNow().catch(() => {});
    if (this.server) {
      await new Promise<void>((resolve) => this.server?.close(() => resolve()));
      this.server = null;
    }
  }

  private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1:8765'}`);

    if (url.pathname.startsWith('/api/')) {
      return this.handleApiRequest(req, res, url);
    }

    return this.handleStaticRequest(req, res, url);
  }

  private serializeItems() {
    return this.queueManager.getItems().map((i) => ({
      id: i.id,
      url: i.url,
      filename: i.filename,
      outputPath: i.outputPath,
      category: i.category,
      connections: i.connections,
      state: i.state,
      progress: i.progress,
      addedAt: i.addedAt,
      fileExists: fsSync.existsSync(i.outputPath),
    }));
  }

  private async handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
    const json = (data: any, code: number = 200) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    if (url.pathname === '/api/status' && req.method === 'GET') {
      const items = this.queueManager.getItems();
      const active = items.filter((i) => i.state.status === 'downloading');
      const queued = items.filter((i) => i.state.status === 'idle');
      const paused = items.filter((i) => i.state.status === 'paused');
      const completed = items.filter((i) => i.state.status === 'completed');
      const failed = items.filter((i) => i.state.status === 'error');
      const totalSpeed = active.reduce((sum, i) => sum + (i.progress?.speedBytesPerSec || 0), 0);
      const totalConnections = active.reduce((sum, i) => sum + (i.progress?.activeConnections || 0), 0);
      const totalDownloadedBytes = items.reduce(
        (sum, i) => sum + (i.progress?.downloadedBytes || (i.state.status === 'completed' ? i.state.totalBytes : 0)),
        0
      );
      const remainingBytes = active.reduce(
        (sum, i) => sum + Math.max(0, (i.state.totalBytes || 0) - (i.progress?.downloadedBytes || 0)),
        0
      );
      const overallEtaSeconds = totalSpeed > 0 && remainingBytes > 0 ? Math.max(1, Math.round(remainingBytes / totalSpeed)) : 0;

      return json({
        status: 'online',
        version: '2.0.0',
        activeDownloads: active.length,
        queuedDownloads: queued.length,
        pausedDownloads: paused.length,
        completedDownloads: completed.length,
        failedDownloads: failed.length,
        totalDownloads: items.length,
        totalSpeedBytesPerSec: totalSpeed,
        totalConnections,
        totalDownloadedBytes,
        overallEtaSeconds,
        speedHistory: this.speedHistory,
        focusSignal: this.queueManager.getLastFocusRequestAt(),
        settings: this.queueManager.getSettings(),
      });
    }

    if (url.pathname === '/api/downloads' && req.method === 'GET') {
      return json(this.serializeItems());
    }

    if (url.pathname === '/api/downloads/add' && req.method === 'POST') {
      const body = await this.readBodyJson(req);

      // Support batch download additions from Chrome Extension
      if (Array.isArray(body.items) && body.items.length > 0) {
        const added = [];
        for (const entry of body.items) {
          if (entry && entry.url) {
            const headers: Record<string, string> = { ...(entry.headers || {}) };
            if (entry.referer && !headers.Referer) headers.Referer = entry.referer;
            const item = await this.queueManager.add({
              url: entry.url,
              filename: entry.filename,
              outputPath: entry.outputPath,
              connections: entry.connections || 8,
              headers,
              title: entry.title,
              downloadMode: entry.downloadMode,
            });
            added.push({ id: item.id, filename: item.filename });
          }
        }
        return json({ success: true, items: added });
      }

      if (!body.url) {
        return json({ error: 'Missing url parameter' }, 400);
      }

      const headers: Record<string, string> = { ...(body.headers || {}) };
      if (body.referer && !headers.Referer) {
        headers.Referer = body.referer;
      }

      const item = await this.queueManager.add({
        url: body.url,
        filename: body.filename,
        outputPath: body.outputPath,
        category: body.category,
        connections: body.connections || 8,
        headers,
        title: body.title,
        downloadMode: body.downloadMode,
      });

      return json({
        success: true,
        item: { id: item.id, filename: item.filename, outputPath: item.outputPath },
      });
    }

    if (url.pathname === '/api/downloads/clear-completed' && req.method === 'POST') {
      const removed = this.queueManager.clearCompleted();
      return json({ success: true, removed });
    }

    if (url.pathname === '/api/downloads/scan' && req.method === 'POST') {
      const added = await this.queueManager.scanDownloadsFolder();
      return json({ success: true, added });
    }

    const match = url.pathname.match(/^\/api\/downloads\/([^/]+)\/(pause|resume|cancel|open|open-folder)$/);
    if (match && req.method === 'POST') {
      const id = decodeURIComponent(match[1]!);
      const action = match[2]!;
      const body = await this.readBodyJson(req);

      if (action === 'pause') await this.queueManager.pause(id);
      if (action === 'resume') await this.queueManager.resume(id);
      if (action === 'cancel') await this.queueManager.cancel(id, Boolean(body.deleteFile));
      if (action === 'open') {
        const item = this.queueManager.getItem(id);
        if (item && fsSync.existsSync(item.outputPath)) {
          this.openInShell(item.outputPath);
        }
      }
      if (action === 'open-folder') {
        const item = this.queueManager.getItem(id);
        if (item) {
          this.revealInFolder(item.outputPath);
        } else {
          this.openFolder(this.queueManager.getSettings().downloadDir);
        }
      }

      return json({ success: true, id, action });
    }

    if (url.pathname === '/api/downloads/open-dir' && req.method === 'POST') {
      this.openFolder(this.queueManager.getSettings().downloadDir);
      return json({ success: true });
    }

    if (url.pathname === '/api/settings' && req.method === 'GET') {
      return json(this.queueManager.getSettings());
    }

    if (url.pathname === '/api/settings' && req.method === 'POST') {
      const body = await this.readBodyJson(req);
      const updated = this.queueManager.updateSettings({
        downloadDir: body.downloadDir,
        maxConcurrentDownloads:
          typeof body.maxConcurrentDownloads === 'number' ? body.maxConcurrentDownloads : undefined,
        globalSpeedLimit:
          typeof body.globalSpeedLimit === 'number' ? body.globalSpeedLimit : undefined,
        clipboardAutoCapture:
          typeof body.clipboardAutoCapture === 'boolean' ? body.clipboardAutoCapture : undefined,
      });
      return json({ success: true, settings: updated });
    }

    if (url.pathname === '/api/settings/speed-limit' && req.method === 'POST') {
      const body = await this.readBodyJson(req);
      const limit = parseInt(body.bytesPerSecond || '0', 10);
      this.queueManager.setGlobalSpeedLimit(limit);
      return json({ success: true, speedLimit: limit });
    }

    if (url.pathname === '/api/app/focus' && req.method === 'POST') {
      this.queueManager.requestFocus();
      return json({ success: true });
    }

    return json({ error: 'Not found' }, 404);
  }

  private openInShell(filePath: string): void {
    if (process.platform === 'win32') {
      exec(`cmd /c start "" "${filePath.replace(/"/g, '')}"`);
    } else {
      exec(`xdg-open "${filePath}"`);
    }
  }

  private revealInFolder(filePath: string): void {
    if (process.platform === 'win32') {
      if (fsSync.existsSync(filePath)) {
        exec(`explorer.exe /select,"${filePath.replace(/"/g, '')}"`);
      } else {
        this.openFolder(path.dirname(filePath));
      }
    } else {
      exec(`xdg-open "${path.dirname(filePath)}"`);
    }
  }

  private openFolder(dirPath: string): void {
    fsSync.mkdirSync(dirPath, { recursive: true });
    if (process.platform === 'win32') {
      exec(`explorer.exe "${dirPath.replace(/"/g, '')}"`);
    } else {
      exec(`xdg-open "${dirPath}"`);
    }
  }

  private async handleStaticRequest(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
    const embeddedHtml = (globalThis as any).__EMBEDDED_INDEX_HTML;
    const embeddedCss = (globalThis as any).__EMBEDDED_STYLES_CSS;
    const embeddedJs = (globalThis as any).__EMBEDDED_APP_JS;

    if (url.pathname === '/' || url.pathname === '/index.html') {
      if (embeddedHtml) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(embeddedHtml);
        return;
      }
    } else if (url.pathname === '/styles.css') {
      if (embeddedCss) {
        res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
        res.end(embeddedCss);
        return;
      }
    } else if (url.pathname === '/app.js') {
      if (embeddedJs) {
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        res.end(embeddedJs);
        return;
      }
    }

    const filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    const targetFile = path.join(this.staticDir, filePath);

    try {
      const data = await fs.readFile(targetFile);
      const ext = path.extname(targetFile).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
    }
  }

  private handleWebSocketUpgrade(socket: any): void {
    this.wsClients.add(socket);
    socket.on('close', () => this.wsClients.delete(socket));
  }

  private broadcastQueue(): void {
    // Queue state is streamed over GET /api/downloads
  }

  private async readBodyJson(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          resolve(JSON.parse(body || '{}'));
        } catch {
          resolve({});
        }
      });
    });
  }
}
