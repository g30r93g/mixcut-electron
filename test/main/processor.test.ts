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

  it('builds title and artist args', () => {
    const args = buildAtomicParsleyArgs('/tmp/track.m4a', { title: 'Intro', artist: 'Fuze' });
    expect(args).toEqual(['/tmp/track.m4a', '--title', 'Intro', '--artist', 'Fuze', '--overWrite']);
  });

  it('builds album and albumArtist args', () => {
    const args = buildAtomicParsleyArgs('/tmp/track.m4a', { album: 'Ignition II', albumArtist: 'Fuze' });
    expect(args).toEqual(['/tmp/track.m4a', '--album', 'Ignition II', '--albumArtist', 'Fuze', '--overWrite']);
  });

  it('builds tracknum args', () => {
    const args = buildAtomicParsleyArgs('/tmp/track.m4a', { tracknum: '3/10' });
    expect(args).toEqual(['/tmp/track.m4a', '--tracknum', '3/10', '--overWrite']);
  });

  it('builds gapless args', () => {
    const args = buildAtomicParsleyArgs('/tmp/track.m4a', { gapless: true });
    expect(args).toEqual(['/tmp/track.m4a', '--gapless', 'true', '--overWrite']);
  });

  it('combines all metadata flags in correct order', () => {
    const args = buildAtomicParsleyArgs('/tmp/track.m4a', {
      title: 'Intro',
      artist: 'Fuze',
      album: 'Ignition II',
      albumArtist: 'Fuze',
      tracknum: '1/10',
      genre: 'Drum and Bass',
      year: '2026',
      gapless: true,
      artworkPath: '/tmp/cover.png',
    });
    expect(args).toEqual([
      '/tmp/track.m4a',
      '--title', 'Intro',
      '--artist', 'Fuze',
      '--album', 'Ignition II',
      '--albumArtist', 'Fuze',
      '--tracknum', '1/10',
      '--genre', 'Drum and Bass',
      '--year', '2026',
      '--gapless', 'true',
      '--artwork', '/tmp/cover.png',
      '--overWrite',
    ]);
  });
});
