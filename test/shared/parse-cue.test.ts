import { describe, it, expect } from 'vitest';
import { parseCue } from '@shared/parse-cue';

const SAMPLE_CUE = `TITLE "Test Album"
PERFORMER "Test Artist"
REM GENRE "Electronic"
REM DATE "2024"
FILE "source.m4a" MP4
  TRACK 01 AUDIO
    TITLE "First Track"
    PERFORMER "Artist A"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "Second Track"
    INDEX 01 03:45:37`;

describe('parseCue', () => {
  it('parses album-level metadata', () => {
    const result = parseCue(SAMPLE_CUE);
    expect(result.title).toBe('Test Album');
    expect(result.performer).toBe('Test Artist');
    expect(result.genre).toBe('Electronic');
    expect(result.releaseYear).toBe('2024');
    expect(result.fileName).toBe('source.m4a');
  });
  it('parses tracks', () => {
    const result = parseCue(SAMPLE_CUE);
    expect(result.tracks).toHaveLength(2);
    expect(result.tracks[0]).toEqual({
      trackNumber: 1, title: 'First Track', performer: 'Artist A', startMs: 0,
    });
    expect(result.tracks[1]).toEqual({
      trackNumber: 2, title: 'Second Track', performer: undefined, startMs: 225493,
    });
  });
  it('handles empty input', () => {
    const result = parseCue('');
    expect(result.tracks).toHaveLength(0);
  });
});
