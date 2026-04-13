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
    expect(framesToMs(3, 45, 37)).toBe(225493);
  });
});
