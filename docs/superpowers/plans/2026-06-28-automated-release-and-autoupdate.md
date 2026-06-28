# Automated Release + macOS Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a monthly scheduled workflow that re-pins `yt-dlp` to its latest release and cuts a signed CalVer release only when it changed, plus in-app auto-update so users receive the refresh automatically.

**Architecture:** Pure version logic lives in a tested ESM lib (`scripts/lib/version.mjs`) consumed by a new scheduled GitHub Actions workflow. In-app updates use Electron's `update-electron-app` against `update.electronjs.org`, gated on `app.isPackaged`. macOS signing/notarization is added to Forge via env-gated helpers so local unsigned builds still succeed. The `yt-dlp` version pin is consolidated to a single source of truth (`scripts/fetch-binaries.sh`).

**Tech Stack:** electron-forge, Vite, TypeScript, Vitest, pnpm 11.9, Node 24, GitHub Actions, `update-electron-app`, `@electron/osx-sign` + `@electron/notarize` (via Forge).

## Global Constraints

- Repo is public: `g30r93g/mixcut-electron`. Auto-update host: `update.electronjs.org`.
- macOS-only distribution. Do not add Windows/Linux update paths.
- CalVer format `YYYY.M.PATCH` — month has **no leading zero** (valid semver). Same-month re-release increments PATCH; new month resets PATCH to `0`.
- Release trigger: cut a release **only when** latest `yt-dlp` differs from the current pin.
- Signing/notarization is **env-gated**: when signing env vars are absent, the build must still succeed unsigned (local `pnpm make` must not break).
- Every GitHub Release must contain **both** the `.dmg` (manual install) and the `.zip` (Squirrel.Mac auto-update source).
- Single source of truth for the yt-dlp version: `scripts/fetch-binaries.sh` (`YTDLP_VERSION="…"`). Nothing else hardcodes it.
- Tests live in `test/**/*.test.ts` (Vitest `describe/it/expect`). Run with `pnpm test`.
- All work happens in the worktree `.worktrees/release-automation` on branch `feat/release-automation`.

---

### Task 0: Worktree dependencies (setup — folded into Task 1)

The worktree has no `node_modules`. Before running any test, install deps **in the worktree**:

```bash
cd /Users/g30r93g/Projects/mixcut-electron/.worktrees/release-automation
pnpm install
```

Expected: install completes; `pnpm test` then runs the existing 45 tests green.

---

### Task 1: Pure version helpers (CalVer + yt-dlp compare)

**Files:**
- Create: `scripts/lib/version.mjs`
- Test: `test/scripts/version.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `compareSemverish(a: string, b: string): number` — numeric segment-wise compare; returns `-1 | 0 | 1`.
  - `isNewer(latest: string, current: string): boolean` — `true` iff `latest` sorts above `current`.
  - `computeCalVer(currentAppVersion: string, year: number, month: number): string` — returns `"<year>.<month>.<patch>"`, patch incremented when `currentAppVersion` already equals `"<year>.<month>.N"`, else `0`.

- [ ] **Step 1: Write the failing test**

Create `test/scripts/version.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { compareSemverish, isNewer, computeCalVer } from '../../scripts/lib/version.mjs';

describe('compareSemverish', () => {
  it('orders by numeric segments', () => {
    expect(compareSemverish('2026.6.9', '2026.6.10')).toBe(-1);
    expect(compareSemverish('2026.10.1', '2026.9.1')).toBe(1);
    expect(compareSemverish('2026.6.0', '2026.6.0')).toBe(0);
  });
  it('treats missing trailing segments as zero', () => {
    expect(compareSemverish('2026.6', '2026.6.0')).toBe(0);
  });
});

describe('isNewer', () => {
  it('detects a newer yt-dlp release', () => {
    expect(isNewer('2026.06.09', '2025.12.08')).toBe(true);
    expect(isNewer('2025.12.08', '2025.12.08')).toBe(false);
    expect(isNewer('2025.11.01', '2025.12.08')).toBe(false);
  });
});

describe('computeCalVer', () => {
  it('first release of a month uses patch 0', () => {
    expect(computeCalVer('0.3.1', 2026, 6)).toBe('2026.6.0');
  });
  it('second release in same month increments patch', () => {
    expect(computeCalVer('2026.6.0', 2026, 6)).toBe('2026.6.1');
    expect(computeCalVer('2026.6.7', 2026, 6)).toBe('2026.6.8');
  });
  it('new month resets patch to 0', () => {
    expect(computeCalVer('2026.6.3', 2026, 7)).toBe('2026.7.0');
  });
  it('renders month with no leading zero', () => {
    expect(computeCalVer('0.3.1', 2026, 6)).not.toContain('.06.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- version`
Expected: FAIL — cannot resolve `scripts/lib/version.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/lib/version.mjs`:

```js
// Pure version helpers shared by CI scripts and unit tests. No Node-runtime
// state (no Date/env) so the logic stays deterministic and testable.

/** Compare dotted numeric versions segment-by-segment. Returns -1 | 0 | 1. */
export function compareSemverish(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/** True iff `latest` is strictly newer than `current`. */
export function isNewer(latest, current) {
  return compareSemverish(latest, current) > 0;
}

/** Next CalVer app version: `<year>.<month>.<patch>`, patch increments within a month. */
export function computeCalVer(currentAppVersion, year, month) {
  const prefix = `${year}.${month}.`;
  let patch = 0;
  if (String(currentAppVersion).startsWith(prefix)) {
    const prev = parseInt(String(currentAppVersion).slice(prefix.length), 10);
    if (Number.isFinite(prev)) patch = prev + 1;
  }
  return `${year}.${month}.${patch}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- version`
Expected: PASS (all `version.test.ts` cases).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/version.mjs test/scripts/version.test.ts
git commit -m "feat: pure CalVer + yt-dlp version-compare helpers"
```

---

### Task 2: In-app auto-update (`update-electron-app`)

**Files:**
- Modify: `package.json` (add dependency `update-electron-app`, add `repository` field)
- Create: `src/main/auto-update.ts`
- Modify: `src/main/index.ts:45-74` (call inside `app.whenReady().then`)
- Test: `test/main/auto-update.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `initAutoUpdate(isPackaged: boolean, update?: UpdateFn): boolean` — returns `false` (and does nothing) when `!isPackaged`; otherwise calls `update(...)` with the public-update-service source for `g30r93g/mixcut-electron` and returns `true`.

- [ ] **Step 1: Add the dependency**

```bash
pnpm add update-electron-app
```

Expected: `update-electron-app` (^3) appears under `dependencies` in `package.json`.

- [ ] **Step 2: Add `repository` field to package.json**

Add this top-level field (after `"license": "MIT",`):

```json
  "repository": {
    "type": "git",
    "url": "https://github.com/g30r93g/mixcut-electron.git"
  },
```

- [ ] **Step 3: Write the failing test**

Create `test/main/auto-update.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// update-electron-app pulls in electron at import time; mock it for unit tests.
vi.mock('update-electron-app', () => ({
  updateElectronApp: vi.fn(),
  UpdateSourceType: { ElectronPublicUpdateService: 'electron-public-update-service' },
}));

import { initAutoUpdate } from '../../src/main/auto-update';

describe('initAutoUpdate', () => {
  it('is a no-op when the app is not packaged', () => {
    const update = vi.fn();
    expect(initAutoUpdate(false, update)).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('initializes the public update service when packaged', () => {
    const update = vi.fn();
    expect(initAutoUpdate(true, update)).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
    const opts = update.mock.calls[0][0];
    expect(opts.updateSource.type).toBe('electron-public-update-service');
    expect(opts.updateSource.repo).toBe('g30r93g/mixcut-electron');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm test -- auto-update`
Expected: FAIL — `src/main/auto-update` has no `initAutoUpdate` export.

- [ ] **Step 5: Write minimal implementation**

Create `src/main/auto-update.ts`:

```ts
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';

export const UPDATE_REPO = 'g30r93g/mixcut-electron';

type UpdateFn = (opts: Parameters<typeof updateElectronApp>[0]) => void;

/**
 * Wire Electron auto-update against update.electronjs.org. No-op (returns false)
 * in dev / unpackaged builds. `update` is injectable for testing.
 */
export function initAutoUpdate(
  isPackaged: boolean,
  update: UpdateFn = updateElectronApp,
): boolean {
  if (!isPackaged) return false;
  update({
    updateSource: {
      type: UpdateSourceType.ElectronPublicUpdateService,
      repo: UPDATE_REPO,
    },
    logger: console,
  });
  return true;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test -- auto-update`
Expected: PASS.

- [ ] **Step 7: Wire it into the main process**

In `src/main/index.ts`, add the import after line 3:

```ts
import { initAutoUpdate } from './auto-update';
```

Then inside `app.whenReady().then(() => { … })`, add as the first line of the callback body (before `const menu = …` on line 46):

```ts
  initAutoUpdate(app.isPackaged);
```

- [ ] **Step 8: Verify the app still builds and tests pass**

Run: `pnpm test && pnpm run package`
Expected: tests PASS; `package` completes (unsigned locally is fine).

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml src/main/auto-update.ts src/main/index.ts test/main/auto-update.test.ts
git commit -m "feat: in-app auto-update via update-electron-app"
```

---

### Task 3: macOS code signing + notarization (env-gated)

**Files:**
- Create: `src/build/osx-signing.ts`
- Modify: `forge.config.ts` (add `osxSign` / `osxNotarize` to `packagerConfig`)
- Test: `test/build/osx-signing.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `osxSignOptions(env: NodeJS.ProcessEnv): Record<string, never> | undefined` — `{}` (enables signing with the keychain identity) when `APPLE_CERTIFICATE` is set, else `undefined`.
  - `osxNotarizeOptions(env: NodeJS.ProcessEnv): { appleId: string; appleIdPassword: string; teamId: string } | undefined` — populated when all three notarization vars are present, else `undefined`.

- [ ] **Step 1: Write the failing test**

Create `test/build/osx-signing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { osxSignOptions, osxNotarizeOptions } from '../../src/build/osx-signing';

describe('osxSignOptions', () => {
  it('is undefined without a certificate', () => {
    expect(osxSignOptions({})).toBeUndefined();
  });
  it('enables signing when a certificate is present', () => {
    expect(osxSignOptions({ APPLE_CERTIFICATE: 'base64==' })).toEqual({});
  });
});

describe('osxNotarizeOptions', () => {
  it('is undefined when any credential is missing', () => {
    expect(osxNotarizeOptions({})).toBeUndefined();
    expect(osxNotarizeOptions({ APPLE_ID: 'a', APPLE_APP_SPECIFIC_PASSWORD: 'b' })).toBeUndefined();
  });
  it('maps all three credentials when present', () => {
    expect(
      osxNotarizeOptions({
        APPLE_ID: 'me@example.com',
        APPLE_APP_SPECIFIC_PASSWORD: 'abcd-efgh',
        APPLE_TEAM_ID: 'TEAM123',
      }),
    ).toEqual({ appleId: 'me@example.com', appleIdPassword: 'abcd-efgh', teamId: 'TEAM123' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- osx-signing`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/build/osx-signing.ts`:

```ts
// Env-gated macOS signing/notarization config for electron-forge.
// Returns `undefined` when credentials are absent so local builds stay unsigned
// and never fail.

export function osxSignOptions(
  env: NodeJS.ProcessEnv,
): Record<string, never> | undefined {
  // Empty object enables @electron/osx-sign with the Developer ID identity that
  // CI imports into the keychain. Absent cert → skip signing.
  return env.APPLE_CERTIFICATE ? {} : undefined;
}

export function osxNotarizeOptions(
  env: NodeJS.ProcessEnv,
): { appleId: string; appleIdPassword: string; teamId: string } | undefined {
  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = env;
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) return undefined;
  return {
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- osx-signing`
Expected: PASS.

- [ ] **Step 5: Wire into forge.config.ts**

Add this import at the top of `forge.config.ts` (after the existing imports):

```ts
import { osxSignOptions, osxNotarizeOptions } from './src/build/osx-signing';
```

Change the `packagerConfig` block to include signing options:

```ts
  packagerConfig: {
    asar: true,
    icon: 'resources/icon',
    extraResource: ['resources/bin'],
    osxSign: osxSignOptions(process.env),
    osxNotarize: osxNotarizeOptions(process.env),
  },
```

- [ ] **Step 6: Verify local unsigned build still works**

Run: `pnpm test && pnpm run package`
Expected: tests PASS; `package` completes unsigned (no Apple env present → `osxSign`/`osxNotarize` are `undefined`).

- [ ] **Step 7: Commit**

```bash
git add src/build/osx-signing.ts forge.config.ts test/build/osx-signing.test.ts
git commit -m "feat: env-gated macOS signing + notarization in Forge"
```

---

### Task 4: Consolidate version source + sign/publish in release.yml

**Files:**
- Modify: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: `scripts/fetch-binaries.sh` `YTDLP_VERSION` (single source of truth).
- Produces: a tag-triggered release containing both `.dmg` and `.zip`, signed+notarized when secrets are configured.

- [ ] **Step 1: Read the yt-dlp version from the single source**

In `.github/workflows/release.yml`, remove the hardcoded `YTDLP_VERSION` from the top-level `env:` block. Add a step early in the job (after checkout) that exports it:

```yaml
      - name: Resolve yt-dlp version
        id: ytdlp
        run: echo "version=$(grep -E '^YTDLP_VERSION=' scripts/fetch-binaries.sh | sed -E 's/.*\"(.*)\".*/\1/')" >> "$GITHUB_OUTPUT"
```

Replace later uses of `${{ env.YTDLP_VERSION }}` (cache key + install step URL) with `${{ steps.ytdlp.outputs.version }}`.

- [ ] **Step 2: Import the signing certificate into a temporary keychain**

Add this step **before** the `Build DMG` (`pnpm run make`) step. It only runs when the secret exists:

```yaml
      - name: Import Developer ID certificate
        if: ${{ secrets.APPLE_CERTIFICATE != '' }}
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
        run: |
          KEYCHAIN=$RUNNER_TEMP/build.keychain
          KEYCHAIN_PASSWORD=$(openssl rand -base64 24)
          security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
          security set-keychain-settings -lut 3600 "$KEYCHAIN"
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
          echo "$APPLE_CERTIFICATE" | base64 --decode > "$RUNNER_TEMP/cert.p12"
          security import "$RUNNER_TEMP/cert.p12" -k "$KEYCHAIN" -P "$APPLE_CERTIFICATE_PASSWORD" -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
          security list-keychains -d user -s "$KEYCHAIN" $(security list-keychains -d user | tr -d '"')
```

- [ ] **Step 3: Pass signing env into the build**

Update the `Build DMG` step so signing/notarization env vars (consumed by `src/build/osx-signing.ts` via `process.env`) are present:

```yaml
      - name: Build DMG and ZIP
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: pnpm run make
```

- [ ] **Step 4: Upload both DMG and ZIP to the release**

Replace the `Upload release` step's `files:` so the Squirrel.Mac zip is attached:

```yaml
      - name: Upload release
        uses: softprops/action-gh-release@v3
        with:
          files: |
            out/make/**/*.dmg
            out/make/zip/darwin/**/*.zip
```

- [ ] **Step 5: Validate workflow syntax locally**

Run: `node -e "require('js-yaml')" 2>/dev/null && npx --yes js-yaml .github/workflows/release.yml >/dev/null && echo "YAML OK" || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/release.yml')); print('YAML OK')"`
Expected: `YAML OK`.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: sign+notarize releases, publish zip, single-source yt-dlp version"
```

---

### Task 5: Monthly scheduled update workflow

**Files:**
- Create: `scripts/next-version.mjs`
- Create: `.github/workflows/monthly-update.yml`
- Modify: `.github/workflows/release.yml` (add a `workflow_dispatch` trigger so the monthly job can launch it)

**Design note — why `workflow_dispatch`:** GitHub Actions deliberately does **not** trigger workflows from a `push` (or tag push) made with the default `GITHUB_TOKEN` (anti-recursion). So the monthly job cannot rely on its pushed tag firing `release.yml`. Instead, `release.yml` gains a `workflow_dispatch` trigger (a documented exception that **does** run under `GITHUB_TOKEN`), and the monthly job calls it via `gh workflow run` after creating the tag. No extra PAT secret is required.

**Interfaces:**
- Consumes: `scripts/lib/version.mjs` (`isNewer`, `computeCalVer`); `scripts/fetch-binaries.sh` `YTDLP_VERSION`; `package.json` `version`; `release.yml` (`workflow_dispatch` with a `tag` input).
- Produces: when a newer yt-dlp exists, a commit bumping the pin + `package.json` version, a pushed `v<version>` tag, and a `gh workflow run release.yml -f tag=v<version>` dispatch that builds and publishes that tag.

- [ ] **Step 1: Add a `workflow_dispatch` trigger to `release.yml`**

In `.github/workflows/release.yml`, change the `on:` block so the workflow can be launched manually / by the monthly job with an explicit tag, while still working for direct tag pushes:

```yaml
on:
  push:
    tags: ['v*']
  workflow_dispatch:
    inputs:
      tag:
        description: 'Tag to build and release (e.g. v2026.6.0)'
        required: true
```

Make the checkout build the dispatched tag (falls back to the pushed ref for the `push` path). Change the existing `- uses: actions/checkout@v6` step to:

```yaml
      - uses: actions/checkout@v6
        with:
          ref: ${{ github.event.inputs.tag || github.ref }}
```

Give the `Upload release` step an explicit `tag_name` (the dispatch path has no tag ref to auto-detect; the push path falls back to `github.ref_name`):

```yaml
      - name: Upload release
        uses: softprops/action-gh-release@v3
        with:
          tag_name: ${{ github.event.inputs.tag || github.ref_name }}
          files: |
            out/make/**/*.dmg
            out/make/zip/darwin/**/*.zip
```

- [ ] **Step 2: Validate `release.yml` syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml')); print('YAML OK')"`
Expected: `YAML OK`.

- [ ] **Step 3: Write the next-version CLI**

Create `scripts/next-version.mjs`:

```js
// Prints the next CalVer app version to stdout, based on package.json's current
// version and today's date. Used by the monthly workflow.
import { readFileSync } from 'node:fs';
import { computeCalVer } from './lib/version.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const now = new Date();
process.stdout.write(computeCalVer(pkg.version, now.getFullYear(), now.getMonth() + 1));
```

- [ ] **Step 4: Verify the CLI prints a CalVer string**

Run: `node scripts/next-version.mjs`
Expected: a string like `2026.6.0` (current year.month.0, given the current `0.3.1` version). No leading zero on the month.

- [ ] **Step 5: Write the monthly workflow**

Create `.github/workflows/monthly-update.yml`:

```yaml
name: Monthly yt-dlp Update

on:
  schedule:
    - cron: '0 9 1 * *'   # 09:00 UTC on the 1st of each month
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    permissions:
      contents: write   # push the bump commit + tag
      actions: write    # gh workflow run (dispatch release.yml)
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v6
        with:
          node-version: 24

      - name: Resolve versions
        id: v
        run: |
          CURRENT=$(grep -E '^YTDLP_VERSION=' scripts/fetch-binaries.sh | sed -E 's/.*"(.*)".*/\1/')
          LATEST=$(curl -fsSL https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest | grep -oE '"tag_name":\s*"[^"]+"' | head -1 | sed -E 's/.*"([^"]+)"$/\1/')
          echo "current=$CURRENT" >> "$GITHUB_OUTPUT"
          echo "latest=$LATEST" >> "$GITHUB_OUTPUT"
          echo "Current pin: $CURRENT  Latest: $LATEST"

      - name: Decide whether to release
        id: decide
        run: |
          NEWER=$(node -e "import('./scripts/lib/version.mjs').then(m => process.stdout.write(String(m.isNewer('${{ steps.v.outputs.latest }}', '${{ steps.v.outputs.current }}'))))")
          echo "newer=$NEWER" >> "$GITHUB_OUTPUT"
          echo "newer=$NEWER"

      - name: Bump, commit, tag, and dispatch release
        if: steps.decide.outputs.newer == 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          NEW_VERSION=$(node scripts/next-version.mjs)
          echo "Releasing app version $NEW_VERSION with yt-dlp ${{ steps.v.outputs.latest }}"

          # Re-pin yt-dlp (single source of truth)
          sed -i -E "s/^YTDLP_VERSION=\".*\"/YTDLP_VERSION=\"${{ steps.v.outputs.latest }}\"/" scripts/fetch-binaries.sh

          # Bump app version in package.json (no install, no lockfile churn)
          node -e "const fs=require('fs');const p=require('./package.json');p.version='$NEW_VERSION';fs.writeFileSync('./package.json', JSON.stringify(p,null,2)+'\n');"

          git config user.name 'github-actions[bot]'
          git config user.email 'github-actions[bot]@users.noreply.github.com'
          git add scripts/fetch-binaries.sh package.json
          git commit -m "chore: bump yt-dlp to ${{ steps.v.outputs.latest }}, release $NEW_VERSION"
          git tag "v$NEW_VERSION"
          git push origin HEAD:main
          git push origin "v$NEW_VERSION"

          # GITHUB_TOKEN tag pushes don't trigger release.yml; dispatch it explicitly.
          gh workflow run release.yml --ref main -f tag="v$NEW_VERSION"
```

- [ ] **Step 6: Validate workflow syntax locally**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/monthly-update.yml')); print('YAML OK')"`
Expected: `YAML OK`.

- [ ] **Step 7: Dry-run the decision logic locally**

Run:
```bash
node -e "import('./scripts/lib/version.mjs').then(m=>{console.log('newer(new,old)=',m.isNewer('2026.06.09','2025.12.08')); console.log('newer(same)=',m.isNewer('2025.12.08','2025.12.08'));})"
```
Expected: `newer(new,old)= true` then `newer(same)= false`.

- [ ] **Step 8: Commit**

```bash
git add scripts/next-version.mjs .github/workflows/monthly-update.yml .github/workflows/release.yml
git commit -m "ci: monthly scheduled yt-dlp refresh that dispatches a release when changed"
```

---

## Manual verification (post-implementation, cannot be unit-tested)

These require maintainer action and real credentials; document the outcome but they are out of band for automated CI:

1. **Configure GitHub Actions secrets:** `APPLE_CERTIFICATE` (base64 `.p12`), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
2. **Trigger `monthly-update.yml` manually** (`workflow_dispatch`) to confirm it detects a newer yt-dlp, bumps, tags, and that its `gh workflow run` dispatch starts `release.yml` for the new tag.
3. **Confirm the GitHub Release** contains both `.dmg` and `.zip`, and that the app is signed (`codesign -dv --verbose=4 <app>`) and notarized (`spctl -a -vvv <app>`).
4. **Install the prior signed version, then publish a newer one**, and confirm the in-app "Restart to update" dialog appears and applies.

---

## Self-review notes

- **Spec coverage:** Component 1 → Task 2; Component 2 → Task 3 + Task 4 (CI keychain/env); Component 3 → Task 4 Step 1; Component 4 → Task 5; Component 5 → Task 4. CalVer rules → Task 1. Testing section → Tasks 1–3 unit tests + manual section.
- **No leading-zero month** enforced by `computeCalVer` (uses `month` integer directly) and asserted in Task 1 Step 1.
- **Unsigned local builds** preserved by env-gating in Task 3 and verified in Task 3 Step 6 / Task 2 Step 8.
- **Both artifacts** uploaded in Task 4 Step 4.
