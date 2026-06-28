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
