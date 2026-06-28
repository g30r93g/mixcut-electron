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
