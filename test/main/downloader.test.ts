import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => '/mock' },
}));

import { validateUrl, parseYtdlpOutput, parseDownloadPercent } from '../../src/main/downloader';

describe('validateUrl', () => {
  it('accepts https youtube URL', () => {
    expect(validateUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
  });

  it('accepts https soundcloud URL', () => {
    expect(validateUrl('https://soundcloud.com/artist/track')).toBe(true);
  });

  it('accepts http URL', () => {
    expect(validateUrl('http://youtube.com/watch?v=abc')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateUrl('')).toBe(false);
  });

  it('rejects non-URL text', () => {
    expect(validateUrl('not a url')).toBe(false);
  });

  it('rejects ftp URL', () => {
    expect(validateUrl('ftp://example.com/file.m4a')).toBe(false);
  });
});

describe('parseYtdlpOutput', () => {
  it('parses three-line output from --print after_move:filepath,title,uploader', () => {
    const stdout = '/tmp/mixcut-dl-abc123/My Song.m4a\nMy Song\nSome Artist\n';
    const result = parseYtdlpOutput(stdout);
    expect(result).toEqual({
      filepath: '/tmp/mixcut-dl-abc123/My Song.m4a',
      title: 'My Song',
      uploader: 'Some Artist',
    });
  });

  it('handles missing uploader (empty line)', () => {
    const stdout = '/tmp/song.m4a\nSong Title\n\n';
    const result = parseYtdlpOutput(stdout);
    expect(result).toEqual({
      filepath: '/tmp/song.m4a',
      title: 'Song Title',
      uploader: '',
    });
  });

  it('returns null for malformed output', () => {
    const result = parseYtdlpOutput('only one line\n');
    expect(result).toBeNull();
  });

  it('returns null for empty output', () => {
    const result = parseYtdlpOutput('');
    expect(result).toBeNull();
  });
});

describe('parseDownloadPercent', () => {
  it('parses standard download progress line', () => {
    expect(parseDownloadPercent('[download]  45.2% of 10.00MiB')).toBe(45.2);
  });

  it('parses 100% line', () => {
    expect(parseDownloadPercent('[download] 100% of 10.00MiB')).toBe(100);
  });

  it('returns null for non-progress line', () => {
    expect(parseDownloadPercent('[ExtractAudio] Converting...')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseDownloadPercent('')).toBeNull();
  });
});
