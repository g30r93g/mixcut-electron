# Automated monthly yt-dlp refresh + macOS auto-update

**Date:** 2026-06-28
**Status:** Approved (design)
**Branch:** `feat/release-automation`

## Problem

`yt-dlp` refuses to operate reliably once its bundled binary is more than ~90 days
old: YouTube rotates its player's signature / n-challenge scheme and the stale
binary can no longer solve it, so downloads of signature-protected videos fail with
exit code 1. The app bundles `yt-dlp` as a committed/fetched binary, so it goes
stale unless a human remembers to bump it and cut a release.

We need two things:

1. **An automated monthly job** that refreshes the pinned `yt-dlp` version and cuts a
   new signed release — but only when `yt-dlp` actually has a newer version.
2. **In-app auto-update** so users running an old build actually receive the refresh
   without manually re-downloading.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Code signing | Developer ID signing + notarization will be set up; required for macOS auto-update |
| Update mechanism | `update-electron-app` + `update.electronjs.org` (Forge-native; public repo) |
| Release trigger | Only release when `yt-dlp` has a newer version than the current pin |
| Versioning | CalVer `YYYY.M.PATCH` (e.g. `2026.6.0`), patch increments for same-month re-releases |
| Platforms | macOS only (matches current distribution) |

## Non-goals

- Windows/Linux auto-update (macOS-only distribution today).
- Universal / x64 builds — keep building for the CI runner's arch, as today.
- Migrating off `electron-forge` to `electron-builder`.
- Custom in-app update UI — use `update-electron-app`'s default native dialog.

## Architecture

### Component 1 — In-app auto-update (`update-electron-app`)

- Add `update-electron-app` as a dependency.
- Initialize it once, early in `src/main/index.ts`, guarded by `app.isPackaged`
  (no-op in dev). Default config: repo `g30r93g/mixcut-electron`, default check
  interval, default "Restart to update" native dialog, logger wired to Electron's
  console.
- **Interface:** one call, `updateElectronApp({ logger })`, behind an
  `if (app.isPackaged)` guard. No other module depends on it.
- **Dependency:** the GitHub Release for each version must contain the macOS `.zip`
  (Squirrel.Mac updates from the zip, not the dmg). `MakerZIP` for `darwin` is
  already configured; the release workflow must upload the zip (today it uploads
  only `*.dmg`).

### Component 2 — Code signing + notarization (Forge)

- Add `osxSign` and `osxNotarize` to `packagerConfig` in `forge.config.ts`,
  **reading all credentials from environment variables**.
- When signing env vars are absent (local `pnpm make`), signing/notarization is
  skipped and the build still succeeds **unsigned** — only CI releases are signed.
- **Required GitHub Actions secrets** (provisioned by the maintainer):
  - `APPLE_CERTIFICATE` — base64 of the Developer ID Application `.p12`
  - `APPLE_CERTIFICATE_PASSWORD`
  - `APPLE_ID`
  - `APPLE_APP_SPECIFIC_PASSWORD`
  - `APPLE_TEAM_ID`
- `release.yml` imports the cert into a temporary keychain before `make`.

### Component 3 — Single source of truth for the yt-dlp version

Today the pinned version exists in **two** places (`release.yml` env +
`scripts/fetch-binaries.sh`), which would drift the instant the monthly job bumps
one. Fix:

- `scripts/fetch-binaries.sh`'s `YTDLP_VERSION="…"` is the single source of truth.
- `release.yml` reads that value via `grep`/`sed` instead of hardcoding its own
  env var (used for both the cache key and the install step).
- The monthly job edits exactly one line in one file.

### Component 4 — Monthly release workflow (`.github/workflows/monthly-update.yml`)

Triggers: `schedule` (cron, 1st of each month) + `workflow_dispatch` (manual).

Steps:

1. Resolve the latest `yt-dlp` release tag via the GitHub API.
2. Read the currently-pinned version from `scripts/fetch-binaries.sh`.
3. **If equal → exit 0, no release.**
4. If newer:
   a. Update the pin in `scripts/fetch-binaries.sh`.
   b. Compute the CalVer app version (see below).
   c. Write it into `package.json`.
   d. Commit both changes.
   e. Create and push tag `v<version>`.
5. The pushed tag triggers the existing `release.yml`, which builds, signs,
   notarizes, and publishes the DMG **+ ZIP**.

### Component 5 — `release.yml` changes

- Derive `YTDLP_VERSION` from `scripts/fetch-binaries.sh` (cache key + install).
- Add keychain import + signing/notarization env wiring.
- Upload `out/make/zip/darwin/**/*.zip` alongside the existing `*.dmg`.

## CalVer computation

Format: `YYYY.M.PATCH`, valid semver, compares cleanly above the current `0.3.1`.

- `YYYY` = current year (e.g. `2026`).
- `M` = current month, **no leading zero** (semver forbids leading zeros in numeric
  identifiers) — e.g. June → `6`.
- `PATCH` = `0` normally; if the current `package.json` version already encodes the
  same `YYYY.M` (a second release within one month), increment the existing patch.

Examples: `0.3.1` → (June 2026) `2026.6.0`; a second June release → `2026.6.1`;
July → `2026.7.0`.

## Testing

- **Unit-test the CalVer computation** as a small pure helper (TS util with Vitest):
  - first release of a month → patch `0`
  - second release same month → patch increments
  - month rollover resets patch to `0`
  - month renders with no leading zero
- **Unit-test the version-compare** logic (is latest yt-dlp newer than the pin?).
- The signing/notarization and live auto-update apply paths cannot be unit-tested in
  CI without certs; validate them **manually once** after first signed release.

## Risks / open points

- First automated release jumps `package.json` from `0.3.1` → `2026.6.0` (intended).
- `update.electronjs.org` requires the repo to stay **public**.
- macOS auto-update silently no-ops until a **signed + notarized** build ships; the
  signing secrets must be configured before the first release that users update from.
