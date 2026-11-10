import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { QueueManager } from './queue.js';

export class NativeMessagingHost {
  public static start(queueManager: QueueManager): void {
    let inputBuffer = Buffer.alloc(0);

    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        inputBuffer = Buffer.concat([inputBuffer, chunk]);

        while (inputBuffer.length >= 4) {
          const msgLen = inputBuffer.readUInt32LE(0);
          if (inputBuffer.length >= 4 + msgLen) {
            const msgBytes = inputBuffer.subarray(4, 4 + msgLen);
            inputBuffer = inputBuffer.subarray(4 + msgLen);

            try {
              const msg = JSON.parse(msgBytes.toString('utf-8'));
              NativeMessagingHost.handleMessage(msg, queueManager);
            } catch (err: any) {
              NativeMessagingHost.sendMessage({ success: false, error: err.message });
            }
          } else {
            break;
          }
        }
      }
    });

    process.stdin.on('end', () => {
      process.exit(0);
    });
  }

  private static async handleMessage(msg: any, queueManager: QueueManager): Promise<void> {
    try {
      await NativeMessagingHost.ensureDaemonRunning();

      if (msg.action === 'DOWNLOAD' && msg.data?.url) {
        const res = await NativeMessagingHost.postJson('http://127.0.0.1:8765/api/downloads/add', msg.data);
        NativeMessagingHost.sendMessage({
          success: true,
          downloadId: res.item?.id,
          filename: res.item?.filename,
        });
        return;
      }

      if (msg.action === 'BATCH_DOWNLOAD' && Array.isArray(msg.data?.items)) {
        const res = await NativeMessagingHost.postJson('http://127.0.0.1:8765/api/downloads/add', {
          items: msg.data.items,
        });
        NativeMessagingHost.sendMessage({
          success: true,
          items: res.items || [],
        });
        return;
      }

      if (msg.action === 'OPEN_APP') {
        NativeMessagingHost.launchOrFocusDesktopUi();
        await NativeMessagingHost.postJson('http://127.0.0.1:8765/api/app/focus', {}).catch(() => {});
        NativeMessagingHost.sendMessage({ success: true });
        return;
      }

      const status = await NativeMessagingHost.getJson('http://127.0.0.1:8765/api/status');
      NativeMessagingHost.sendMessage({
        success: true,
        ...status,
      });
    } catch {
      // Fallback directly to in-process queueManager if HTTP bridge fails
      if (msg.action === 'DOWNLOAD' && msg.data?.url) {
        await queueManager.init();
        const item = await queueManager.add(msg.data);
        NativeMessagingHost.sendMessage({
          success: true,
          downloadId: item.id,
          filename: item.filename,
        });
      } else {
        NativeMessagingHost.sendMessage({ success: false, error: 'Daemon unreachable' });
      }
    }
  }

  private static launchOrFocusDesktopUi(): void {
    const exeDir = path.dirname(process.execPath);
    const desktopExe = path.join(exeDir, 'REA-IDM.exe');
    if (fs.existsSync(desktopExe)) {
      try {
        const child = spawn(desktopExe, ['--focus'], {
          detached: true,
          stdio: 'ignore',
          cwd: exeDir,
        });
        child.unref();
      } catch {
        // Ignore launch failure
      }
    }
  }

  private static async ensureDaemonRunning(): Promise<void> {
    const alive = await NativeMessagingHost.isDaemonAlive();
    if (alive) return;

    const exeDir = path.dirname(process.execPath);
    const desktopExe = path.join(exeDir, 'REA-IDM.exe');
    const coreExe = process.execPath;

    const target = fs.existsSync(desktopExe) ? desktopExe : coreExe;
    const args = fs.existsSync(desktopExe) ? ['--minimized'] : ['--daemon', '--no-open'];

    const child = spawn(target, args, {
      detached: true,
      stdio: 'ignore',
      cwd: exeDir,
      windowsHide: !fs.existsSync(desktopExe),
    });
    child.unref();

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (await NativeMessagingHost.isDaemonAlive()) return;
    }
  }

  private static isDaemonAlive(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get('http://127.0.0.1:8765/api/status', (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(350, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  private static getJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      http
        .get(url, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        })
        .on('error', reject);
    });
  }

  private static postJson(url: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body || {});
      const u = new URL(url);
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data || '{}'));
            } catch {
              resolve({});
            }
          });
        }
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  public static sendMessage(msg: Record<string, any>): void {
    const jsonStr = JSON.stringify(msg);
    const msgBuffer = Buffer.from(jsonStr, 'utf-8');
    const lenBuffer = Buffer.alloc(4);
    lenBuffer.writeUInt32LE(msgBuffer.length, 0);

    process.stdout.write(Buffer.concat([lenBuffer, msgBuffer]));
  }
}
