import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';

export class HlsStreamDownloader {
  public static async downloadM3u8(
    playlistUrl: string,
    outputPath: string,
    onProgress?: (downloadedSegments: number, totalSegments: number) => void
  ): Promise<string> {
    const playlistContent = await HlsStreamDownloader.fetchText(playlistUrl);
    const lines = playlistContent.split('\n').map((l) => l.trim());

    // Check for hardware DRM
    if (
      playlistContent.includes('KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"') ||
      playlistContent.includes('com.widevine') ||
      playlistContent.includes('SAMPLE-AES')
    ) {
      throw new Error('DRM Protected: Stream is locked with Widevine/FairPlay DRM and cannot be recorded.');
    }

    let aesKey: Buffer | null = null;
    let explicitIv: Buffer | null = null;
    let segmentUrls: string[] = [];
    const baseUrl = new URL(playlistUrl);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Parse AES-128 encryption key
      if (line.startsWith('#EXT-X-KEY:METHOD=AES-128')) {
        const uriMatch = line.match(/URI=["']([^"']+)["']/);
        const ivMatch = line.match(/IV=(0x[0-9a-fA-F]+)/);

        if (uriMatch && uriMatch[1]) {
          const keyUrl = new URL(uriMatch[1], baseUrl).toString();
          aesKey = await HlsStreamDownloader.fetchBuffer(keyUrl);
        }
        if (ivMatch && ivMatch[1]) {
          explicitIv = Buffer.from(ivMatch[1].slice(2), 'hex');
        }
      }

      if (!line.startsWith('#')) {
        const fullSegmentUrl = new URL(line, baseUrl).toString();
        segmentUrls.push(fullSegmentUrl);
      }
    }

    if (segmentUrls.length === 0) {
      throw new Error('No video segments found in M3U8 playlist.');
    }

    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    const writeStream = fs.createWriteStream(outputPath);

    let completed = 0;
    const total = segmentUrls.length;
    const batchSize = 6;

    for (let i = 0; i < total; i += batchSize) {
      const batch = segmentUrls.slice(i, i + batchSize);
      const chunks = await Promise.all(
        batch.map(async (url, idx) => {
          let buf = await HlsStreamDownloader.fetchBuffer(url);

          // Decrypt if AES-128 is configured
          if (aesKey) {
            const seqNumber = i + idx;
            const iv = explicitIv || HlsStreamDownloader.sequenceToIv(seqNumber);
            buf = HlsStreamDownloader.decryptAes128(buf, aesKey, iv);
          }

          return buf;
        })
      );

      for (const chunk of chunks) {
        writeStream.write(chunk);
        completed++;
        if (onProgress) {
          onProgress(completed, total);
        }
      }
    }

    writeStream.end();
    return new Promise((resolve) => {
      writeStream.on('finish', () => resolve(outputPath));
    });
  }

  private static decryptAes128(cipherBuffer: Buffer, key: Buffer, iv: Buffer): Buffer {
    try {
      const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
      return Buffer.concat([decipher.update(cipherBuffer), decipher.final()]);
    } catch {
      // In case of non-standard padding, return raw bytes
      return cipherBuffer;
    }
  }

  private static sequenceToIv(seq: number): Buffer {
    const iv = Buffer.alloc(16, 0);
    iv.writeUInt32BE(seq, 12);
    return iv;
  }

  private static fetchText(url: string): Promise<string> {
    const client = url.startsWith('https') ? https : http;
    return new Promise((resolve, reject) => {
      client.get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  private static fetchBuffer(url: string): Promise<Buffer> {
    const client = url.startsWith('https') ? https : http;
    return new Promise((resolve, reject) => {
      client.get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    });
  }
}
