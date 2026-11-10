import { spawn } from 'node:child_process';
import type { QueueManager } from './queue.js';

export class ClipboardListener {
  private static activeProcess: any = null;
  private static lastUrl: string = '';

  public static start(queueManager: QueueManager): void {
    if (process.platform !== 'win32') return;

    // PowerShell script utilizing Windows AddClipboardFormatListener for 0% CPU event-driven notifications
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      $form = New-Object System.Windows.Forms.Form
      $form.ShowInTaskbar = $false
      $form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized

      $code = @"
      using System;
      using System.Runtime.InteropServices;
      public class NativeClipboard {
          [DllImport("user32.dll", SetLastError = true)]
          public static extern bool AddClipboardFormatListener(IntPtr hWnd);
      }
"@
      Add-Type -TypeDefinition $code

      $handle = $form.Handle
      [NativeClipboard]::AddClipboardFormatListener($handle)

      $urlRegex = [regex]'https?:\\/\\/[^\\s]+\\.(zip|rar|7z|exe|msi|iso|mp4|mkv|mov|webm|pdf|tar|gz)(\\?[^\\s]*)?'

      $lastText = ""
      while ($true) {
          [System.Windows.Forms.Application]::DoEvents()
          if ([System.Windows.Forms.Clipboard]::ContainsText()) {
              $text = [System.Windows.Forms.Clipboard]::GetText().Trim()
              if ($text -ne $lastText -and $text -match $urlRegex) {
                  $lastText = $text
                  Write-Output "CLIPBOARD_URL:$text"
              }
          }
          Start-Sleep -Milliseconds 800
      }
    `;

    try {
      const child = spawn('powershell', ['-NoProfile', '-Command', psScript], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      });

      child.stdout.on('data', (data) => {
        const lines = data.toString('utf-8').split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('CLIPBOARD_URL:')) {
            const url = trimmed.replace('CLIPBOARD_URL:', '').trim();
            if (url && url !== ClipboardListener.lastUrl && queueManager.getSettings().clipboardAutoCapture) {
              ClipboardListener.lastUrl = url;
              console.log(`[REA-IDM Clipboard] Captured download link: ${url}`);
              queueManager.add({ url });
            }
          }
        }
      });

      ClipboardListener.activeProcess = child;
    } catch {
      // Fallback
    }
  }

  public static stop(): void {
    if (ClipboardListener.activeProcess) {
      ClipboardListener.activeProcess.kill();
      ClipboardListener.activeProcess = null;
    }
  }
}

