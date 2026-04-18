# yt-dlp Download Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to download audio from YouTube/SoundCloud URLs via yt-dlp, convert to m4a, and open in the editor with pre-populated metadata.

**Architecture:** New `download-audio` IPC handler spawns yt-dlp via `child_process.spawn`, streams progress to the renderer via IPC events, copies the result to `userData/downloads/`, and hands the file path to the existing project creation flow. A `DownloadDialog` component on the open screen handles URL input and progress display.

**Tech Stack:** Electron IPC, child_process.spawn, yt-dlp + ffmpeg + ffprobe (bundled), React, Radix Dialog, Tailwind

**Spec:** `docs/superpowers/specs/2026-04-18-ytdlp-download-design.md`

---

### Task 1: Shared types and binary path exports

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/binary-path.ts`
- Test: `test/main/downloader.test.ts` (new, will grow through later tasks)

- [ ] **Step 1: Add `DownloadProgress` type**

In `src/shared/types.ts`, add after the `CutProgress` type:

```typescript
export type DownloadProgress =
  | { stage: 'downloading'; percent: number }
  | { stage: 'converting'; message: string }
  | { stage: 'complete'; path: string; name: string; metadata: { title?: string; artist?: string } }
  | { stage: 'error'; message: string };
```

- [ ] **Step 2: Add binary path exports**

In `src/main/binary-path.ts`, add the new exports. The file should become:

```typescript
import { app } from 'electron';
import path from 'node:path';

export function getBinaryPath(name: string): string {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'bin', 'darwin')
    : path.join(app.getAppPath(), 'resources', 'bin', 'darwin');
  return path.join(base, name);
}

export const M4ACUT = () => getBinaryPath('m4acut');
export const ATOMIC_PARSLEY = () => getBinaryPath('AtomicParsley');
export const YTDLP = () => getBinaryPath('yt-dlp');
export const FFMPEG_DIR = () => path.dirname(getBinaryPath('ffmpeg'));
```

- [ ] **Step 3: Verify the project compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts src/main/binary-path.ts
git commit -m "feat: add DownloadProgress type and yt-dlp/ffmpeg binary path exports"
```

---

### Task 2: Download logic in main process

**Files:**
- Create: `src/main/downloader.ts`
- Test: `test/main/downloader.test.ts`

The download logic is extracted into its own module (not inline in ipc-handlers) to keep the IPC handler thin and the download logic testable. This module exports pure/testable helpers and the main `downloadAudio` function.

- [ ] **Step 1: Write tests for `validateUrl` and `parseYtdlpOutput`**

Create `test/main/downloader.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => '/mock' },
}));

import { validateUrl, parseYtdlpOutput, parseDownloadPercent } from '../../src/main/downloader';

describe('validateUrl', () => {
  it('accepts https youtube URL', () => {
    expect(validateUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
  });

  it('accepts https soundcloud URL', () => {
    expect(validateUrl('https://soundcloud.com/artist/track')).toBe(true);
  });

  it('accepts http URL', () => {
    expect(validateUrl('http://youtube.com/watch?v=abc')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateUrl('')).toBe(false);
  });

  it('rejects non-URL text', () => {
    expect(validateUrl('not a url')).toBe(false);
  });

  it('rejects ftp URL', () => {
    expect(validateUrl('ftp://example.com/file.m4a')).toBe(false);
  });
});

describe('parseYtdlpOutput', () => {
  it('parses three-line output from --print after_move:filepath,title,uploader', () => {
    const stdout = '/tmp/mixcut-dl-abc123/My Song.m4a\nMy Song\nSome Artist\n';
    const result = parseYtdlpOutput(stdout);
    expect(result).toEqual({
      filepath: '/tmp/mixcut-dl-abc123/My Song.m4a',
      title: 'My Song',
      uploader: 'Some Artist',
    });
  });

  it('handles missing uploader (empty line)', () => {
    const stdout = '/tmp/song.m4a\nSong Title\n\n';
    const result = parseYtdlpOutput(stdout);
    expect(result).toEqual({
      filepath: '/tmp/song.m4a',
      title: 'Song Title',
      uploader: '',
    });
  });

  it('returns null for malformed output', () => {
    const result = parseYtdlpOutput('only one line\n');
    expect(result).toBeNull();
  });

  it('returns null for empty output', () => {
    const result = parseYtdlpOutput('');
    expect(result).toBeNull();
  });
});

describe('parseDownloadPercent', () => {
  it('parses standard download progress line', () => {
    expect(parseDownloadPercent('[download]  45.2% of 10.00MiB')).toBe(45.2);
  });

  it('parses 100% line', () => {
    expect(parseDownloadPercent('[download] 100% of 10.00MiB')).toBe(100);
  });

  it('returns null for non-progress line', () => {
    expect(parseDownloadPercent('[ExtractAudio] Converting...')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseDownloadPercent('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run test/main/downloader.test.ts`
Expected: FAIL — module `../../src/main/downloader` does not exist

- [ ] **Step 3: Implement the helper functions**

Create `src/main/downloader.ts`:

```typescript
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

export function cancelActiveDownload(): void {
  if (!activeDownload) return;
  activeDownload.process.kill('SIGTERM');
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
    sendProgress(window, { stage: 'error', message: err.message ?? 'Download failed' });
    throw err;
  } finally {
    activeDownload = null;
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run test/main/downloader.test.ts`
Expected: All 10 tests PASS

- [ ] **Step 5: Verify the project compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/main/downloader.ts test/main/downloader.test.ts
git commit -m "feat: add downloader module with URL validation, output parsing, and download logic"
```

---

### Task 3: Wire IPC handlers

**Files:**
- Modify: `src/main/ipc-handlers.ts`

- [ ] **Step 1: Add download IPC handlers**

In `src/main/ipc-handlers.ts`, add the imports at the top:

```typescript
import { downloadAudio, cancelActiveDownload } from './downloader';
```

Then add these handlers inside `registerIpcHandlers()`, after the existing `cut-tracks` handler:

```typescript
  // Download
  ipcMain.handle('download-audio', async (event, url: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error('No window found');
    return downloadAudio(window, url);
  });

  ipcMain.on('cancel-download', () => {
    cancelActiveDownload();
  });
```

- [ ] **Step 2: Verify the project compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc-handlers.ts
git commit -m "feat: register download-audio and cancel-download IPC handlers"
```

---

### Task 4: Preload bridge

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add download methods to the preload API**

In `src/preload/index.ts`, add the `DownloadProgress` import:

```typescript
import type {
  CutProgress,
  DownloadProgress,
  Preferences,
  ProjectState,
  ProjectSummary,
} from '../shared/types';
```

Then add these methods to the `api` object, after the `onCutProgress` method:

```typescript
  // Download
  downloadAudio: (url: string): Promise<{ path: string; name: string; metadata: { title?: string; artist?: string } }> =>
    ipcRenderer.invoke('download-audio', url),
  onDownloadProgress: (callback: (progress: DownloadProgress) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) =>
      callback(progress);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },
  cancelDownload: (): void =>
    ipcRenderer.send('cancel-download'),
```

- [ ] **Step 2: Verify the project compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat: expose downloadAudio, onDownloadProgress, cancelDownload in preload bridge"
```

---

### Task 5: Download progress hook

**Files:**
- Create: `src/renderer/hooks/use-download-progress.ts`

- [ ] **Step 1: Create the hook**

Create `src/renderer/hooks/use-download-progress.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { mixcut } from '../lib/mixcut-api';
import type { DownloadProgress } from '../../shared/types';

export function useDownloadProgress() {
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  useEffect(() => {
    const unsubscribe = mixcut.onDownloadProgress(setProgress);
    return unsubscribe;
  }, []);

  const reset = useCallback(() => setProgress(null), []);

  return { progress, reset };
}
```

- [ ] **Step 2: Verify the project compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/use-download-progress.ts
git commit -m "feat: add useDownloadProgress hook"
```

---

### Task 6: Extend `useProject` to accept initial metadata

**Files:**
- Modify: `src/renderer/hooks/use-project.ts`

- [ ] **Step 1: Add optional `initialMetadata` parameter to `createProject`**

In `src/renderer/hooks/use-project.ts`, change the `createProject` callback:

Replace:
```typescript
  const createProject = useCallback(async (audioPath: string, audioName: string) => {
    const prefs = await mixcut.getPreferences();
    const baseName = audioName.replace(/\.m4a$/i, '');
    const newProject: ProjectState = {
      id: crypto.randomUUID(),
      name: baseName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      audioPath,
      outputDir: `${prefs.defaultOutputDir}/${slugify(baseName)}`,
      metadata: { title: baseName, performer: '' },
      tracks: [],
    };
    await mixcut.saveProject(newProject);
    setProject(newProject);
  }, []);
```

With:
```typescript
  const createProject = useCallback(async (
    audioPath: string,
    audioName: string,
    initialMetadata?: { title?: string; artist?: string },
  ) => {
    const prefs = await mixcut.getPreferences();
    const baseName = audioName.replace(/\.m4a$/i, '');
    const newProject: ProjectState = {
      id: crypto.randomUUID(),
      name: baseName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      audioPath,
      outputDir: `${prefs.defaultOutputDir}/${slugify(baseName)}`,
      metadata: {
        title: initialMetadata?.title ?? baseName,
        performer: initialMetadata?.artist ?? '',
      },
      tracks: [],
    };
    await mixcut.saveProject(newProject);
    setProject(newProject);
  }, []);
```

- [ ] **Step 2: Verify the project compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/use-project.ts
git commit -m "feat: accept optional initialMetadata in createProject"
```

---

### Task 7: Update App.tsx to pass metadata through

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/open-audio.tsx` (props only)

- [ ] **Step 1: Update `OpenAudioProps` and `handleAudioSelected`**

In `src/renderer/App.tsx`, change the `handleAudioSelected` callback:

Replace:
```typescript
  const handleAudioSelected = useCallback(
    async (path: string, name: string) => {
      await createProject(path, name);
      setStep('edit');
    },
    [createProject],
  );
```

With:
```typescript
  const handleAudioSelected = useCallback(
    async (path: string, name: string, metadata?: { title?: string; artist?: string }) => {
      await createProject(path, name, metadata);
      setStep('edit');
    },
    [createProject],
  );
```

In `src/renderer/components/open-audio.tsx`, update the `OpenAudioProps` interface:

Replace:
```typescript
interface OpenAudioProps {
  onAudioSelected: (path: string, name: string) => void;
  onProjectSelected: (id: string) => void;
}
```

With:
```typescript
interface OpenAudioProps {
  onAudioSelected: (path: string, name: string, metadata?: { title?: string; artist?: string }) => void;
  onProjectSelected: (id: string) => void;
}
```

- [ ] **Step 2: Verify the project compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx src/renderer/components/open-audio.tsx
git commit -m "feat: thread optional metadata through onAudioSelected"
```

---

### Task 8: DownloadDialog component

**Files:**
- Create: `src/renderer/components/download-dialog.tsx`

- [ ] **Step 1: Create the DownloadDialog component**

Create `src/renderer/components/download-dialog.tsx`:

```tsx
import { useCallback, useRef, useState } from 'react';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { useDownloadProgress } from '../hooks/use-download-progress';
import { mixcut } from '../lib/mixcut-api';

interface DownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (path: string, name: string, metadata: { title?: string; artist?: string }) => void;
}

export function DownloadDialog({ open, onOpenChange, onComplete }: DownloadDialogProps) {
  const [url, setUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { progress, reset: resetProgress } = useDownloadProgress();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDownload = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setError(null);
    setIsDownloading(true);
    resetProgress();

    try {
      const result = await mixcut.downloadAudio(trimmed);
      onComplete(result.path, result.name, result.metadata);
      // Reset state for next use
      setUrl('');
      setIsDownloading(false);
      resetProgress();
    } catch (err: any) {
      setError(err?.message ?? 'Download failed');
      setIsDownloading(false);
    }
  }, [url, onComplete, resetProgress]);

  const handleCancel = useCallback(() => {
    mixcut.cancelDownload();
    setIsDownloading(false);
    resetProgress();
    setError(null);
  }, [resetProgress]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isDownloading) {
        handleCancel();
      }
      if (!nextOpen) {
        setUrl('');
        setError(null);
        resetProgress();
        setIsDownloading(false);
      }
      onOpenChange(nextOpen);
    },
    [isDownloading, handleCancel, onOpenChange, resetProgress],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isDownloading && url.trim()) {
        handleDownload();
      }
    },
    [handleDownload, isDownloading, url],
  );

  const progressPercent =
    progress?.stage === 'downloading' ? progress.percent : null;
  const isConverting = progress?.stage === 'converting';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Download from URL</DialogTitle>
          <DialogDescription>
            Paste a YouTube or SoundCloud link
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-4">
          {/* URL input */}
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://..."
            disabled={isDownloading}
            autoFocus
            className="w-full rounded-lg border border-border bg-surface-light px-3 py-2 font-mono text-xs text-text
              placeholder:text-text-faint focus:border-accent/40 focus:outline-none
              disabled:opacity-50"
          />

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-400" strokeWidth={1.5} />
              <span className="font-mono text-[11px] text-red-400">{error}</span>
            </div>
          )}

          {/* Progress */}
          {isDownloading && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin text-accent" />
                <span className="font-mono text-[11px] text-text-muted">
                  {isConverting
                    ? 'Converting to m4a...'
                    : progressPercent !== null
                      ? `Downloading... ${progressPercent.toFixed(1)}%`
                      : 'Starting download...'}
                </span>
              </div>
              {progressPercent !== null && (
                <div className="h-[3px] w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {isDownloading ? (
              <Button variant="default" onClick={handleCancel}>
                Cancel
              </Button>
            ) : (
              <Button
                variant="accent"
                onClick={handleDownload}
                disabled={!url.trim()}
              >
                <Download className="size-3.5" strokeWidth={1.5} />
                Download
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify the project compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/download-dialog.tsx
git commit -m "feat: add DownloadDialog component with progress and cancel support"
```

---

### Task 9: Add download button to OpenAudio

**Files:**
- Modify: `src/renderer/components/open-audio.tsx`

- [ ] **Step 1: Add the download button and wire the dialog**

In `src/renderer/components/open-audio.tsx`, add imports at the top:

```typescript
import { Download } from 'lucide-react';
import { DownloadDialog } from './download-dialog';
```

Add state for the dialog inside the `OpenAudio` component, after the existing `isDragOver` state:

```typescript
const [downloadOpen, setDownloadOpen] = useState(false);

const handleDownloadComplete = useCallback(
  (path: string, name: string, metadata: { title?: string; artist?: string }) => {
    setDownloadOpen(false);
    onAudioSelected(path, name, metadata);
  },
  [onAudioSelected],
);
```

Then add the download button and dialog in the JSX, right after the closing `</div>` of the drop zone's `relative` wrapper (after line 148 `<BorderBeam ... />`'s parent `</div>`). Add this before the `{/* Recent projects */}` comment:

```tsx
        {/* Download from URL */}
        <Button
          variant="ghost"
          onClick={() => setDownloadOpen(true)}
          className="mt-3 w-full gap-2"
        >
          <Download className="size-3.5" strokeWidth={1.5} />
          Download from URL
        </Button>

        <DownloadDialog
          open={downloadOpen}
          onOpenChange={setDownloadOpen}
          onComplete={handleDownloadComplete}
        />
```

- [ ] **Step 2: Verify the project compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run the app and test manually**

Run: `pnpm start`

Verify:
1. The "Download from URL" button appears below the file picker on the open screen
2. Clicking it opens the download dialog
3. The dialog has a URL input, Download button, and close button
4. Closing the dialog works

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/open-audio.tsx
git commit -m "feat: add Download from URL button to open screen"
```

---

### Task 10: Obtain and bundle binaries

**Files:**
- Add: `resources/bin/darwin/yt-dlp`
- Add: `resources/bin/darwin/ffmpeg`
- Add: `resources/bin/darwin/ffprobe`

- [ ] **Step 1: Download yt-dlp binary**

```bash
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos -o resources/bin/darwin/yt-dlp
chmod +x resources/bin/darwin/yt-dlp
```

Verify: `resources/bin/darwin/yt-dlp --version` prints a version string.

- [ ] **Step 2: Download ffmpeg and ffprobe**

Download a static build of ffmpeg and ffprobe for macOS (arm64 or universal). One source is https://evermeet.cx/ffmpeg/ or use Homebrew to locate them:

```bash
# Option A: Copy from Homebrew (if installed)
cp $(which ffmpeg) resources/bin/darwin/ffmpeg
cp $(which ffprobe) resources/bin/darwin/ffprobe

# Option B: Download static builds
# curl -L <url> -o resources/bin/darwin/ffmpeg
# curl -L <url> -o resources/bin/darwin/ffprobe
```

Verify both are executable:
```bash
resources/bin/darwin/ffmpeg -version
resources/bin/darwin/ffprobe -version
```

- [ ] **Step 3: Add binaries to .gitignore (or LFS)**

The binaries are large (~100MB total). Either:
- Add them to `.gitignore` and distribute separately, or
- Track with Git LFS, or
- Commit them directly if repo size isn't a concern

This is a project-level decision. At minimum, verify they work with `pnpm start` and the download flow.

- [ ] **Step 4: Test end-to-end**

Run: `pnpm start`

1. Click "Download from URL"
2. Paste a YouTube URL (e.g., a short public domain clip)
3. Click Download
4. Verify: progress bar shows download percentage
5. Verify: "Converting to m4a..." appears during conversion
6. Verify: dialog closes and the editor opens with the downloaded audio
7. Verify: project metadata (title, performer) is pre-populated from the video
8. Verify: the audio file exists in `~/Library/Application Support/mixcut-electron/downloads/`

- [ ] **Step 5: Test cancellation**

1. Start a download of a longer video
2. Click Cancel during download
3. Verify: download stops, dialog returns to input state
4. Verify: temp directory is cleaned up

- [ ] **Step 6: Test error handling**

1. Enter an invalid URL (e.g., `https://notarealsite.example/video`)
2. Click Download
3. Verify: error message appears in dialog
4. Verify: user can edit the URL and retry

- [ ] **Step 7: Commit**

```bash
git add resources/bin/darwin/yt-dlp resources/bin/darwin/ffmpeg resources/bin/darwin/ffprobe
git commit -m "chore: bundle yt-dlp, ffmpeg, and ffprobe binaries"
```

Note: Skip this commit if the binaries are gitignored. In that case, document the binary acquisition steps in a README or setup script.

---

### Task 11: Run full test suite

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `pnpm exec vitest run`
Expected: All tests pass, including new `test/main/downloader.test.ts`

- [ ] **Step 2: Run linter**

Run: `pnpm lint`
Expected: No errors

- [ ] **Step 3: Verify app starts cleanly**

Run: `pnpm start`
Expected: App launches without console errors
