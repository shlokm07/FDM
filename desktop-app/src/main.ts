#!/usr/bin/env node
import { exec } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { QueueManager } from './server/queue.js';
import { DaemonServer } from './server/daemon.js';
import { NativeMessagingHost } from './server/native-host.js';
import { ClipboardListener } from './server/clipboard-listener.js';

async function registerNativeMessagingHost(executablePath: string) {
  const manifestPath = path.resolve(path.dirname(executablePath), 'com.rea.idm.json');

  const manifest = {
    name: 'com.rea.idm',
    description: 'REA-IDM Native Messaging Host for Chrome and Edge',
    path: executablePath,
    type: 'stdio',
    allowed_origins: [
      'chrome-extension://*/*',
    ],
  };

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  // Register in HKCU for Google Chrome & Microsoft Edge
  const regCommands = [
    `reg add "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.rea.idm" /ve /t REG_SZ /d "${manifestPath}" /f`,
    `reg add "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\com.rea.idm" /ve /t REG_SZ /d "${manifestPath}" /f`,
    // Windows Autostart on boot (starts silently in background)
    `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "REA-IDM" /t REG_SZ /d "\\"${executablePath}\\" --daemon" /f`,
  ];

  for (const cmd of regCommands) {
    await new Promise((resolve) => exec(cmd, () => resolve(true)));
  }

  console.log(`[REA-IDM] Registered Native Messaging Host at: ${manifestPath}`);
  console.log(`[REA-IDM] Registered Windows Autostart entry.`);
}

async function main() {
  const args = process.argv.slice(2);
  const queueManager = new QueueManager();

  // Mode 1: Chrome Native Messaging Host (stdio)
  if (args.includes('--native-messaging')) {
    NativeMessagingHost.start(queueManager);
    return;
  }

  // Mode 2: Self-installation of Registry Keys & Windows Boot Autostart
  if (args.includes('--install')) {
    const currentExe = process.execPath;
    await registerNativeMessagingHost(currentExe);
    console.log('[REA-IDM] Installation, registry integration, and autostart configured.');
    return;
  }

  // Load persisted history & existing downloads before accepting connections
  await queueManager.init();

  // Mode 3: Desktop Daemon & Dashboard (Default Double-Click)
  const daemon = new DaemonServer(queueManager);
  const port = await daemon.start(8765);

  // Start event-driven clipboard URL listener
  ClipboardListener.start(queueManager);

  const memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  console.log('====================================================');
  console.log(`  REA-IDM — Ultra-Lightweight Download Manager`);
  console.log(`  Dashboard:  http://127.0.0.1:${port}`);
  console.log(`  Memory:     ${memUsage} MB RAM (vs 200MB+ in IDM/Electron)`);
  console.log(`  Clipboard:  Event-driven link sniffer active`);
  console.log(`  Status:     Online & Ready`);
  console.log('====================================================');

  if (!args.includes('--no-open') && !args.includes('--daemon')) {
    const startCmd = process.platform === 'win32' ? `start http://127.0.0.1:${port}` : `xdg-open http://127.0.0.1:${port}`;
    exec(startCmd);
  }

  const shutdown = async () => {
    console.log('\n[REA-IDM] Shutting down cleanly...');
    ClipboardListener.stop();
    await daemon.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(`[REA-IDM] Fatal Error: ${err.message}`);
  process.exit(1);
});
