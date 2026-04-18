import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scissors, ArrowLeft, ListMusic, Disc, Copy, Check, CheckCircle2, FolderOpen, FileUp } from 'lucide-react';
import { TrackWaveform, type TrackWaveformHandle } from './track-waveform';
import { TracklistEditor } from './tracklist-editor';
import { MetadataEditor } from './metadata-editor';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Kbd } from './ui/kbd';
import { mixcut } from '../lib/mixcut-api';
import { formatTime } from '../lib/time';
import { parseCue } from '../../shared/parse-cue';
import { buildCueString } from '../../shared/cue-builder';
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
  lastSavedAt: Date | null;
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
  lastSavedAt,
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

  const canCut = tracks.length > 0 && !disabled;

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

      // Play/Pause: ⌘+Space
      if (e.metaKey && e.key === ' ') {
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

      // Cut Tracks: ⇧⌘E
      if (e.metaKey && e.shiftKey && e.key === 'e') {
        e.preventDefault();
        if (canCut) onCutTracks();
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
  }, [handleAddTrack, canCut, onCutTracks]);

  const [showTimestamps, setShowTimestamps] = useState(false);
  const [copied, setCopied] = useState(false);

  const timestampText = useMemo(() => {
    return sortedTracks
      .map((t) => {
        const totalSeconds = Math.floor(t.startMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const time = hours > 0
          ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
          : `${minutes}:${String(seconds).padStart(2, '0')}`;
        const name = t.title || `Track ${t.trackNumber}`;
        const artist = t.performer?.trim();
        return `${time} ${name}${artist ? ` - ${artist}` : ''}`;
      })
      .join('\n');
  }, [sortedTracks]);

  const handleCopyTimestamps = useCallback(() => {
    navigator.clipboard.writeText(timestampText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [timestampText]);

  const [savedCuePath, setSavedCuePath] = useState<string | null>(null);

  const handleSaveCue = useCallback(async () => {
    const cue = buildCueString({
      entries: sortedTracks,
      overallDetails: {
        title: metadata.title || '',
        performer: metadata.performer || '',
        genre: metadata.genre || '',
        releaseYear: metadata.year || '',
      },
      audioFileName: audioName,
    });
    if (!cue) return;
    const baseName = (metadata.title || audioName).replace(/\.[^.]+$/, '');
    const filePath = `${outputDir}/${baseName}.cue`;
    try {
      await mixcut.saveCueFile(filePath, cue);
      setSavedCuePath(filePath);
    } catch {
      // save failed — directory may not exist yet
    }
  }, [sortedTracks, metadata, audioName, outputDir]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Main content */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 pt-4 pb-4">

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="size-3.5" strokeWidth={1.5} />
          </Button>
          <div>
          <h2 className="text-sm font-semibold text-text">{metadata.title || audioName}</h2>
          {metadata.performer && (
            <p className="font-mono text-[10px] text-text-muted">{metadata.performer}</p>
          )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleImportCue}>
            <FileUp className="size-3.5" strokeWidth={1.5} />
            Load .CUE
          </Button>
          <Button onClick={() => setShowTimestamps(true)} disabled={tracks.length === 0}>
            <ListMusic className="size-3.5" strokeWidth={1.5} />
            YouTube Timestamps
          </Button>
          <Button onClick={handleSaveCue} disabled={tracks.length === 0}>
            <Disc className="size-3.5" strokeWidth={1.5} />
            Save .CUE
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="accent" onClick={onCutTracks} disabled={!canCut}>
                <Scissors className="size-3.5" strokeWidth={1.5} />
                Cut Tracks
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span className="flex items-center gap-1.5">Split audio into individual tracks <Kbd>⇧</Kbd><Kbd>⌘</Kbd><Kbd>E</Kbd></span>
            </TooltipContent>
          </Tooltip>
        </div>
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
        <TracklistEditor
          tracks={tracks}
          currentMs={currentMs}
          durationMs={durationMs}
          onUpdateTrack={handleUpdateTrack}
          onRemoveTrack={handleRemoveTrack}
          onAddTrack={handleAddTrack}
          onSeek={handleSeek}
        />
        <div className="overflow-y-auto">
          <MetadataEditor
            metadata={metadata}
            artworkPath={artworkPath}
            outputDir={outputDir}
            onMetadataChange={onUpdateMetadata}
            onArtworkChange={onArtworkChange}
            onOutputDirChange={onOutputDirChange}
          />
        </div>
      </div>
      </div>

      {/* Status bar */}
      <div className="flex shrink-0 items-center justify-between border-t border-border bg-surface px-6 py-2.5">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] text-text-muted">
            {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
          </span>
          {durationMs > 0 && (
            <span className="font-mono text-[10px] text-text-muted">
              {formatTime(durationMs)}
            </span>
          )}
        </div>
        {lastSavedAt && (
          <span className="font-mono text-[10px] text-text-muted">
            Saved at {lastSavedAt.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* CUE saved confirmation dialog */}
      <Dialog open={!!savedCuePath} onOpenChange={(open) => !open && setSavedCuePath(null)}>
        <DialogContent className="flex flex-col items-center gap-5 px-14 py-10">
          <div className="flex size-[52px] items-center justify-center rounded-full border border-green/20 bg-green/8">
            <CheckCircle2 className="size-[22px] text-green" strokeWidth={1.5} />
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[17px] font-medium text-text">CUE sheet saved</span>
            <span className="font-mono text-[11px] text-text-muted">Saved to export directory</span>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border bg-surface-light px-3.5 py-2">
            <Disc className="size-3 shrink-0 text-text-muted" strokeWidth={1.5} />
            <span className="max-w-[250px] truncate font-mono text-[10px] text-text-muted">
              {savedCuePath}
            </span>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <Button
              variant="accent"
              onClick={() => {
                if (savedCuePath) {
                  const dir = savedCuePath.substring(0, savedCuePath.lastIndexOf('/'));
                  mixcut.openInFinder(dir);
                }
              }}
            >
              <FolderOpen className="size-[13px]" strokeWidth={1.5} />
              Show in Finder
            </Button>
            <Button onClick={() => setSavedCuePath(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* YouTube Timestamps dialog */}
      <Dialog open={showTimestamps} onOpenChange={setShowTimestamps}>
        <DialogContent className="flex flex-col items-center gap-5 px-14 py-10">
          <div className="flex size-[52px] items-center justify-center rounded-full border border-accent/20 bg-accent/8">
            <ListMusic className="size-[22px] text-accent" strokeWidth={1.5} />
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[17px] font-medium text-text">YouTube Timestamps</span>
            <span className="font-mono text-[11px] text-text-muted">Copy and paste into a YouTube description/comment</span>
          </div>

          <textarea
            readOnly
            value={timestampText}
            className="h-48 w-full resize-none rounded-lg border border-border bg-surface-light
              p-3 font-mono text-[11px] text-text-muted focus:outline-none"
          />

          <div className="flex items-center gap-2.5 pt-1">
            <Button variant="accent" onClick={handleCopyTimestamps}>
              {copied ? (
                <>
                  <Check className="size-[13px]" strokeWidth={1.5} />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="size-[13px]" strokeWidth={1.5} />
                  Copy to Clipboard
                </>
              )}
            </Button>
            <Button onClick={() => setShowTimestamps(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
