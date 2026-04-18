# yt-dlp Download Feature

## Summary

Add the ability to download audio from YouTube and SoundCloud URLs using yt-dlp. The downloaded audio is converted to `.m4a` and opened in the editor exactly as if the user picked a local file. Metadata (title, artist) from the source is pre-populated in the project.

## Scope

- Single track downloads only (playlists explicitly disabled via `--no-playlist`)
- YouTube and SoundCloud URLs (yt-dlp supports both natively)
- Downloads best available audio, converts to m4a via bundled ffmpeg
- No thumbnail extraction

## Architecture

### Binary Bundling

`yt-dlp`, `ffmpeg`, and `ffprobe` are placed in `resources/bin/darwin/` alongside existing `m4acut` and `AtomicParsley` binaries. yt-dlp requires both `ffmpeg` and `ffprobe` for `--extract-audio` to work — `ffprobe` is used to analyze streams before conversion. They are resolved at runtime via `getBinaryPath()` in `src/main/binary-path.ts`. The Forge config already bundles `resources/bin` as an extra resource — no config change needed.

New exports in `binary-path.ts`:

```typescript
export const YTDLP = () => getBinaryPath('yt-dlp');
export const FFMPEG = () => getBinaryPath('ffmpeg');
export const FFMPEG_DIR = () => path.dirname(getBinaryPath('ffmpeg'));
```

`--ffmpeg-location` is passed the directory (`FFMPEG_DIR()`), not the binary path. yt-dlp expects both `ffmpeg` and `ffprobe` to be colocated in this directory.

### Shared Types

New type in `src/shared/types.ts`:

```typescript
export type DownloadProgress =
  | { stage: 'downloading'; percent: number }
  | { stage: 'converting'; message: string }
  | { stage: 'complete'; path: string; name: string; metadata: { title?: string; artist?: string } }
  | { stage: 'error'; message: string };
```

### Main Process

New IPC handler `download-audio` in `src/main/ipc-handlers.ts`.

The handler:

1. Validates the URL is a plausible HTTP(S) URL before spawning yt-dlp (rejects empty strings, non-URL input). This provides instant feedback instead of waiting for yt-dlp to time out on garbage input.
2. Creates a temp directory (`os.tmpdir()/mixcut-dl-XXXXXX`)
3. Spawns `yt-dlp` via `child_process.spawn` (not `execFile`) to enable streaming stderr for progress
4. Flags: `--extract-audio --audio-format m4a --no-playlist --ffmpeg-location <FFMPEG_DIR()> --print after_move:filepath,title,uploader -o <tempdir>/%(title)s.%(ext)s <url>`
5. Parses yt-dlp's stderr output for `[download] XX.X%` lines to extract download percentage
6. Detects conversion phase from `[ExtractAudio]` or `[Postprocessor]` lines in stderr
7. Gets the `BrowserWindow` from `event.sender` via `BrowserWindow.fromWebContents(event.sender)` (same pattern as `cut-tracks`)
8. Sends `DownloadProgress` events to the renderer via `window.webContents.send('download-progress', progress)`
9. On **process exit** (not on stdout data arrival), parses the `--print` output from stdout. The `--print after_move:filepath,title,uploader` flag outputs three newline-separated values: the final `.m4a` file path, the title, and the uploader. These are only valid to read after process exit with code 0.
10. Copies the downloaded `.m4a` from the temp directory into the app's `userData` directory (`app.getPath('userData')/downloads/`) so it persists across sessions and isn't subject to macOS `/tmp/` cleanup. The project's `audioPath` points to this durable location.
11. Cleans up the temp directory after copying (both on success and error)
12. Returns `{ path, name, metadata: { title, artist } }` on success

**Output template filename sanitization:** yt-dlp sanitizes `%(title)s` by default (replacing `/`, `:`, `"`, etc. with `_` and truncating to filesystem limits). The sanitized filename may differ from the `title` in the `--print` output. The handler uses the file path from `--print after_move:filepath` as the source of truth for the file location, not a reconstructed path from the title.

**Child process lifecycle:** A module-level `activeDownload: { process: ChildProcess; tempDir: string } | null` variable tracks the current download. Guards:
- `download-audio` rejects with an error if `activeDownload` is already set (no concurrent downloads)
- `cancel-download` is a no-op if `activeDownload` is null
- `activeDownload` is set to null in a `finally` block after the process exits (regardless of success/error/cancel)
- On cancel: sends SIGTERM to the process, cleans up temp dir, resets `activeDownload`

### Preload Bridge

New methods added to the `api` object in `src/preload/index.ts`:

```typescript
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

### Renderer

#### New hook: `src/renderer/hooks/use-download-progress.ts`

Mirrors `useCutProgress` — listens to `download-progress` IPC events, exposes the latest `DownloadProgress` state. Resets to `null` when a new download starts.

#### New component: `src/renderer/components/download-dialog.tsx`

A Radix Dialog containing:

- A text input for the URL
- A "Download" button
- Progress display (percentage bar during download, spinner during conversion)
- Cancel button (calls `mixcut.cancelDownload()`)
- Error display with retry option

On successful download, calls `onComplete(path, name, metadata)` and closes.

#### Modified component: `src/renderer/components/open-audio.tsx`

Add a "Download from URL" button below the existing drop zone button. Clicking it opens the `DownloadDialog`. On completion, calls `onAudioSelected(path, name)` and passes metadata up.

#### Modified component: `src/renderer/App.tsx`

Extend `handleAudioSelected` to accept optional metadata parameter. Pass it through to `createProject` so the project is initialized with title and artist from the download.

#### Modified hook: `src/renderer/hooks/use-project.ts`

Extend `createProject` to accept an optional `initialMetadata: { title?: string; artist?: string }` parameter. When provided, the new project's `metadata.title` and `metadata.performer` are pre-filled.

## Data Flow

```
User clicks "Download from URL" on OpenAudio screen
  → DownloadDialog opens
  → User pastes URL, clicks Download
  → URL validated (must be http/https)
  → IPC invoke 'download-audio' with URL
  → Main process sets activeDownload, spawns yt-dlp
  → yt-dlp stderr parsed → IPC 'download-progress' events → useDownloadProgress → dialog UI
  → yt-dlp process exits with code 0
  → stdout parsed for filepath, title, uploader (from --print after_move:...)
  → .m4a copied from temp dir to userData/downloads/
  → temp dir cleaned up, activeDownload reset to null
  → IPC returns { path, name, metadata }
  → DownloadDialog calls onComplete
  → OpenAudio calls onAudioSelected(path, name) with metadata
  → App.tsx creates project with pre-filled metadata
  → Step transitions to 'edit', user sees the editor
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid/unsupported URL | yt-dlp exits non-zero; stderr message shown in dialog |
| Network failure mid-download | yt-dlp exits non-zero; error shown, retry available |
| User cancels (closes dialog or clicks Cancel) | Spawned yt-dlp process is killed (SIGTERM), temp dir cleaned up |
| ffmpeg conversion failure | yt-dlp exits non-zero with postprocessor error; shown in dialog |
| yt-dlp binary missing/corrupt | `spawn` throws; caught and shown as error |

## Files Changed

| File | Change |
|------|--------|
| `resources/bin/darwin/yt-dlp` | New binary (~22MB) |
| `resources/bin/darwin/ffmpeg` | New binary (~70-90MB) |
| `resources/bin/darwin/ffprobe` | New binary (required by yt-dlp for audio extraction) |
| `src/main/binary-path.ts` | Add `YTDLP` and `FFMPEG` exports |
| `src/shared/types.ts` | Add `DownloadProgress` type |
| `src/main/ipc-handlers.ts` | Add `download-audio` handler and `cancel-download` listener |
| `src/preload/index.ts` | Add `downloadAudio`, `onDownloadProgress`, `cancelDownload` |
| `src/renderer/hooks/use-download-progress.ts` | New hook |
| `src/renderer/components/download-dialog.tsx` | New component |
| `src/renderer/components/open-audio.tsx` | Add download button, wire dialog |
| `src/renderer/App.tsx` | Accept optional metadata in `handleAudioSelected` |
| `src/renderer/hooks/use-project.ts` | Accept optional initial metadata in `createProject` |
| `src/renderer/lib/mixcut-api.ts` | Add download methods to typed API |

## Out of Scope

- Playlist/album support (design accommodates future addition)
- Thumbnail extraction
- Windows/Linux binaries (macOS only, matching current app)
- yt-dlp auto-updates
- Download queue / multiple concurrent downloads
