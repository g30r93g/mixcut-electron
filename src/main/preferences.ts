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
