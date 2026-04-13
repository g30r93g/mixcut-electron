import { useCallback, useMemo, useRef, useState } from 'react';
import { Scissors } from 'lucide-react';
import { TrackWaveform, type TrackWaveformHandle } from './track-waveform';
import { TracklistEditor } from './tracklist-editor';
import { MetadataEditor } from './metadata-editor';
import { mixcut } from '../lib/mixcut-api';
import { parseCue } from '../../shared/parse-cue';
import type { CueTrack, AlbumMetadata } from '../../shared/types';
import type { OverallDetails } from '../../shared/cue-builder';

interface TrackWorkspaceProps {
  audioPath: string;
  audioName: string;
  tracks: CueTrack[];
  metadata: AlbumMetadata;
  artworkPath?: string;
  outputDir: string;
  onUpdateTracks: (tracks: CueTrack[]) => void;
  onUpdateMetadata: (metadata: AlbumMetadata) => void;
  onArtworkChange: (path: string | undefined) => void;
  onOutputDirChange: (dir: string) => void;
  onCutTracks: () => void;
}

export function TrackWorkspace({
  audioPath,
  audioName,
  tracks,
  metadata,
  artworkPath,
  outputDir,
  onUpdateTracks,
  onUpdateMetadata,
  onArtworkChange,
  onOutputDirChange,
  onCutTracks,
}: TrackWorkspaceProps) {
  const waveformRef = useRef<TrackWaveformHandle | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const sortedTracks = useMemo(
    () => [...tracks].sort((a, b) => a.trackNumber - b.trackNumber),
    [tracks],
  );

  const handleWaveformClick = useCallback(
    (ms: number) => {
      // Don't auto-add on click — user uses "Add Track" button or imports CUE
    },
    [],
  );

  const handleAddTrack = useCallback(
    (startMs: number | null) => {
      const nextNumber =
        sortedTracks.length > 0
          ? Math.max(...sortedTracks.map((t) => t.trackNumber)) + 1
          : 1;
      const lastStart = sortedTracks[sortedTracks.length - 1]?.startMs ?? 0;
      const newStart = startMs ?? (currentMs > 0 ? currentMs : lastStart + 60000);
      onUpdateTracks([
        ...tracks,
        {
          trackNumber: nextNumber,
          title: `Track ${nextNumber}`,
          performer: undefined,
          startMs: Math.round(newStart),
        },
      ]);
    },
    [sortedTracks, tracks, onUpdateTracks, currentMs],
  );

  const handleUpdateTrack = useCallback(
    (index: number, patch: Partial<CueTrack>) => {
      const next = [...tracks];
      next[index] = { ...next[index], ...patch };
      onUpdateTracks(next);
    },
    [tracks, onUpdateTracks],
  );

  const handleRemoveTrack = useCallback(
    (index: number) => {
      onUpdateTracks(tracks.filter((_, i) => i !== index));
    },
    [tracks, onUpdateTracks],
  );

  const handleSeek = useCallback((ms: number) => {
    waveformRef.current?.seekTo(ms);
  }, []);

  const handleImportCue = useCallback(async () => {
    const result = await mixcut.openCueFile();
    if (!result) return;
    try {
      const parsed = parseCue(result.content);
      onUpdateTracks(parsed.tracks);
      onUpdateMetadata({
        title: parsed.title || metadata.title,
        performer: parsed.performer || metadata.performer,
        genre: parsed.genre || metadata.genre,
        year: parsed.releaseYear || metadata.year,
      });
    } catch {
      // Parsing failed — could show an error but keeping it simple
    }
  }, [metadata, onUpdateTracks, onUpdateMetadata]);

  const canCut = tracks.length > 0;

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-5">
      {/* Top: audio file name */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl text-ink">{metadata.title || audioName}</h2>
          {metadata.performer && (
            <p className="font-mono text-[10px] text-ink-lighter">{metadata.performer}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onCutTracks}
          disabled={!canCut}
          className="no-drag flex items-center gap-2 rounded-md bg-ink px-4 py-2 font-mono text-xs
            tracking-wider text-paper uppercase transition-all hover:bg-ink-light
            disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Scissors className="size-3.5" />
          Cut Tracks
        </button>
      </div>

      {/* Waveform */}
      <TrackWaveform
        ref={waveformRef}
        audioPath={audioPath}
        onDurationChange={setDurationMs}
        onTimeUpdate={setCurrentMs}
        onWaveformClick={handleWaveformClick}
        currentMs={currentMs}
        durationMs={durationMs}
      />

      {/* Bottom: tracklist + metadata side by side */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_340px] gap-4 overflow-hidden">
        <div className="overflow-y-auto">
          <TracklistEditor
            tracks={tracks}
            currentMs={currentMs}
            durationMs={durationMs}
            onUpdateTrack={handleUpdateTrack}
            onRemoveTrack={handleRemoveTrack}
            onAddTrack={handleAddTrack}
            onSeek={handleSeek}
          />
        </div>
        <div className="overflow-y-auto">
          <MetadataEditor
            metadata={metadata}
            artworkPath={artworkPath}
            outputDir={outputDir}
            onMetadataChange={onUpdateMetadata}
            onArtworkChange={onArtworkChange}
            onOutputDirChange={onOutputDirChange}
            onImportCue={handleImportCue}
          />
        </div>
      </div>
    </div>
  );
}
