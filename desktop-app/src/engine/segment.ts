import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import type { SegmentState } from './types.js';
import type { TokenBucketLimiter } from './limiter.js';

export class SegmentWorker {
  private activeRequest: http.ClientRequest | null = null;
  private aborted = false;
  private activeReject: ((err: Error) => void) | null = null;

  constructor(
    public readonly state: SegmentState,
    private readonly targetUrl: string,
    private readonly targetFilePath: string,
    private readonly customHeaders: Record<string, string> | undefined = {},
    private readonly limiter?: TokenBucketLimiter,
    private readonly onChunkDownloaded?: (segmentId: number, bytesDownloaded: number) => void
  ) {}

  public async start(): Promise<void> {
    if (this.state.totalBytes > 0 && this.state.current > this.state.end) {
      this.state.status = 'completed';
      return;
    }

    this.state.status = 'downloading';
    this.aborted = false;

    fs.mkdirSync(path.dirname(this.targetFilePath), { recursive: true });
    if (!fs.existsSync(this.targetFilePath)) {
      fs.writeFileSync(this.targetFilePath, Buffer.alloc(0));
    }

    return this.requestUrl(this.targetUrl, 0);
  }

  private requestUrl(currentUrl: string, redirectDepth: number): Promise<void> {
    if (redirectDepth > 8) {
      return Promise.reject(new Error('Too many redirects'));
    }

    const urlObj = new URL(currentUrl);
    const client = urlObj.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      this.activeReject = reject;

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Connection: 'keep-alive',
        ...this.customHeaders,
      };

      // Only send Range header when a known byte range is set
      if (this.state.end > 0 && this.state.end >= this.state.current) {
        headers.Range = `bytes=${this.state.current}-${this.state.end}`;
      }

      const req = client.request(
        currentUrl,
        {
          method: 'GET',
          headers,
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            const nextUrl = new URL(res.headers.location, currentUrl).toString();
            this.requestUrl(nextUrl, redirectDepth + 1).then(resolve, reject);
            return;
          }

          if (res.statusCode !== 206 && res.statusCode !== 200) {
            res.resume();
            this.state.status = 'failed';
            return reject(new Error(`Server returned HTTP ${res.statusCode}`));
          }

          const startOffset = res.statusCode === 200 ? 0 : this.state.current;
          const writeStream = fs.createWriteStream(this.targetFilePath, {
            flags: 'r+',
            start: startOffset,
          });

          let lastTickTime = Date.now();
          let bytesInWindow = 0;

          res.on('data', async (chunk: Buffer) => {
            if (this.aborted) {
              res.destroy();
              writeStream.end();
              return;
            }

            const len = chunk.length;
            if (this.limiter) {
              await this.limiter.consume(len);
            }

            this.state.current += len;
            this.state.downloadedBytes += len;
            bytesInWindow += len;

            const now = Date.now();
            const elapsed = now - lastTickTime;
            if (elapsed >= 500) {
              this.state.speedBytesPerSec = Math.round((bytesInWindow / elapsed) * 1000);
              bytesInWindow = 0;
              lastTickTime = now;
            }

            if (this.onChunkDownloaded) {
              this.onChunkDownloaded(this.state.id, len);
            }
          });

          res.pipe(writeStream);

          writeStream.on('finish', () => {
            if (!this.aborted) {
              this.state.status = 'completed';
              this.state.speedBytesPerSec = 0;
              resolve();
            }
          });

          writeStream.on('error', (err) => {
            this.state.status = 'failed';
            reject(err);
          });

          res.on('error', (err) => {
            this.state.status = 'failed';
            writeStream.end();
            reject(err);
          });
        }
      );

      this.activeRequest = req;

      req.on('error', (err) => {
        if (!this.aborted) {
          this.state.status = 'failed';
          reject(err);
        }
      });

      req.end();
    });
  }

  public pause(): void {
    this.aborted = true;
    this.state.status = 'paused';
    this.state.speedBytesPerSec = 0;
    if (this.activeRequest) {
      this.activeRequest.destroy();
      this.activeRequest = null;
    }
    if (this.activeReject) {
      this.activeReject(new Error('Segment paused'));
      this.activeReject = null;
    }
  }
}
