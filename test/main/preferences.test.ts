import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readPreferences, writePreferences, DEFAULT_PREFERENCES } from '../../src/main/preferences';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let testDir: string;

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
