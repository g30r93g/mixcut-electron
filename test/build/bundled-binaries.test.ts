import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

// The CLI tools we ship are spawned as standalone child processes on the
// end user's machine. If any of them links against a library outside the .app
// bundle (e.g. a Homebrew dylib under /opt/homebrew), it will fail to launch
// there — and for ffmpeg/ffprobe that surfaces as yt-dlp reporting
// "ffprobe and ffmpeg not found". These tests guard against shipping a
// non-self-contained binary again.

const BIN_DIR = path.join(__dirname, '..', '..', 'resources', 'bin', 'darwin');
// Every CLI tool the app spawns as a standalone child process.
const BINARIES = ['ffmpeg', 'ffprobe', 'yt-dlp', 'm4acut', 'AtomicParsley'];

// otool/lipo only exist on macOS; skip elsewhere (e.g. Linux CI lanes).
const onMac = process.platform === 'darwin';

// ffmpeg/ffprobe/yt-dlp are gitignored and fetched at build time, so they are
// absent in the fast unit lane (plain `pnpm test`) and on PR CI. There we skip
// the per-binary checks rather than fail. The release pipeline provisions them
// first and runs this with REQUIRE_BUNDLED_BINARIES=1, which makes a missing
// binary a hard failure — that is where the guard must actually bite.
const strict = process.env.REQUIRE_BUNDLED_BINARIES === '1';

describe.runIf(onMac)('bundled darwin binaries', () => {
  for (const name of BINARIES) {
    const bin = path.join(BIN_DIR, name);
    const present = existsSync(bin);

    it.runIf(strict || present)(`${name} exists`, () => {
      expect(present).toBe(true);
    });

    it.runIf(present)(`${name} is arm64-native`, () => {
      const archs = execFileSync('lipo', ['-archs', bin], { encoding: 'utf8' }).trim();
      expect(archs.split(/\s+/)).toContain('arm64');
    });

    it.runIf(present)(`${name} has no library dependencies outside the system frameworks`, () => {
      // -arch arm64 collapses the per-arch headers a universal binary (yt-dlp)
      // would otherwise print. Dependency lines carry a "(compatibility version"
      // annotation; the echoed path / "(architecture …)" headers do not.
      const otool = execFileSync('otool', ['-arch', 'arm64', '-L', bin], { encoding: 'utf8' });
      const external = otool
        .split('\n')
        .filter((l) => l.includes('(compatibility version'))
        .map((l) => l.trim().split(/\s+/)[0])
        .filter((dylib) => !dylib.startsWith('/usr/lib/') && !dylib.startsWith('/System/'));
      expect(external).toEqual([]);
    });
  }
});
