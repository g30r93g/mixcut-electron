import { describe, it, expect } from 'vitest';
import { buildCueString } from '@shared/cue-builder';

describe('buildCueString', () => {
  it('generates valid CUE text from tracks', () => {
    const result = buildCueString({
      entries: [
        { trackNumber: 1, title: 'First', performer: 'A', startMs: 0 },
        { trackNumber: 2, title: 'Second', startMs: 60000 },
      ],
      overallDetails: { title: 'Album', performer: 'Artist', genre: 'Rock', releaseYear: '2024' },
      audioFileName: 'source.m4a',
    });
    expect(result).toContain('TITLE "Album"');
    expect(result).toContain('PERFORMER "Artist"');
    expect(result).toContain('REM GENRE "Rock"');
    expect(result).toContain('REM DATE "2024"');
    expect(result).toContain('FILE "source.m4a" MP4');
    expect(result).toContain('TRACK 01 AUDIO');
    expect(result).toContain('INDEX 01 00:00:00');
    expect(result).toContain('TRACK 02 AUDIO');
    expect(result).toContain('INDEX 01 01:00:00');
  });
  it('returns null for empty entries', () => {
    expect(buildCueString({ entries: [], overallDetails: { title: '', performer: '', genre: '', releaseYear: '' } })).toBeNull();
  });
  it('escapes quotes in values', () => {
    const result = buildCueString({
      entries: [{ trackNumber: 1, title: 'Say "Hello"', startMs: 0 }],
      overallDetails: { title: '', performer: '', genre: '', releaseYear: '' },
    });
    expect(result).toContain('Say \\"Hello\\"');
  });
});
