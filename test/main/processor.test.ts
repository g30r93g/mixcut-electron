import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({ BrowserWindow: {} }));

import { buildProcessorArgs, buildAtomicParsleyArgs } from '../../src/main/processor';

describe('buildProcessorArgs', () => {
  it('builds m4acut arguments', () => {
    const args = buildProcessorArgs('/tmp/source.cue', '/tmp/source.m4a');
    expect(args).toEqual(['-C', '/tmp/source.cue', '/tmp/source.m4a']);
  });
});

describe('buildAtomicParsleyArgs', () => {
  it('builds artwork args', () => {
    const args = buildAtomicParsleyArgs('/tmp/track.m4a', { artworkPath: '/tmp/cover.png' });
    expect(args).toEqual(['/tmp/track.m4a', '--artwork', '/tmp/cover.png', '--overWrite']);
  });

  it('builds genre args', () => {
    const args = buildAtomicParsleyArgs('/tmp/track.m4a', { genre: 'Rock' });
    expect(args).toEqual(['/tmp/track.m4a', '--genre', 'Rock', '--overWrite']);
  });

  it('builds year args', () => {
    const args = buildAtomicParsleyArgs('/tmp/track.m4a', { year: '2024' });
    expect(args).toEqual(['/tmp/track.m4a', '--year', '2024', '--overWrite']);
  });

  it('combines multiple metadata flags', () => {
    const args = buildAtomicParsleyArgs('/tmp/track.m4a', { genre: 'Rock', year: '2024' });
    expect(args).toEqual(['/tmp/track.m4a', '--genre', 'Rock', '--year', '2024', '--overWrite']);
  });
});
