# mixcut Electron Port — Design Spec

## Overview

Port mixcut from a cloud-based web app (AWS Lambda, S3, SQS, Supabase, Next.js) to a local-only macOS Electron desktop app. All processing happens on the user's machine — no cloud dependencies.

The original repository at `/Users/g30r93g/Projects/mixcut` is preserved as-is (AWS portfolio piece). This is a separate, standalone repo.

## Architecture

**Stack:** Electron Forge + React (Vite) + TypeScript

```
┌─────────────────────────────────────────────────┐
│  Electron Main Process                          │
│                                                 │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐ │
│  │ IPC      │  │ Processor │  │ Project      │ │
│  │ Handlers │  │ (m4acut + │  │ Store        │ │
│  │          │  │  AP)      │  │ (JSON files) │ │
│  └────┬─────┘  └───────────┘  └──────────────┘ │
│       │                                         │
├───────┼─────────────────────────────────────────┤
│       │  IPC Bridge (contextBridge/preload)      │
├───────┼─────────────────────────────────────────┤
│       │                                         │
│  ┌────▼─────────────────────────────────────┐   │
│  │  Renderer (React + Vite)                 │   │
│  │                                          │   │
│  │  ┌────────────┐  ┌───────────────────┐   │   │
│  │  │ Waveform   │  │ Tracklist Editor  │   │   │
│  │  │ (WaveSurfer│  │ + CUE Import      │   │   │
│  │  └────────────┘  └───────────────────┘   │   │
│  │  ┌────────────┐  ┌───────────────────┐   │   │
│  │  │ Metadata   │  │ Processing Status │   │   │
│  │  │ Editor     │  │ + Output          │   │   │
│  │  └────────────┘  └───────────────────┘   │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  Renderer Process                               │
└─────────────────────────────────────────────────┘
```

**Main process** owns all filesystem access, native binary execution, and project persistence. **Renderer** is a pure React app communicating via IPC — it never touches the filesystem directly. The preload script exposes a typed `window.mixcut` API.

## Packages Reused from Original Repo

The following are copied into this repo (not linked — fully independent):

- **parser** — CUE sheet parsing (`parseCue`) and validation (`validateCue`). Pure TypeScript, zero cloud dependencies.
- **shared** — Types (`Job`, `Track`, `JobStatus`, `CueTrack`, `ParsedCue`) and utilities (`framesToMs`, `slugify`). Pure TypeScript.
- **cue-helpers** — `buildCueFile()` from `website/src/lib/cue-helpers.ts`. Generates CUE sheet text from track data.

## Workflow

Single-window, linear 4-step workflow. One session at a time.

### Step 1 — Open Audio File

User opens a `.m4a` file via File menu, drag-and-drop, or file picker button. Main process reads the file path and sends metadata (name, size) to the renderer. A new project is created automatically.

Default output directory: `~/Music/mixcut/<album-title>/`. Displayed in the UI, changeable by the user.

### Step 2 — Edit Tracklist

Primary interaction mode. The waveform editor (WaveSurfer.js) renders the audio. Users:

- Click the waveform to place track cue points
- Edit track titles, performers inline
- Set album-level metadata (title, performer, genre, year)
- Optionally attach artwork via image file picker
- Optionally import a `.cue` file to auto-populate tracks (secondary input method)

The `parser` package runs in the renderer for CUE parsing (pure TS, no Node APIs).

### Step 3 — Process

User clicks "Cut Tracks". Renderer sends track list + metadata to main via IPC. Main process:

1. Generates a CUE file from track data (reusing `buildCueFile` logic)
2. Writes CUE to a temp directory
3. Runs `m4acut -C <cue> <audio>` via `child_process.execFile` (not `exec`, to avoid shell injection)
4. For each output track, runs `AtomicParsley` via `execFile` to embed metadata + artwork
5. Moves finished `.m4a` files to the output directory
6. Reports progress back to renderer via IPC events

### Step 4 — Done

Displays the list of output tracks with file paths. Button to open the output folder in Finder. Button to start a new session.

## IPC API

The preload script exposes `window.mixcut`:

```ts
window.mixcut = {
  // File picking
  openAudioFile(): Promise<{ path: string; name: string; size: number }>;
  openCueFile(): Promise<{ path: string; content: string }>;
  openImageFile(): Promise<{ path: string; name: string }>;

  // Audio — serve file to renderer for WaveSurfer
  getAudioUrl(filePath: string): string;
  getImageUrl(filePath: string): string;

  // Processing
  cutTracks(params: {
    audioPath: string;
    tracks: Track[];
    metadata: AlbumMetadata;
    artworkPath?: string;
    outputDir: string;
  }): Promise<void>;
  onCutProgress(callback: (progress: CutProgress) => void): () => void;

  // Output
  openInFinder(dirPath: string): void;

  // Projects
  saveProject(project: ProjectState): Promise<void>;
  loadProject(projectId: string): Promise<ProjectState>;
  listProjects(): Promise<ProjectSummary[]>;
  deleteProject(projectId: string): Promise<void>;

  // Preferences
  getPreferences(): Promise<Preferences>;
  setPreferences(prefs: Partial<Preferences>): Promise<void>;
};
```

### Progress reporting

```ts
type CutProgress =
  | { stage: 'cutting'; message: string }
  | { stage: 'tagging'; trackNumber: number; totalTracks: number }
  | { stage: 'complete'; outputDir: string }
  | { stage: 'error'; message: string };
```

## Project Persistence

Projects stored as JSON in `~/Library/Application Support/mixcut/projects/`.

```
~/Library/Application Support/mixcut/
├── projects/
│   ├── <uuid>.json
│   └── ...
└── preferences.json
```

### Project file

```ts
interface ProjectState {
  id: string;                  // UUID
  name: string;                // album title or filename
  createdAt: string;           // ISO timestamp
  updatedAt: string;
  audioPath: string;           // absolute path to source .m4a
  artworkPath?: string;        // absolute path to cover image
  outputDir: string;           // where tracks will be saved
  metadata: AlbumMetadata;     // title, performer, genre, year
  tracks: Track[];             // track markers with titles/performers/startMs
}

interface AlbumMetadata {
  title: string;
  performer: string;
  genre?: string;
  year?: string;
}

interface Preferences {
  defaultOutputDir: string;    // defaults to ~/Music/mixcut
}
```

### Behaviour

- Auto-save on meaningful changes (track added/removed, metadata edited)
- If source audio is missing on project open, prompt user to relocate it
- Recent projects list derived from the projects directory, sorted by `updatedAt`
- Opening a new audio file creates a new project automatically

## Native Binary Bundling

`m4acut` and `AtomicParsley` ship as pre-compiled macOS universal binaries inside the app bundle.

### Source repo structure

```
resources/
└── bin/
    └── darwin/
        ├── m4acut
        └── AtomicParsley
```

### Runtime resolution

```ts
function getBinaryPath(name: string): string {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'bin', 'darwin')
    : path.join(app.getAppPath(), 'resources', 'bin', 'darwin');
  return path.join(base, name);
}
```

Electron Forge copies `resources/bin/` into the app bundle via the `extraResource` config option.

## CI/CD & Distribution

macOS only. GitHub Actions on a macOS runner.

### Build pipeline

1. Compile `m4acut` + `AtomicParsley` as macOS universal binaries (cached — only rebuilt when source/version changes)
2. Install dependencies (`pnpm install`)
3. Build renderer (`vite build`)
4. Package with Electron Forge (`make` → `.dmg`)
5. Upload `.dmg` as GitHub Release artifact

### Triggers

- Push to `main` → CI builds and runs tests
- Tag `v*` → CI builds, creates GitHub Release with `.dmg` attached

### Code signing

Not in scope (no Apple Developer account). The app runs unsigned.

### DMG installer

The `.dmg` includes a background image with instructions:

1. "Drag mixcut to Applications" — with visual arrow between app icon and Applications folder alias
2. "Then run in Terminal: `xattr -cr /Applications/mixcut.app`" — to clear the quarantine flag for unsigned apps

Configured via `@electron-forge/maker-dmg` `background` and `contents` options.

### Auto-updates

Not in initial scope. Users download new releases from GitHub. Can add `electron-updater` later.

## UI

The UI will be designed using the `frontend-design` skill during implementation to create a Paper-style interface. The existing website components (waveform editor, tracklist editor, metadata editor, CUE import) serve as structural reference for what functionality is needed, but the visual design will be new.

### Key UI components (functional reference from original repo)

- **Waveform player** — WaveSurfer.js, click-to-mark, zoom, playback controls
- **Tracklist editor** — inline editing of track title/performer, add/remove tracks, reorder
- **Metadata editor** — album title, performer, genre, year
- **CUE import** — drag-and-drop `.cue` file to auto-populate tracks
- **Artwork picker** — image file selector, preview
- **Processing status** — per-track progress indicators
- **Output view** — track list with file paths, open-in-Finder button

## Platform

- macOS only (arm64 + x86_64 via universal binaries)
- Electron (Chromium renderer)
- No Windows/Linux support planned
