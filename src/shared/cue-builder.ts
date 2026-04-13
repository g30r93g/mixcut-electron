import type { CueTrack } from './types';

export interface OverallDetails {
  title: string;
  performer: string;
  genre: string;
  releaseYear: string;
}

interface BuildCueArgs {
  entries: CueTrack[];
  overallDetails: OverallDetails;
  audioFileName?: string;
}

const escapeCueValue = (value: string) => value.replace(/"/g, '\\"');

const formatIndex = (ms: number) => {
  const framesPerSecond = 75;
  const totalFrames = Math.max(0, Math.round((ms / 1000) * framesPerSecond));
  const minutes = Math.floor(totalFrames / (framesPerSecond * 60));
  const remainingFrames = totalFrames - minutes * framesPerSecond * 60;
  const seconds = Math.floor(remainingFrames / framesPerSecond);
  const frames = remainingFrames - seconds * framesPerSecond;
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  const ff = frames.toString().padStart(2, '0');
  return `${mm}:${ss}:${ff}`;
};

export function buildCueString({ entries, overallDetails, audioFileName }: BuildCueArgs): string | null {
  if (!entries.length) return null;
  const lines: string[] = [];
  const { title, performer, genre, releaseYear } = overallDetails;
  if (title.trim()) lines.push(`TITLE "${escapeCueValue(title.trim())}"`);
  if (performer.trim()) lines.push(`PERFORMER "${escapeCueValue(performer.trim())}"`);
  if (genre.trim()) lines.push(`REM GENRE "${escapeCueValue(genre.trim())}"`);
  if (releaseYear.trim()) lines.push(`REM DATE "${escapeCueValue(releaseYear.trim())}"`);
  const fileLabel = audioFileName?.trim() || 'source.m4a';
  lines.push(`FILE "${escapeCueValue(fileLabel)}" MP4`);
  const sortedEntries = [...entries].sort((a, b) => a.trackNumber - b.trackNumber);
  for (const track of sortedEntries) {
    const trackTitle = track.title.trim() || `Track ${track.trackNumber}`;
    const trackPerformer = track.performer?.trim();
    const paddedTrackNumber = track.trackNumber.toString().padStart(2, '0');
    lines.push(`  TRACK ${paddedTrackNumber} AUDIO`);
    lines.push(`    TITLE "${escapeCueValue(trackTitle)}"`);
    if (trackPerformer) lines.push(`    PERFORMER "${escapeCueValue(trackPerformer)}"`);
    lines.push(`    INDEX 01 ${formatIndex(track.startMs)}`);
  }
  return `${lines.join('\n')}\n`;
}
