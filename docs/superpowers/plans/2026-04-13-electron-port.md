# mixcut Electron Port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS Electron desktop app that splits .m4a audio files into individual tracks using CUE sheets, with all processing happening locally (no cloud dependencies).

**Architecture:** Electron Forge + React (Vite renderer) + TypeScript. Main process handles filesystem, native binary execution (m4acut, AtomicParsley), and JSON-based project persistence. Renderer is a pure React app communicating via typed IPC. Parser and shared utility packages are ported from the original mixcut repo.

**Tech Stack:** Electron 36+, Electron Forge, React 19, Vite, TypeScript, WaveSurfer.js 7, Vitest, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-13-electron-port-design.md`

---

## File Structure

```
mixcut-electron/
├── forge.config.ts                    # Electron Forge config (Vite plugin, DMG maker, extraResources)
├── package.json                       # Root package.json with all deps
├── tsconfig.json                      # Root TS config
├── vite.main.config.ts                # Vite config for main process
├── vite.preload.config.ts             # Vite config for preload script
├── vite.renderer.config.ts            # Vite config for renderer
├── resources/
│   └── bin/
│       └── darwin/
│           ├── m4acut                 # Pre-compiled macOS binary
│           └── AtomicParsley          # Pre-compiled macOS binary
├── src/
│   ├── main/
│   │   ├── index.ts                   # Electron entry: BrowserWindow, menu, protocol, IPC registration
│   │   ├── ipc-handlers.ts            # All IPC handler registrations
│   │   ├── processor.ts               # m4acut + AtomicParsley execution logic
│   │   ├── project-store.ts           # JSON project CRUD (~/Library/Application Support/mixcut/)
│   │   ├── preferences.ts             # Preferences read/write
│   │   └── binary-path.ts             # Resolve bundled binary paths
│   ├── preload/
│   │   └── index.ts                   # contextBridge exposing window.mixcut API
│   ├── renderer/
│   │   ├── index.html                 # HTML entry point
│   │   ├── index.tsx                  # React root
│   │   ├── App.tsx                    # Main app component with step navigation
│   │   ├── global.css                 # Tailwind imports
│   │   ├── components/               # UI components (built via frontend-design skill)
│   │   │   ├── open-audio.tsx         # Step 1: file picker + drag-drop
│   │   │   ├── track-workspace.tsx    # Step 2: waveform + tracklist + metadata
│   │   │   ├── track-waveform.tsx     # WaveSurfer.js waveform component
│   │   │   ├── tracklist-editor.tsx   # Track list with inline editing
│   │   │   ├── metadata-editor.tsx    # Album metadata form
│   │   │   ├── processing-view.tsx    # Step 3: progress display
│   │   │   └── output-view.tsx        # Step 4: results + open-in-Finder
│   │   ├── hooks/
│   │   │   ├── use-cut-progress.ts    # Subscribe to IPC cut progress events
│   │   │   └── use-project.ts         # Project state management
│   │   └── lib/
│   │       ├── types.ts               # Renderer-side type definitions
│   │       └── mixcut-api.ts          # Typed wrapper around window.mixcut
│   └── shared/
│       ├── types.ts                   # CueTrack, ParsedCue, AlbumMetadata, ProjectState, etc.
│       ├── parse-cue.ts               # CUE parser (ported from @mixcut/parser)
│       ├── validate-cue.ts            # CUE validator (ported from @mixcut/parser)
│       ├── cue-builder.ts             # buildCueFile (ported from website cue-helpers)
│       ├── time.ts                    # framesToMs utility
│       └── strings.ts                 # slugify utility
├── test/
│   ├── shared/
│   │   ├── parse-cue.test.ts
│   │   ├── validate-cue.test.ts
│   │   ├── cue-builder.test.ts
│   │   └── time.test.ts
│   └── main/
│       ├── processor.test.ts
│       ├── project-store.test.ts
│       └── preferences.test.ts
└── .github/
    └── workflows/
        ├── ci.yml                     # Lint + test on push to main
        └── release.yml                # Build DMG + GitHub Release on v* tag
```

---

## Task 1: Scaffold Electron Forge project

**Files:**
- Create: `package.json`, `forge.config.ts`, `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`, `tsconfig.json`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/index.tsx`, `src/renderer/App.tsx`, `src/renderer/global.css`

- [ ] **Step 1: Initialize project with Electron Forge**

```bash
cd /Users/g30r93g/Projects/mixcut-electron
npx create-electron-app@latest . --template=vite-typescript
```

If the directory is non-empty, move `docs/` aside first, run the scaffold, then move `docs/` back. The template generates the full project structure including `forge.config.ts`, Vite configs, `tsconfig.json`, and starter source files.

- [ ] **Step 2: Install additional dependencies**

```bash
pnpm add react react-dom
pnpm add -D @types/react @types/react-dom @vitejs/plugin-react tailwindcss @tailwindcss/vite vitest
```

- [ ] **Step 3: Configure Vite renderer for React + Tailwind**

Update `vite.renderer.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src/renderer',
      '@shared': '/src/shared',
    },
  },
});
```

- [ ] **Step 4: Create React entry point**

Replace `src/renderer/index.html` body with:

```html
<div id="root"></div>
<script type="module" src="./index.tsx"></script>
```

Create `src/renderer/index.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Create `src/renderer/App.tsx`:

```tsx
export function App() {
  return <div className="p-8"><h1 className="text-2xl font-bold">mixcut</h1></div>;
}
```

Create `src/renderer/global.css`:

```css
@import 'tailwindcss';
```

- [ ] **Step 5: Update main process entry**

Replace `src/main/index.ts` with:

```ts
import { app, BrowserWindow } from 'electron';
import path from 'node:path';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
```

- [ ] **Step 6: Set up minimal preload**

Replace `src/preload/index.ts` with:

```ts
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('mixcut', {
  ping: () => 'pong',
});
```

- [ ] **Step 7: Run the app to verify**

```bash
pnpm start
```

Expected: Electron window opens showing "mixcut" heading with Tailwind styling applied.

- [ ] **Step 8: Configure Vitest**

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@shared': '/src/shared',
    },
  },
});
```

- [ ] **Step 9: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Electron Forge project with React, Vite, Tailwind, Vitest"
```

---

## Task 2: Port shared utilities and parser

**Files:**
- Create: `src/shared/types.ts`, `src/shared/time.ts`, `src/shared/strings.ts`, `src/shared/parse-cue.ts`, `src/shared/validate-cue.ts`, `src/shared/cue-builder.ts`
- Create: `test/shared/time.test.ts`, `test/shared/parse-cue.test.ts`, `test/shared/validate-cue.test.ts`, `test/shared/cue-builder.test.ts`

- [ ] **Step 1: Create shared types**

Create `src/shared/types.ts`:

```ts
export interface CueTrack {
  trackNumber: number;
  title: string;
  performer?: string;
  startMs: number;
}

export interface ParsedCue {
  fileName?: string;
  title: string;
  performer: string;
  genre: string;
  releaseYear: string;
  tracks: CueTrack[];
}

export type CueValidationResult =
  | { ok: true; tracks: CueTrack[] }
  | { ok: false; error: string };

export interface AlbumMetadata {
  title: string;
  performer: string;
  genre?: string;
  year?: string;
}

export interface ProjectState {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  audioPath: string;
  artworkPath?: string;
  outputDir: string;
  metadata: AlbumMetadata;
  tracks: CueTrack[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface Preferences {
  defaultOutputDir: string;
}

export type CutProgress =
  | { stage: 'cutting'; message: string }
  | { stage: 'tagging'; trackNumber: number; totalTracks: number }
  | { stage: 'complete'; outputDir: string }
  | { stage: 'error'; message: string };
```

- [ ] **Step 2: Write failing test for framesToMs**

Create `test/shared/time.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { framesToMs } from '@shared/time';

describe('framesToMs', () => {
  it('converts 0:0:0 to 0', () => {
    expect(framesToMs(0, 0, 0)).toBe(0);
  });

  it('converts 1 minute to 60000ms', () => {
    expect(framesToMs(1, 0, 0)).toBe(60000);
  });

  it('converts frames at 75fps', () => {
    expect(framesToMs(0, 0, 75)).toBe(1000);
  });

  it('converts mixed values', () => {
    // 3:45:37 = (3*60+45)*1000 + round(37*(1000/75)) = 225000 + 493 = 225493
    expect(framesToMs(3, 45, 37)).toBe(225493);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm test -- test/shared/time.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement framesToMs**

Create `src/shared/time.ts`:

```ts
export function framesToMs(minutes: number, seconds: number, frames: number) {
  return (minutes * 60 + seconds) * 1000 + Math.round(frames * (1000 / 75));
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test -- test/shared/time.test.ts
```

Expected: PASS

- [ ] **Step 6: Create slugify**

Create `src/shared/strings.ts`:

```ts
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 7: Write failing test for parseCue**

Create `test/shared/parse-cue.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseCue } from '@shared/parse-cue';

const SAMPLE_CUE = `TITLE "Test Album"
PERFORMER "Test Artist"
REM GENRE "Electronic"
REM DATE "2024"
FILE "source.m4a" MP4
  TRACK 01 AUDIO
    TITLE "First Track"
    PERFORMER "Artist A"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "Second Track"
    INDEX 01 03:45:37`;

describe('parseCue', () => {
  it('parses album-level metadata', () => {
    const result = parseCue(SAMPLE_CUE);
    expect(result.title).toBe('Test Album');
    expect(result.performer).toBe('Test Artist');
    expect(result.genre).toBe('Electronic');
    expect(result.releaseYear).toBe('2024');
    expect(result.fileName).toBe('source.m4a');
  });

  it('parses tracks', () => {
    const result = parseCue(SAMPLE_CUE);
    expect(result.tracks).toHaveLength(2);
    expect(result.tracks[0]).toEqual({
      trackNumber: 1,
      title: 'First Track',
      performer: 'Artist A',
      startMs: 0,
    });
    expect(result.tracks[1]).toEqual({
      trackNumber: 2,
      title: 'Second Track',
      performer: undefined,
      startMs: 225493,
    });
  });

  it('handles empty input', () => {
    const result = parseCue('');
    expect(result.tracks).toHaveLength(0);
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

```bash
pnpm test -- test/shared/parse-cue.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 9: Implement parseCue**

Create `src/shared/parse-cue.ts`:

```ts
import { CueTrack, ParsedCue } from './types';
import { framesToMs } from './time';

const FILE_RE = /^FILE\s+"(.+?)"\s+(.+)$/i;
const TRACK_RE = /^TRACK\s+(\d+)\s+(\w+)/i;
const TITLE_RE = /^TITLE\s+"(.+?)"$/i;
const PERFORMER_RE = /^PERFORMER\s+"(.+?)"$/i;
const INDEX_RE = /^INDEX\s+01\s+(\d{2}):(\d{2}):(\d{2})$/i;
const REM_GENRE_RE = /^REM\s+GENRE\s+"?(.+?)"?$/i;
const REM_DATE_RE = /^REM\s+(?:DATE|YEAR)\s+"?(.+?)"?$/i;

export function parseCue(cueText: string): ParsedCue {
  const lines = cueText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let fileName: string | undefined;
  const tracks: CueTrack[] = [];

  let currentTrackNumber: number | undefined;
  let currentTitle: string | undefined;
  let currentPerformer: string | undefined;
  let currentStartMs: number | undefined;
  let overallTitle = '';
  let overallPerformer = '';
  let overallGenre = '';
  let overallReleaseYear = '';

  const flushTrack = () => {
    if (
      currentTrackNumber !== undefined &&
      currentTitle !== undefined &&
      currentStartMs !== undefined
    ) {
      tracks.push({
        trackNumber: currentTrackNumber,
        title: currentTitle,
        performer: currentPerformer,
        startMs: currentStartMs,
      });
    }
  };

  for (const raw of lines) {
    if (FILE_RE.test(raw)) {
      const m = raw.match(FILE_RE)!;
      fileName = m[1];
      continue;
    }

    if (TRACK_RE.test(raw)) {
      flushTrack();
      const m = raw.match(TRACK_RE)!;
      currentTrackNumber = parseInt(m[1], 10);
      currentTitle = undefined;
      currentPerformer = undefined;
      currentStartMs = undefined;
      continue;
    }

    if (TITLE_RE.test(raw)) {
      const m = raw.match(TITLE_RE)!;
      if (currentTrackNumber === undefined) {
        overallTitle = m[1];
      } else {
        currentTitle = m[1];
      }
      continue;
    }

    if (PERFORMER_RE.test(raw)) {
      const m = raw.match(PERFORMER_RE)!;
      if (currentTrackNumber === undefined) {
        overallPerformer = m[1];
      } else {
        currentPerformer = m[1];
      }
      continue;
    }

    if (INDEX_RE.test(raw)) {
      const m = raw.match(INDEX_RE)!;
      currentStartMs = framesToMs(
        parseInt(m[1], 10),
        parseInt(m[2], 10),
        parseInt(m[3], 10),
      );
      continue;
    }

    if (REM_GENRE_RE.test(raw)) {
      const m = raw.match(REM_GENRE_RE)!;
      overallGenre = m[1];
      continue;
    }

    if (REM_DATE_RE.test(raw)) {
      const m = raw.match(REM_DATE_RE)!;
      overallReleaseYear = m[1];
      continue;
    }
  }

  flushTrack();

  return {
    fileName,
    title: overallTitle,
    performer: overallPerformer,
    genre: overallGenre,
    releaseYear: overallReleaseYear,
    tracks,
  };
}
```

- [ ] **Step 10: Run test to verify it passes**

```bash
pnpm test -- test/shared/parse-cue.test.ts
```

Expected: PASS

- [ ] **Step 11: Write failing test for validateCue**

Create `test/shared/validate-cue.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateCue } from '@shared/validate-cue';
import type { ParsedCue } from '@shared/types';

const validParsed: ParsedCue = {
  title: 'Album',
  performer: 'Artist',
  genre: '',
  releaseYear: '',
  tracks: [
    { trackNumber: 1, title: 'Track 1', startMs: 0 },
    { trackNumber: 2, title: 'Track 2', startMs: 60000 },
  ],
};

describe('validateCue', () => {
  it('accepts valid CUE data', () => {
    const result = validateCue(validParsed);
    expect(result.ok).toBe(true);
  });

  it('rejects empty tracks', () => {
    const result = validateCue({ ...validParsed, tracks: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('No tracks');
  });

  it('rejects duplicate track numbers', () => {
    const result = validateCue({
      ...validParsed,
      tracks: [
        { trackNumber: 1, title: 'A', startMs: 0 },
        { trackNumber: 1, title: 'B', startMs: 1000 },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Duplicate');
  });

  it('rejects non-increasing start times', () => {
    const result = validateCue({
      ...validParsed,
      tracks: [
        { trackNumber: 1, title: 'A', startMs: 5000 },
        { trackNumber: 2, title: 'B', startMs: 5000 },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects tracks with empty titles', () => {
    const result = validateCue({
      ...validParsed,
      tracks: [{ trackNumber: 1, title: '', startMs: 0 }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('TITLE');
  });
});
```

- [ ] **Step 12: Run test to verify it fails**

```bash
pnpm test -- test/shared/validate-cue.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 13: Implement validateCue**

Create `src/shared/validate-cue.ts`:

```ts
import { CueTrack, CueValidationResult, ParsedCue } from './types';

export function validateCue(parsed: ParsedCue): CueValidationResult {
  const { tracks } = parsed;

  if (!tracks.length) {
    return { ok: false, error: 'No tracks found in CUE sheet' };
  }

  const normalized: CueTrack[] = [...tracks].sort((a, b) => a.startMs - b.startMs);

  const seenNumbers = new Set<number>();
  for (const t of normalized) {
    if (!Number.isFinite(t.trackNumber) || t.trackNumber <= 0) {
      return { ok: false, error: `Invalid track number: ${t.trackNumber}` };
    }
    if (!t.title || !t.title.trim()) {
      return { ok: false, error: `Track ${t.trackNumber} is missing a TITLE` };
    }
    if (!Number.isFinite(t.startMs) || t.startMs < 0) {
      return { ok: false, error: `Track ${t.trackNumber} has invalid start time` };
    }
    if (seenNumbers.has(t.trackNumber)) {
      return { ok: false, error: `Duplicate track number: ${t.trackNumber}` };
    }
    seenNumbers.add(t.trackNumber);
  }

  for (let i = 1; i < normalized.length; i++) {
    if (normalized[i].startMs <= normalized[i - 1].startMs) {
      return {
        ok: false,
        error: `Track ${normalized[i].trackNumber} starts before or at same time as previous track`,
      };
    }
  }

  return { ok: true, tracks: normalized };
}
```

- [ ] **Step 14: Run test to verify it passes**

```bash
pnpm test -- test/shared/validate-cue.test.ts
```

Expected: PASS

- [ ] **Step 15: Write failing test for cue-builder**

Create `test/shared/cue-builder.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildCueString } from '@shared/cue-builder';

describe('buildCueString', () => {
  it('generates valid CUE text from tracks', () => {
    const result = buildCueString({
      entries: [
        { trackNumber: 1, title: 'First', performer: 'A', startMs: 0 },
        { trackNumber: 2, title: 'Second', startMs: 60000 },
      ],
      overallDetails: {
        title: 'Album',
        performer: 'Artist',
        genre: 'Rock',
        releaseYear: '2024',
      },
      audioFileName: 'source.m4a',
    });

    expect(result).toContain('TITLE "Album"');
    expect(result).toContain('PERFORMER "Artist"');
    expect(result).toContain('REM GENRE "Rock"');
    expect(result).toContain('REM DATE "2024"');
    expect(result).toContain('FILE "source.m4a" MP4');
    expect(result).toContain('TRACK 01 AUDIO');
    expect(result).toContain('INDEX 01 00:00:00');
    expect(result).toContain('TRACK 02 AUDIO');
    expect(result).toContain('INDEX 01 01:00:00');
  });

  it('returns null for empty entries', () => {
    const result = buildCueString({
      entries: [],
      overallDetails: { title: '', performer: '', genre: '', releaseYear: '' },
    });
    expect(result).toBeNull();
  });

  it('escapes quotes in values', () => {
    const result = buildCueString({
      entries: [{ trackNumber: 1, title: 'Say "Hello"', startMs: 0 }],
      overallDetails: { title: '', performer: '', genre: '', releaseYear: '' },
    });
    expect(result).toContain('Say \\"Hello\\"');
  });
});
```

- [ ] **Step 16: Run test to verify it fails**

```bash
pnpm test -- test/shared/cue-builder.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 17: Implement cue-builder**

Create `src/shared/cue-builder.ts`:

```ts
import type { CueTrack } from './types';

export interface OverallDetails {
  title: string;
  performer: string;
  genre: string;
  releaseYear: string;
}

interface BuildCueArgs {
  entries: CueTrack[];
  overallDetails: OverallDetails;
  audioFileName?: string;
}

const escapeCueValue = (value: string) => value.replace(/"/g, '\\"');

const formatIndex = (ms: number) => {
  const framesPerSecond = 75;
  const totalFrames = Math.max(0, Math.round((ms / 1000) * framesPerSecond));
  const minutes = Math.floor(totalFrames / (framesPerSecond * 60));
  const remainingFrames = totalFrames - minutes * framesPerSecond * 60;
  const seconds = Math.floor(remainingFrames / framesPerSecond);
  const frames = remainingFrames - seconds * framesPerSecond;
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  const ff = frames.toString().padStart(2, '0');
  return `${mm}:${ss}:${ff}`;
};

export function buildCueString({ entries, overallDetails, audioFileName }: BuildCueArgs): string | null {
  if (!entries.length) {
    return null;
  }

  const lines: string[] = [];
  const { title, performer, genre, releaseYear } = overallDetails;

  if (title.trim()) lines.push(`TITLE "${escapeCueValue(title.trim())}"`);
  if (performer.trim()) lines.push(`PERFORMER "${escapeCueValue(performer.trim())}"`);
  if (genre.trim()) lines.push(`REM GENRE "${escapeCueValue(genre.trim())}"`);
  if (releaseYear.trim()) lines.push(`REM DATE "${escapeCueValue(releaseYear.trim())}"`);

  const fileLabel = audioFileName?.trim() || 'source.m4a';
  lines.push(`FILE "${escapeCueValue(fileLabel)}" MP4`);

  const sortedEntries = [...entries].sort((a, b) => a.trackNumber - b.trackNumber);
  for (const track of sortedEntries) {
    const trackTitle = track.title.trim() || `Track ${track.trackNumber}`;
    const trackPerformer = track.performer?.trim();
    const paddedTrackNumber = track.trackNumber.toString().padStart(2, '0');
    lines.push(`  TRACK ${paddedTrackNumber} AUDIO`);
    lines.push(`    TITLE "${escapeCueValue(trackTitle)}"`);
    if (trackPerformer) {
      lines.push(`    PERFORMER "${escapeCueValue(trackPerformer)}"`);
    }
    lines.push(`    INDEX 01 ${formatIndex(track.startMs)}`);
  }

  return `${lines.join('\n')}\n`;
}
```

- [ ] **Step 18: Run test to verify it passes**

```bash
pnpm test -- test/shared/cue-builder.test.ts
```

Expected: PASS

- [ ] **Step 19: Run all tests**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 20: Commit**

```bash
git add src/shared/ test/shared/
git commit -m "feat: port parser, validator, and CUE builder from original mixcut repo"
```

---

## Task 3: Binary path resolution

**Files:**
- Create: `src/main/binary-path.ts`
- Create: `resources/bin/darwin/.gitkeep`

- [ ] **Step 1: Create binary path resolver**

Create `src/main/binary-path.ts`:

```ts
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
```

- [ ] **Step 2: Create resources directory with placeholder**

```bash
mkdir -p resources/bin/darwin
touch resources/bin/darwin/.gitkeep
```

- [ ] **Step 3: Configure extraResource in forge.config.ts**

Add to `forge.config.ts` in the packagerConfig:

```ts
packagerConfig: {
  asar: true,
  extraResource: ['resources/bin'],
},
```

- [ ] **Step 4: Commit**

```bash
git add src/main/binary-path.ts resources/bin/ forge.config.ts
git commit -m "feat: add binary path resolver for bundled m4acut and AtomicParsley"
```

---

## Task 4: Preferences module

**Files:**
- Create: `src/main/preferences.ts`
- Create: `test/main/preferences.test.ts`

- [ ] **Step 1: Write failing test for preferences**

Create `test/main/preferences.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readPreferences, writePreferences, DEFAULT_PREFERENCES } from '../src/main/preferences';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let testDir: string;

// Override the data dir for testing
beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mixcut-prefs-test-'));
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

describe('preferences', () => {
  it('returns defaults when no file exists', async () => {
    const prefs = await readPreferences(testDir);
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
  });

  it('writes and reads preferences', async () => {
    await writePreferences(testDir, { defaultOutputDir: '/custom/path' });
    const prefs = await readPreferences(testDir);
    expect(prefs.defaultOutputDir).toBe('/custom/path');
  });

  it('merges partial updates with existing preferences', async () => {
    await writePreferences(testDir, { defaultOutputDir: '/first' });
    await writePreferences(testDir, { defaultOutputDir: '/second' });
    const prefs = await readPreferences(testDir);
    expect(prefs.defaultOutputDir).toBe('/second');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- test/main/preferences.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement preferences module**

Create `src/main/preferences.ts`:

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Preferences } from '../shared/types';

export const DEFAULT_PREFERENCES: Preferences = {
  defaultOutputDir: path.join(os.homedir(), 'Music', 'mixcut'),
};

const PREFS_FILE = 'preferences.json';

export async function readPreferences(dataDir: string): Promise<Preferences> {
  const filePath = path.join(dataDir, PREFS_FILE);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function writePreferences(
  dataDir: string,
  update: Partial<Preferences>,
): Promise<void> {
  const current = await readPreferences(dataDir);
  const merged = { ...current, ...update };
  const filePath = path.join(dataDir, PREFS_FILE);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(merged, null, 2), 'utf-8');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- test/main/preferences.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/preferences.ts test/main/preferences.test.ts
git commit -m "feat: add preferences module with JSON persistence"
```

---

## Task 5: Project store

**Files:**
- Create: `src/main/project-store.ts`
- Create: `test/main/project-store.test.ts`

- [ ] **Step 1: Write failing test for project store**

Create `test/main/project-store.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectStore } from '../src/main/project-store';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ProjectState } from '../src/shared/types';

let testDir: string;
let store: ProjectStore;

const makeProject = (overrides: Partial<ProjectState> = {}): ProjectState => ({
  id: crypto.randomUUID(),
  name: 'Test Album',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  audioPath: '/tmp/test.m4a',
  outputDir: '/tmp/output',
  metadata: { title: 'Test Album', performer: 'Artist' },
  tracks: [],
  ...overrides,
});

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mixcut-store-test-'));
  store = new ProjectStore(testDir);
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

describe('ProjectStore', () => {
  it('saves and loads a project', async () => {
    const project = makeProject();
    await store.save(project);
    const loaded = await store.load(project.id);
    expect(loaded).toEqual(project);
  });

  it('lists projects sorted by updatedAt descending', async () => {
    const older = makeProject({ updatedAt: '2024-01-01T00:00:00Z' });
    const newer = makeProject({ updatedAt: '2024-06-01T00:00:00Z' });
    await store.save(older);
    await store.save(newer);
    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(newer.id);
  });

  it('deletes a project', async () => {
    const project = makeProject();
    await store.save(project);
    await store.delete(project.id);
    const list = await store.list();
    expect(list).toHaveLength(0);
  });

  it('returns null for non-existent project', async () => {
    const loaded = await store.load('non-existent');
    expect(loaded).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- test/main/project-store.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement project store**

Create `src/main/project-store.ts`:

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ProjectState, ProjectSummary } from '../shared/types';

export class ProjectStore {
  private projectsDir: string;

  constructor(dataDir: string) {
    this.projectsDir = path.join(dataDir, 'projects');
  }

  async save(project: ProjectState): Promise<void> {
    await fs.mkdir(this.projectsDir, { recursive: true });
    const filePath = path.join(this.projectsDir, `${project.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf-8');
  }

  async load(id: string): Promise<ProjectState | null> {
    const filePath = path.join(this.projectsDir, `${id}.json`);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as ProjectState;
    } catch {
      return null;
    }
  }

  async list(): Promise<ProjectSummary[]> {
    try {
      const files = await fs.readdir(this.projectsDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const summaries: ProjectSummary[] = [];
      for (const file of jsonFiles) {
        const filePath = path.join(this.projectsDir, file);
        try {
          const raw = await fs.readFile(filePath, 'utf-8');
          const project = JSON.parse(raw) as ProjectState;
          summaries.push({
            id: project.id,
            name: project.name,
            updatedAt: project.updatedAt,
          });
        } catch {
          // Skip corrupt files
        }
      }

      return summaries.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    } catch {
      return [];
    }
  }

  async delete(id: string): Promise<void> {
    const filePath = path.join(this.projectsDir, `${id}.json`);
    await fs.rm(filePath, { force: true });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- test/main/project-store.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/project-store.ts test/main/project-store.test.ts
git commit -m "feat: add project store with JSON persistence in Application Support"
```

---

## Task 6: Audio processor (m4acut + AtomicParsley)

**Files:**
- Create: `src/main/processor.ts`
- Create: `test/main/processor.test.ts`

- [ ] **Step 1: Write failing test for processor**

Create `test/main/processor.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildProcessorArgs, buildAtomicParsleyArgs } from '../src/main/processor';

describe('buildProcessorArgs', () => {
  it('builds m4acut arguments', () => {
    const args = buildProcessorArgs('/tmp/source.cue', '/tmp/source.m4a');
    expect(args).toEqual(['-C', '/tmp/source.cue', '/tmp/source.m4a']);
  });
});

describe('buildAtomicParsleyArgs', () => {
  it('builds artwork args', () => {
    const args = buildAtomicParsleyArgs('/tmp/track.m4a', {
      artworkPath: '/tmp/cover.png',
    });
    expect(args).toEqual(['/tmp/track.m4a', '--artwork', '/tmp/cover.png', '--overWrite']);
  });

  it('builds genre args', () => {
    const args = buildAtomicParsleyArgs('/tmp/track.m4a', { genre: 'Rock' });
    expect(args).toEqual(['/tmp/track.m4a', '--genre', 'Rock', '--overWrite']);
  });

  it('builds year args', () => {
    const args = buildAtomicParsleyArgs('/tmp/track.m4a', { year: '2024' });
    expect(args).toEqual(['/tmp/track.m4a', '--year', '2024', '--overWrite']);
  });

  it('combines multiple metadata flags', () => {
    const args = buildAtomicParsleyArgs('/tmp/track.m4a', {
      genre: 'Rock',
      year: '2024',
    });
    expect(args).toEqual(['/tmp/track.m4a', '--genre', 'Rock', '--year', '2024', '--overWrite']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- test/main/processor.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement processor**

Create `src/main/processor.ts`:

```ts
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';
import { BrowserWindow } from 'electron';
import { M4ACUT, ATOMIC_PARSLEY } from './binary-path';
import { buildCueString, OverallDetails } from '../shared/cue-builder';
import type { CueTrack, CutProgress } from '../shared/types';

const execFileAsync = promisify(execFile);

export function buildProcessorArgs(cuePath: string, audioPath: string): string[] {
  return ['-C', cuePath, audioPath];
}

interface AtomicParsleyOptions {
  artworkPath?: string;
  genre?: string;
  year?: string;
}

export function buildAtomicParsleyArgs(
  filePath: string,
  options: AtomicParsleyOptions,
): string[] {
  const args = [filePath];
  if (options.artworkPath) {
    args.push('--artwork', options.artworkPath);
  }
  if (options.genre) {
    args.push('--genre', options.genre);
  }
  if (options.year) {
    args.push('--year', options.year);
  }
  args.push('--overWrite');
  return args;
}

function sendProgress(window: BrowserWindow, progress: CutProgress) {
  window.webContents.send('cut-progress', progress);
}

export interface CutTracksParams {
  audioPath: string;
  tracks: CueTrack[];
  metadata: OverallDetails;
  artworkPath?: string;
  outputDir: string;
}

export async function cutTracks(
  window: BrowserWindow,
  params: CutTracksParams,
): Promise<void> {
  const { audioPath, tracks, metadata, artworkPath, outputDir } = params;

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mixcut-'));

  try {
    // 1. Generate CUE file
    const cueContent = buildCueString({
      entries: tracks,
      overallDetails: metadata,
      audioFileName: path.basename(audioPath),
    });

    if (!cueContent) {
      throw new Error('No tracks to process');
    }

    const cuePath = path.join(workDir, 'source.cue');
    await fs.writeFile(cuePath, cueContent, 'utf-8');

    // 2. Run m4acut
    sendProgress(window, { stage: 'cutting', message: 'Splitting audio...' });
    await execFileAsync(M4ACUT(), buildProcessorArgs(cuePath, audioPath), {
      cwd: workDir,
    });

    // 3. List output files
    const allFiles = await fs.readdir(workDir);
    const outputFiles = allFiles
      .filter((f) => f.endsWith('.m4a') && f !== 'source.m4a')
      .sort()
      .map((f) => path.join(workDir, f));

    // 4. Apply metadata to each track
    for (let i = 0; i < outputFiles.length; i++) {
      sendProgress(window, {
        stage: 'tagging',
        trackNumber: i + 1,
        totalTracks: outputFiles.length,
      });

      const filePath = outputFiles[i];

      // Apply artwork if provided
      if (artworkPath) {
        await execFileAsync(
          ATOMIC_PARSLEY(),
          buildAtomicParsleyArgs(filePath, { artworkPath }),
        );
      }

      // Apply genre and year
      const metadataFlags: AtomicParsleyOptions = {};
      if (metadata.genre?.trim()) metadataFlags.genre = metadata.genre.trim();
      if (metadata.releaseYear?.trim()) metadataFlags.year = metadata.releaseYear.trim();

      if (metadataFlags.genre || metadataFlags.year) {
        await execFileAsync(
          ATOMIC_PARSLEY(),
          buildAtomicParsleyArgs(filePath, metadataFlags),
        );
      }
    }

    // 5. Move to output directory
    await fs.mkdir(outputDir, { recursive: true });
    for (const filePath of outputFiles) {
      const dest = path.join(outputDir, path.basename(filePath));
      await fs.copyFile(filePath, dest);
    }

    sendProgress(window, { stage: 'complete', outputDir });
  } catch (err: any) {
    sendProgress(window, {
      stage: 'error',
      message: err?.message ?? 'Unknown error during processing',
    });
    throw err;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- test/main/processor.test.ts
```

Expected: PASS (the unit tests only test the pure argument-building functions, not the full `cutTracks` which requires Electron + binaries)

- [ ] **Step 5: Commit**

```bash
git add src/main/processor.ts test/main/processor.test.ts
git commit -m "feat: add audio processor for m4acut and AtomicParsley execution"
```

---

## Task 7: IPC handlers and preload API

**Files:**
- Create: `src/main/ipc-handlers.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/index.ts`
- Create: `src/renderer/lib/mixcut-api.ts`

- [ ] **Step 1: Implement IPC handlers**

Create `src/main/ipc-handlers.ts`:

```ts
import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ProjectStore } from './project-store';
import { readPreferences, writePreferences } from './preferences';
import { cutTracks, CutTracksParams } from './processor';
import type { Preferences, ProjectState } from '../shared/types';

export function registerIpcHandlers(dataDir: string) {
  const projectStore = new ProjectStore(dataDir);

  // File picking
  ipcMain.handle('open-audio-file', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'M4A Audio', extensions: ['m4a'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const stat = await fs.stat(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stat.size,
    };
  });

  ipcMain.handle('open-cue-file', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'CUE Sheet', extensions: ['cue'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    return { path: filePath, content };
  });

  ipcMain.handle('open-image-file', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    return { path: filePath, name: path.basename(filePath) };
  });

  ipcMain.handle('select-output-dir', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });

  // Processing
  ipcMain.handle('cut-tracks', async (event, params: CutTracksParams) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error('No window found');
    await cutTracks(window, params);
  });

  // Output
  ipcMain.on('open-in-finder', (_event, dirPath: string) => {
    shell.openPath(dirPath);
  });

  // Projects
  ipcMain.handle('save-project', async (_event, project: ProjectState) => {
    await projectStore.save(project);
  });

  ipcMain.handle('load-project', async (_event, id: string) => {
    return projectStore.load(id);
  });

  ipcMain.handle('list-projects', async () => {
    return projectStore.list();
  });

  ipcMain.handle('delete-project', async (_event, id: string) => {
    await projectStore.delete(id);
  });

  // Preferences
  ipcMain.handle('get-preferences', async () => {
    return readPreferences(dataDir);
  });

  ipcMain.handle('set-preferences', async (_event, prefs: Partial<Preferences>) => {
    await writePreferences(dataDir, prefs);
  });
}
```

- [ ] **Step 2: Update preload script**

Replace `src/preload/index.ts`:

```ts
import { contextBridge, ipcRenderer } from 'electron';
import type {
  CutProgress,
  Preferences,
  ProjectState,
  ProjectSummary,
} from '../shared/types';
import type { CutTracksParams } from '../main/processor';

const api = {
  // File picking
  openAudioFile: (): Promise<{ path: string; name: string; size: number } | null> =>
    ipcRenderer.invoke('open-audio-file'),
  openCueFile: (): Promise<{ path: string; content: string } | null> =>
    ipcRenderer.invoke('open-cue-file'),
  openImageFile: (): Promise<{ path: string; name: string } | null> =>
    ipcRenderer.invoke('open-image-file'),
  selectOutputDir: (): Promise<string | null> =>
    ipcRenderer.invoke('select-output-dir'),

  // Audio — serve file to renderer via custom protocol
  getAudioUrl: (filePath: string): string =>
    `mixcut-file://${encodeURIComponent(filePath)}`,
  getImageUrl: (filePath: string): string =>
    `mixcut-file://${encodeURIComponent(filePath)}`,

  // Processing
  cutTracks: (params: CutTracksParams): Promise<void> =>
    ipcRenderer.invoke('cut-tracks', params),
  onCutProgress: (callback: (progress: CutProgress) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: CutProgress) =>
      callback(progress);
    ipcRenderer.on('cut-progress', handler);
    return () => ipcRenderer.removeListener('cut-progress', handler);
  },

  // Output
  openInFinder: (dirPath: string): void =>
    ipcRenderer.send('open-in-finder', dirPath),

  // Projects
  saveProject: (project: ProjectState): Promise<void> =>
    ipcRenderer.invoke('save-project', project),
  loadProject: (id: string): Promise<ProjectState | null> =>
    ipcRenderer.invoke('load-project', id),
  listProjects: (): Promise<ProjectSummary[]> =>
    ipcRenderer.invoke('list-projects'),
  deleteProject: (id: string): Promise<void> =>
    ipcRenderer.invoke('delete-project', id),

  // Preferences
  getPreferences: (): Promise<Preferences> =>
    ipcRenderer.invoke('get-preferences'),
  setPreferences: (prefs: Partial<Preferences>): Promise<void> =>
    ipcRenderer.invoke('set-preferences', prefs),
};

export type MixcutApi = typeof api;

contextBridge.exposeInMainWorld('mixcut', api);
```

- [ ] **Step 3: Create typed wrapper for renderer**

Create `src/renderer/lib/mixcut-api.ts`:

```ts
import type { MixcutApi } from '../../preload/index';

declare global {
  interface Window {
    mixcut: MixcutApi;
  }
}

export const mixcut = window.mixcut;
```

- [ ] **Step 4: Update main process to register handlers and custom protocol**

Replace `src/main/index.ts`:

```ts
import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'node:path';
import { registerIpcHandlers } from './ipc-handlers';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

const dataDir = path.join(app.getPath('userData'));

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
}

// Register custom protocol for serving local files to renderer
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mixcut-file',
    privileges: {
      bypassCSP: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
]);

app.whenReady().then(() => {
  // Handle mixcut-file:// protocol
  protocol.handle('mixcut-file', (request) => {
    const filePath = decodeURIComponent(request.url.replace('mixcut-file://', ''));
    return net.fetch(`file://${filePath}`);
  });

  registerIpcHandlers(dataDir);
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
```

- [ ] **Step 5: Run the app to verify it starts**

```bash
pnpm start
```

Expected: Electron window opens without errors. The "mixcut" heading is visible.

- [ ] **Step 6: Commit**

```bash
git add src/main/index.ts src/main/ipc-handlers.ts src/preload/index.ts src/renderer/lib/mixcut-api.ts
git commit -m "feat: add IPC handlers, preload API, and custom file protocol"
```

---

## Task 8: UI — design and build with frontend-design skill

**Files:**
- Create/modify: all files in `src/renderer/components/`, `src/renderer/hooks/`, `src/renderer/App.tsx`

This task uses the `frontend-design` skill to design and build the Paper-style UI. The skill should be invoked with the following brief:

> Build the complete UI for mixcut, a macOS Electron app for splitting .m4a audio files into tracks.
>
> **Layout:** Single window, 4-step linear workflow. macOS hidden title bar with traffic lights.
>
> **Step 1 — Open Audio:** File picker button + drag-and-drop zone for .m4a files. Show recent projects list below (from `mixcut.listProjects()`). Clicking a recent project loads it.
>
> **Step 2 — Edit Tracklist:** Split layout. Left: WaveSurfer.js waveform with playback controls (play/pause, current time, zoom). Right: tracklist editor with inline title/performer editing, add/remove track buttons. Below: album metadata form (title, performer, genre, year) + artwork picker + CUE file import drop zone. Output directory shown with change button.
>
> **Step 3 — Processing:** Progress view showing current stage (cutting → tagging track N of M → complete). Per-track progress list.
>
> **Step 4 — Done:** List of output track files. "Open in Finder" button. "New Session" button.
>
> **Style:** Paper design system. Use existing WaveSurfer.js for waveform rendering.
>
> **API:** All filesystem operations go through `window.mixcut` (typed via `src/renderer/lib/mixcut-api.ts`). Import `mixcut` from there.
>
> **Reference:** The original website at `/Users/g30r93g/Projects/mixcut/website/src/` has working React components for waveform, tracklist editor, metadata editor that can be used as functional reference. The visual design should be new (Paper style), but the interaction patterns are proven.

- [ ] **Step 1: Invoke frontend-design skill**

Use the `frontend-design` skill with the brief above. Follow its process to design and implement all UI components.

- [ ] **Step 2: Wire up App.tsx with step navigation**

Ensure `App.tsx` implements the 4-step workflow using state to track the current step, passing the correct props to each step component.

- [ ] **Step 3: Wire up hooks**

Create `src/renderer/hooks/use-cut-progress.ts`:

```ts
import { useState, useEffect } from 'react';
import { mixcut } from '../lib/mixcut-api';
import type { CutProgress } from '../../shared/types';

export function useCutProgress() {
  const [progress, setProgress] = useState<CutProgress | null>(null);

  useEffect(() => {
    const unsubscribe = mixcut.onCutProgress(setProgress);
    return unsubscribe;
  }, []);

  return progress;
}
```

Create `src/renderer/hooks/use-project.ts`:

```ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { mixcut } from '../lib/mixcut-api';
import type { CueTrack, AlbumMetadata, ProjectState } from '../../shared/types';
import { slugify } from '../../shared/strings';

interface UseProjectReturn {
  project: ProjectState | null;
  createProject: (audioPath: string, audioName: string) => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  updateTracks: (tracks: CueTrack[]) => void;
  updateMetadata: (metadata: AlbumMetadata) => void;
  setArtworkPath: (path: string | undefined) => void;
  setOutputDir: (dir: string) => void;
}

export function useProject(): UseProjectReturn {
  const [project, setProject] = useState<ProjectState | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!project) return;
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      const updated = { ...project, updatedAt: new Date().toISOString() };
      mixcut.saveProject(updated);
    }, 500);
    return () => clearTimeout(saveTimeout.current);
  }, [project]);

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

  const loadProject = useCallback(async (id: string) => {
    const loaded = await mixcut.loadProject(id);
    setProject(loaded);
  }, []);

  const updateTracks = useCallback((tracks: CueTrack[]) => {
    setProject((prev) => (prev ? { ...prev, tracks } : null));
  }, []);

  const updateMetadata = useCallback((metadata: AlbumMetadata) => {
    setProject((prev) => (prev ? { ...prev, metadata } : null));
  }, []);

  const setArtworkPath = useCallback((artworkPath: string | undefined) => {
    setProject((prev) => (prev ? { ...prev, artworkPath } : null));
  }, []);

  const setOutputDir = useCallback((outputDir: string) => {
    setProject((prev) => (prev ? { ...prev, outputDir } : null));
  }, []);

  return {
    project,
    createProject,
    loadProject,
    updateTracks,
    updateMetadata,
    setArtworkPath,
    setOutputDir,
  };
}
```

- [ ] **Step 4: Run the app end-to-end**

```bash
pnpm start
```

Expected: Full 4-step workflow is navigable. File pickers open native dialogs. Waveform renders for .m4a files.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/
git commit -m "feat: add Paper-style UI with waveform editor, tracklist, and processing workflow"
```

---

## Task 9: Compile and bundle native binaries

**Files:**
- Populate: `resources/bin/darwin/m4acut`, `resources/bin/darwin/AtomicParsley`

- [ ] **Step 1: Install m4acut dependencies and compile**

m4acut depends on L-Smash. Compile both:

```bash
# Install build tools if needed
brew install automake libtool

# Clone and build L-Smash
cd /tmp
git clone https://github.com/l-smash/l-smash.git
cd l-smash
./configure --prefix=/tmp/l-smash-build
make -j$(sysctl -n hw.ncpu)
make install

# Clone and build m4acut
cd /tmp
git clone https://github.com/nu774/m4acut.git
cd m4acut
# Build against the L-Smash we just compiled
gcc -O2 -o m4acut m4acut.c -I/tmp/l-smash-build/include -L/tmp/l-smash-build/lib -llsmash

# Copy to project
cp m4acut /Users/g30r93g/Projects/mixcut-electron/resources/bin/darwin/m4acut
```

- [ ] **Step 2: Install AtomicParsley**

```bash
brew install atomicparsley

# Copy the binary
cp $(which AtomicParsley) /Users/g30r93g/Projects/mixcut-electron/resources/bin/darwin/AtomicParsley
```

- [ ] **Step 3: Verify binaries work**

```bash
/Users/g30r93g/Projects/mixcut-electron/resources/bin/darwin/m4acut --help
/Users/g30r93g/Projects/mixcut-electron/resources/bin/darwin/AtomicParsley --help
```

Expected: Both binaries print usage information.

- [ ] **Step 4: Make binaries executable and remove .gitkeep**

```bash
chmod +x resources/bin/darwin/m4acut resources/bin/darwin/AtomicParsley
rm resources/bin/darwin/.gitkeep
```

- [ ] **Step 5: Test full processing flow in the app**

```bash
pnpm start
```

Open an .m4a file, add track markers, click "Cut Tracks". Verify output files appear in the output directory with correct metadata.

- [ ] **Step 6: Commit**

```bash
git add resources/bin/darwin/
git commit -m "feat: add compiled m4acut and AtomicParsley macOS binaries"
```

---

## Task 10: DMG maker configuration

**Files:**
- Modify: `forge.config.ts`
- Create: `resources/dmg-background.png` (placeholder — actual image to be designed)

- [ ] **Step 1: Install DMG maker**

```bash
pnpm add -D @electron-forge/maker-dmg
```

- [ ] **Step 2: Configure DMG maker in forge.config.ts**

Update `forge.config.ts` to add the DMG maker:

```ts
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    extraResource: ['resources/bin'],
    icon: 'resources/icon',
  },
  makers: [
    new MakerDMG({
      background: 'resources/dmg-background.png',
      contents: [
        { x: 180, y: 170, type: 'file', path: '' },  // app
        { x: 480, y: 170, type: 'link', path: '/Applications' },
      ],
      icon: 'resources/icon.icns',
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/index.ts', config: 'vite.main.config.ts', target: 'main' },
        { entry: 'src/preload/index.ts', config: 'vite.preload.config.ts', target: 'preload' },
      ],
      renderer: [
        { name: 'main_window', config: 'vite.renderer.config.ts' },
      ],
    }),
  ],
};

export default config;
```

- [ ] **Step 3: Test packaging locally**

```bash
pnpm run make
```

Expected: A `.dmg` file is created in the `out/make/` directory. Opening it shows the app and Applications folder.

- [ ] **Step 4: Commit**

```bash
git add forge.config.ts package.json
git commit -m "feat: configure DMG maker for macOS distribution"
```

---

## Task 11: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm test

      - run: pnpm run package
```

- [ ] **Step 2: Create release workflow**

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: macos-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm test

      - name: Compile m4acut
        run: |
          brew install automake libtool
          git clone https://github.com/l-smash/l-smash.git /tmp/l-smash
          cd /tmp/l-smash
          ./configure --prefix=/tmp/l-smash-build
          make -j$(sysctl -n hw.ncpu)
          make install
          git clone https://github.com/nu774/m4acut.git /tmp/m4acut
          cd /tmp/m4acut
          gcc -O2 -o m4acut m4acut.c -I/tmp/l-smash-build/include -L/tmp/l-smash-build/lib -llsmash
          cp m4acut $GITHUB_WORKSPACE/resources/bin/darwin/m4acut
          chmod +x $GITHUB_WORKSPACE/resources/bin/darwin/m4acut

      - name: Install AtomicParsley
        run: |
          brew install atomicparsley
          cp $(which AtomicParsley) resources/bin/darwin/AtomicParsley
          chmod +x resources/bin/darwin/AtomicParsley

      - name: Build DMG
        run: pnpm run make

      - name: Upload release
        uses: softprops/action-gh-release@v2
        with:
          files: out/make/**/*.dmg
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/
git commit -m "feat: add GitHub Actions CI and release workflows"
```

---

## Task 12: Final integration test and cleanup

**Files:**
- Modify: `package.json` (ensure all scripts are correct)
- Create: `.gitignore`

- [ ] **Step 1: Create .gitignore**

Create `.gitignore`:

```
node_modules/
dist/
out/
.vite/
*.dmg
.DS_Store
```

- [ ] **Step 2: Verify all scripts work**

```bash
pnpm test
pnpm start
pnpm run package
```

Expected: Tests pass, app starts, packaging succeeds.

- [ ] **Step 3: Full manual test**

1. Open the app
2. Pick an .m4a file — verify waveform renders
3. Add track markers by clicking the waveform
4. Edit track titles and metadata
5. Import a .cue file — verify tracks populate
6. Click "Cut Tracks" — verify progress updates
7. Verify output files in the output directory
8. Verify "Open in Finder" works
9. Close and reopen — verify project appears in recent projects
10. Load the project — verify all state is restored

- [ ] **Step 4: Commit**

```bash
git add .gitignore package.json
git commit -m "chore: add gitignore and finalize project configuration"
```
