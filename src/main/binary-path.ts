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
