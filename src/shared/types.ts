export interface CueTrack {
  trackNumber: number;
  title: string;
  performer?: string;
  startMs: number;
}

export interface ParsedCue {
  fileName?: string;
  title: string;
  performer: string;
  genre: string;
  releaseYear: string;
  tracks: CueTrack[];
}

export type CueValidationResult =
  | { ok: true; tracks: CueTrack[] }
  | { ok: false; error: string };

export interface AlbumMetadata {
  title: string;
  performer: string;
  genre?: string;
  year?: string;
}

export interface ProjectState {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  audioPath: string;
  artworkPath?: string;
  outputDir: string;
  metadata: AlbumMetadata;
  tracks: CueTrack[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface Preferences {
  defaultOutputDir: string;
}

export type CutProgress =
  | { stage: 'cutting'; message: string }
  | { stage: 'tagging'; trackNumber: number; totalTracks: number }
  | { stage: 'complete'; outputDir: string }
  | { stage: 'error'; message: string };
