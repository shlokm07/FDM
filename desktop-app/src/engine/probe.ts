import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import path from 'node:path';
import type { ProbeResult } from './types.js';

export class HttpProbe {
  public static async probe(targetUrl: string, customHeaders: Record<string, string> | undefined = {}): Promise<ProbeResult> {
    try {
      const headRes = await HttpProbe.requestProbe(targetUrl, 'HEAD', customHeaders);
      if (headRes.statusCode >= 400) {
        return await HttpProbe.requestProbe(targetUrl, 'GET', { ...customHeaders, Range: 'bytes=0-0' });
      }
      return headRes;
    } catch {
      return await HttpProbe.requestProbe(targetUrl, 'GET', { ...customHeaders, Range: 'bytes=0-0' });
    }
  }

  private static async requestProbe(
    targetUrl: string,
    method: 'HEAD' | 'GET',
    customHeaders: Record<string, string> | undefined = {},
    redirectDepth: number = 0
  ): Promise<ProbeResult> {
    if (redirectDepth > 8) {
      throw new Error('Too many redirects');
    }

    const urlObj = new URL(targetUrl);
    const client = urlObj.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const req = client.request(
        targetUrl,
        {
          method,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            ...customHeaders,
          },
        },
        async (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            const redirectUrl = new URL(res.headers.location, targetUrl).toString();
            try {
              const redirected = await HttpProbe.requestProbe(redirectUrl, method, customHeaders, redirectDepth + 1);
              return resolve(redirected);
            } catch (err) {
              return reject(err);
            }
          }

          const acceptRangesHeader = res.headers['accept-ranges'];
          const contentRangeHeader = res.headers['content-range'];
          const contentLengthHeader = res.headers['content-length'];
          const etag = res.headers.etag ? String(res.headers.etag) : undefined;
          const lastModified = res.headers['last-modified'] ? String(res.headers['last-modified']) : undefined;
          const contentType = res.headers['content-type'] ? String(res.headers['content-type']) : undefined;

          let filename = HttpProbe.extractFilename(res.headers['content-disposition'], urlObj.pathname);

          // Parse total size from Content-Range (e.g., "bytes 0-0/123456") when using GET Range
          let contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : -1;
          let acceptRanges = acceptRangesHeader?.toLowerCase().includes('bytes') ?? false;

          if (typeof contentRangeHeader === 'string') {
            const totalMatch = contentRangeHeader.match(/\/(\d+)$/);
            if (totalMatch && totalMatch[1]) {
              contentLength = parseInt(totalMatch[1], 10);
              acceptRanges = true;
            }
          }

          if (res.statusCode === 206) {
            acceptRanges = true;
          }

          res.resume();

          if (method === 'HEAD' && !acceptRanges && contentLength > 0) {
            try {
              acceptRanges = await HttpProbe.verifyRangeSupport(targetUrl, customHeaders);
            } catch {
              acceptRanges = false;
            }
          }

          resolve({
            url: targetUrl,
            acceptRanges,
            contentLength,
            etag,
            lastModified,
            contentType,
            filename,
            statusCode: res.statusCode || 200,
          });
        }
      );

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy(new Error('Probe timeout'));
      });
      req.end();
    });
  }

  private static verifyRangeSupport(targetUrl: string, customHeaders: Record<string, string>): Promise<boolean> {
    const urlObj = new URL(targetUrl);
    const client = urlObj.protocol === 'https:' ? https : http;

    return new Promise((resolve) => {
      const req = client.request(
        targetUrl,
        {
          method: 'GET',
          headers: {
            Range: 'bytes=0-0',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) REA-IDM/1.0',
            ...customHeaders,
          },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode === 206);
        }
      );

      req.on('error', () => resolve(false));
      req.setTimeout(5000, () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  }

  public static extractFilename(disposition?: string | string[], pathname?: string): string {
    if (typeof disposition === 'string') {
      const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i);
      if (match && match[1]) {
        return path.basename(decodeURIComponent(match[1].trim()));
      }
    }

    if (pathname && pathname !== '/') {
      const base = path.basename(pathname);
      if (base) return base;
    }

    return 'download.bin';
  }
}

