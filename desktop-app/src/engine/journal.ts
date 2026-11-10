import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import type { DownloadState } from './types.js';

export class StateJournal {
  public static getJournalPath(targetFilePath: string): string {
    return `${targetFilePath}.idm-state.json`;
  }

  /**
   * Save download state. Sensitive cookies are encrypted using Windows DPAPI if running on Windows.
   */
  public static async save(state: DownloadState): Promise<void> {
    const journalPath = StateJournal.getJournalPath(state.outputPath);
    await fs.mkdir(path.dirname(journalPath), { recursive: true });

    // Clone state so we don't mutate active memory
    const stateToSave: any = {
      ...state,
      updatedAt: Date.now(),
    };

    // If cookies exist, encrypt with Windows DPAPI before writing to disk
    if (stateToSave.cookies) {
      try {
        stateToSave.encryptedCookies = await StateJournal.dpapiEncrypt(stateToSave.cookies);
        delete stateToSave.cookies; // Keep plaintext out of the disk file
      } catch {
        // Fallback: keep in memory only, omit from file for security
        delete stateToSave.cookies;
      }
    }

    const serialized = JSON.stringify(stateToSave, null, 2);
    const tempPath = `${journalPath}.tmp`;
    await fs.writeFile(tempPath, serialized, 'utf-8');
    await fs.rename(tempPath, journalPath);
  }

  /**
   * Load download state. Decrypts DPAPI-protected cookies if present.
   * If DPAPI decryption fails (e.g. cross-machine transfer), preserves all chunk bytes and sets needsAuth = true.
   */
  public static async load(targetFilePath: string): Promise<DownloadState | null> {
    const journalPath = StateJournal.getJournalPath(targetFilePath);
    try {
      const data = await fs.readFile(journalPath, 'utf-8');
      const parsed = JSON.parse(data);

      if (parsed.encryptedCookies) {
        try {
          parsed.cookies = await StateJournal.dpapiDecrypt(parsed.encryptedCookies);
        } catch {
          // Cross-machine or profile change: retain all chunk bytes, request auth refresh
          parsed.needsAuth = true;
        }
      }

      return parsed as DownloadState;
    } catch {
      return null;
    }
  }

  public static async remove(targetFilePath: string): Promise<void> {
    const journalPath = StateJournal.getJournalPath(targetFilePath);
    try {
      await fs.unlink(journalPath);
    } catch {
      // Ignore
    }
  }

  /**
   * Encrypt plaintext string using Windows DPAPI (Current User scope)
   */
  private static dpapiEncrypt(plaintext: string): Promise<string> {
    if (process.platform !== 'win32') {
      return Promise.resolve(Buffer.from(plaintext).toString('base64'));
    }

    return new Promise((resolve, reject) => {
      const base64Input = Buffer.from(plaintext, 'utf-8').toString('base64');
      const psCommand = `powershell -NoProfile -Command "[Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Protect([Convert]::FromBase64String('${base64Input}'), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))"`;

      exec(psCommand, (err, stdout) => {
        if (err || !stdout.trim()) {
          return reject(err || new Error('DPAPI encryption failed'));
        }
        resolve(stdout.trim());
      });
    });
  }

  /**
   * Decrypt DPAPI ciphertext using Windows DPAPI (Current User scope)
   */
  private static dpapiDecrypt(ciphertext: string): Promise<string> {
    if (process.platform !== 'win32') {
      return Promise.resolve(Buffer.from(ciphertext, 'base64').toString('utf-8'));
    }

    return new Promise((resolve, reject) => {
      const psCommand = `powershell -NoProfile -Command "[System.Text.Encoding]::UTF8.GetString([System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String('${ciphertext}'), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))"`;

      exec(psCommand, (err, stdout) => {
        if (err || !stdout.trim()) {
          return reject(err || new Error('DPAPI decryption failed'));
        }
        resolve(stdout.trim());
      });
    });
  }
}
