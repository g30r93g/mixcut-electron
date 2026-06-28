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
