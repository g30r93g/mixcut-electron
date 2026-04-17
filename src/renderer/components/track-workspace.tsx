import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scissors, ArrowLeft } from 'lucide-react';
import { TrackWaveform, type TrackWaveformHandle } from './track-waveform';
import { TracklistEditor } from './tracklist-editor';
import { MetadataEditor } from './metadata-editor';
import { mixcut } from '../lib/mixcut-api';
import { parseCue } from '../../shared/parse-cue';
import type { CueTrack, AlbumMetadata } from '../../shared/types';

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
  onBack: () => void;
  disabled?: boolean;
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
  onBack,
  disabled,
}: TrackWorkspaceProps) {
  const waveformRef = useRef<TrackWaveformHandle | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const sortedTracks = useMemo(
    () => [...tracks].sort((a, b) => a.trackNumber - b.trackNumber),
    [tracks],
  );

  const handleWaveformClick = useCallback(() => {}, []);

  const renumber = useCallback(
    (list: CueTrack[]) =>
      [...list]
        .sort((a, b) => a.startMs - b.startMs)
        .map((t, i) => ({ ...t, trackNumber: i + 1 })),
    [],
  );

  const handleAddTrack = useCallback(
    (startMs: number | null) => {
      const lastStart = sortedTracks[sortedTracks.length - 1]?.startMs ?? 0;
      const newStart = startMs ?? (currentMs > 0 ? currentMs : sortedTracks.length > 0 ? lastStart + 60000 : 0);
      onUpdateTracks(
        renumber([
          ...tracks,
          {
            trackNumber: 0,
            title: '',
            performer: undefined,
            startMs: Math.round(newStart),
          },
        ]),
      );
    },
    [sortedTracks, tracks, onUpdateTracks, currentMs, renumber],
  );

  const handleUpdateTrack = useCallback(
    (index: number, patch: Partial<CueTrack>) => {
      const next = [...tracks];
      next[index] = { ...next[index], ...patch };
      onUpdateTracks('startMs' in patch ? renumber(next) : next);
    },
    [tracks, onUpdateTracks, renumber],
  );

  const handleRemoveTrack = useCallback(
    (index: number) => {
      onUpdateTracks(renumber(tracks.filter((_, i) => i !== index)));
    },
    [tracks, onUpdateTracks, renumber],
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
      // parsing failed
    }
  }, [metadata, onUpdateTracks, onUpdateMetadata]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

      // Add track: ⌘+Enter (works even in inputs)
      if (e.metaKey && e.key === 'Enter') {
        e.preventDefault();
        handleAddTrack(null);
        return;
      }

      // All other shortcuts are suppressed when typing in an input
      if (inInput) return;

      // Play/Pause: Space
      if (e.key === ' ') {
        e.preventDefault();
        waveformRef.current?.togglePlayback();
        return;
      }

      // Skip: Arrow keys (5s), Shift+Arrow (15s), ⌘+Arrow (30s)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const direction = e.key === 'ArrowLeft' ? -1 : 1;
        const seconds = e.metaKey ? 30 : e.shiftKey ? 15 : 5;
        waveformRef.current?.skip(direction * seconds);
        return;
      }

      // Zoom: ⌘+= / ⌘+-
      if (e.metaKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        waveformRef.current?.zoomBy(30);
        return;
      }
      if (e.metaKey && e.key === '-') {
        e.preventDefault();
        waveformRef.current?.zoomBy(-30);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleAddTrack]);

  const canCut = tracks.length > 0 && !disabled;

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-6 pt-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="no-drag flex size-7 items-center justify-center rounded-md
              text-text-muted transition-colors hover:bg-surface-light hover:text-text"
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.5} />
          </button>
          <div>
          <h2 className="text-sm font-semibold text-text">{metadata.title || audioName}</h2>
          {metadata.performer && (
            <p className="font-mono text-[10px] text-text-muted">{metadata.performer}</p>
          )}
          </div>
        </div>
        <button
          type="button"
          onClick={onCutTracks}
          disabled={!canCut}
          className="no-drag flex items-center gap-2 rounded-lg border border-accent-border
            bg-accent-bg px-4 py-2 font-mono text-xs text-accent-text
            transition-all hover:bg-accent-border/30
            disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Scissors className="size-3.5" strokeWidth={1.5} />
          <span className="font-medium">Cut Tracks</span>
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
        tracks={tracks}
      />

      {/* Bottom: tracklist + metadata */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px] gap-4 overflow-hidden">
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
