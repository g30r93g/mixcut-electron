import { CueTrack, CueValidationResult, ParsedCue } from './types';

export function validateCue(parsed: ParsedCue): CueValidationResult {
  const { tracks } = parsed;
  if (!tracks.length) return { ok: false, error: 'No tracks found in CUE sheet' };
  const normalized: CueTrack[] = [...tracks].sort((a, b) => a.startMs - b.startMs);
  const seenNumbers = new Set<number>();
  for (const t of normalized) {
    if (!Number.isFinite(t.trackNumber) || t.trackNumber <= 0) return { ok: false, error: `Invalid track number: ${t.trackNumber}` };
    if (!t.title || !t.title.trim()) return { ok: false, error: `Track ${t.trackNumber} is missing a TITLE` };
    if (!Number.isFinite(t.startMs) || t.startMs < 0) return { ok: false, error: `Track ${t.trackNumber} has invalid start time` };
    if (seenNumbers.has(t.trackNumber)) return { ok: false, error: `Duplicate track number: ${t.trackNumber}` };
    seenNumbers.add(t.trackNumber);
  }
  for (let i = 1; i < normalized.length; i++) {
    if (normalized[i].startMs <= normalized[i - 1].startMs) return { ok: false, error: `Track ${normalized[i].trackNumber} starts before or at same time as previous track` };
  }
  return { ok: true, tracks: normalized };
}
