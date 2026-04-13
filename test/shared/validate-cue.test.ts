import { describe, it, expect } from 'vitest';
import { validateCue } from '@shared/validate-cue';
import type { ParsedCue } from '@shared/types';

const validParsed: ParsedCue = {
  title: 'Album', performer: 'Artist', genre: '', releaseYear: '',
  tracks: [
    { trackNumber: 1, title: 'Track 1', startMs: 0 },
    { trackNumber: 2, title: 'Track 2', startMs: 60000 },
  ],
};

describe('validateCue', () => {
  it('accepts valid CUE data', () => { expect(validateCue(validParsed).ok).toBe(true); });
  it('rejects empty tracks', () => { const r = validateCue({ ...validParsed, tracks: [] }); expect(r.ok).toBe(false); if (!r.ok) expect(r.error).toContain('No tracks'); });
  it('rejects duplicate track numbers', () => { const r = validateCue({ ...validParsed, tracks: [{ trackNumber: 1, title: 'A', startMs: 0 }, { trackNumber: 1, title: 'B', startMs: 1000 }] }); expect(r.ok).toBe(false); if (!r.ok) expect(r.error).toContain('Duplicate'); });
  it('rejects non-increasing start times', () => { const r = validateCue({ ...validParsed, tracks: [{ trackNumber: 1, title: 'A', startMs: 5000 }, { trackNumber: 2, title: 'B', startMs: 5000 }] }); expect(r.ok).toBe(false); });
  it('rejects tracks with empty titles', () => { const r = validateCue({ ...validParsed, tracks: [{ trackNumber: 1, title: '', startMs: 0 }] }); expect(r.ok).toBe(false); if (!r.ok) expect(r.error).toContain('TITLE'); });
});
