import { spawn, type ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { app, BrowserWindow } from 'electron';
import { YTDLP, FFMPEG_DIR } from './binary-path';
import type { DownloadProgress } from '../shared/types';

// --- Pure helpers (exported for testing) ---

export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseYtdlpOutput(
  stdout: string,
): { filepath: string; title: string; uploader: string } | null {
  const lines = stdout.trimEnd().split('\n');
  if (lines.length < 2) return null;
  const filepath = lines[0];
  const title = lines[1];
  const uploader = lines[2] ?? '';
  if (!filepath || !title) return null;
  return { filepath, title, uploader };
}

export function parseDownloadPercent(line: string): number | null {
  const match = line.match(/\[download\]\s+([\d.]+)%/);
  if (!match) return null;
  return parseFloat(match[1]);
}

// --- Download state ---

let activeDownload: { process: ChildProcess; tempDir: string } | null = null;
let cancelled = false;

export function cancelActiveDownload(): void {
  if (!activeDownload) return;
  cancelled = true;
  const { process: child, tempDir } = activeDownload;
  activeDownload = null;
  child.kill('SIGTERM');
  fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
}

// --- Main download function ---

export interface DownloadResult {
  path: string;
  name: string;
  metadata: { title?: string; artist?: string };
}

function sendProgress(window: BrowserWindow, progress: DownloadProgress) {
  window.webContents.send('download-progress', progress);
}

function getDownloadsDir(): string {
  return path.join(app.getPath('userData'), 'downloads');
}

export async function downloadAudio(
  window: BrowserWindow,
  url: string,
): Promise<DownloadResult> {
  if (!validateUrl(url)) {
    throw new Error('Invalid URL. Please enter a valid HTTP or HTTPS link.');
  }

  if (activeDownload) {
    throw new Error('A download is already in progress.');
  }

  cancelled = false;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mixcut-dl-'));

  try {
    const args = [
      '--extract-audio',
      '--audio-format', 'm4a',
      '--no-playlist',
      '--ffmpeg-location', FFMPEG_DIR(),
      '--print', 'after_move:filepath',
      '--print', 'after_move:title',
      '--print', 'after_move:uploader',
      '-o', path.join(tempDir, '%(title)s.%(ext)s'),
      url,
    ];

    const result = await new Promise<DownloadResult>((resolve, reject) => {
      const child = spawn(YTDLP(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
      activeDownload = { process: child, tempDir };

      let stdoutData = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutData += chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        for (const line of text.split('\n')) {
          const percent = parseDownloadPercent(line);
          if (percent !== null) {
            sendProgress(window, { stage: 'downloading', percent });
          } else if (line.includes('[ExtractAudio]') || line.includes('[Postprocessor]')) {
            sendProgress(window, { stage: 'converting', message: 'Converting to m4a...' });
          }
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to start yt-dlp: ${err.message}`));
      });

      child.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp exited with code ${code}`));
          return;
        }

        const parsed = parseYtdlpOutput(stdoutData);
        if (!parsed) {
          reject(new Error('Failed to parse yt-dlp output'));
          return;
        }

        try {
          // Copy to durable location
          const downloadsDir = getDownloadsDir();
          await fs.mkdir(downloadsDir, { recursive: true });
          const destName = path.basename(parsed.filepath);
          const destPath = path.join(downloadsDir, destName);
          await fs.copyFile(parsed.filepath, destPath);

          const downloadResult: DownloadResult = {
            path: destPath,
            name: destName,
            metadata: {
              title: parsed.title || undefined,
              artist: parsed.uploader || undefined,
            },
          };

          sendProgress(window, {
            stage: 'complete',
            path: downloadResult.path,
            name: downloadResult.name,
            metadata: downloadResult.metadata,
          });

          resolve(downloadResult);
        } catch (err: any) {
          reject(new Error(`Failed to copy downloaded file: ${err.message}`));
        }
      });
    });

    return result;
  } catch (err: any) {
    if (!cancelled) {
      sendProgress(window, { stage: 'error', message: err.message ?? 'Download failed' });
    }
    throw err;
  } finally {
    activeDownload = null;
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
