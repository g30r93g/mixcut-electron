import { useCallback, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CueTrack } from '../../shared/types';
import { formatTime } from '../lib/time';

interface TracklistEditorProps {
  tracks: CueTrack[];
  currentMs: number;
  durationMs: number;
  onUpdateTrack: (index: number, patch: Partial<CueTrack>) => void;
  onRemoveTrack: (index: number) => void;
  onAddTrack: (startMs: number | null) => void;
  onSeek: (ms: number) => void;
}

export function TracklistEditor({
  tracks,
  currentMs,
  durationMs,
  onUpdateTrack,
  onRemoveTrack,
  onAddTrack,
  onSeek,
}: TracklistEditorProps) {
  const sortedTracks = useMemo(
    () => [...tracks].sort((a, b) => a.trackNumber - b.trackNumber),
    [tracks],
  );

  const activeTrackNumber = useMemo(() => {
    for (let i = sortedTracks.length - 1; i >= 0; i--) {
      if (currentMs >= sortedTracks[i].startMs) return sortedTracks[i].trackNumber;
    }
    return null;
  }, [currentMs, sortedTracks]);

  const getOriginalIndex = useCallback(
    (trackNumber: number) => tracks.findIndex((t) => t.trackNumber === trackNumber),
    [tracks],
  );

  return (
    <div className="rounded-xl border border-glass-border bg-glass overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-glass-border px-4 py-3">
        <span className="font-mono text-[9px] tracking-[0.2em] text-text-faint uppercase">
          Tracklist
        </span>
        <button
          type="button"
          onClick={() => onAddTrack(null)}
          className="no-drag flex items-center gap-1.5 rounded-md bg-glass-hover px-2.5 py-1
            font-mono text-[9px] tracking-[0.15em] text-text-muted uppercase
            transition-colors hover:bg-accent-bg hover:text-accent-text"
        >
          <Plus className="size-2.5" strokeWidth={2.5} />
          Add
        </button>
      </div>

      {/* Track list */}
      {sortedTracks.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-[13px] text-text-muted italic">
            Click the waveform to add track markers, or import a .cue file
          </p>
        </div>
      ) : (
        <div>
          {sortedTracks.map((track) => {
            const idx = getOriginalIndex(track.trackNumber);
            const isActive = track.trackNumber === activeTrackNumber;
            const nextTrack = sortedTracks.find((t) => t.trackNumber > track.trackNumber);
            const endMs = nextTrack?.startMs ?? durationMs;
            const trackDuration = endMs - track.startMs;

            return (
              <div
                key={track.trackNumber}
                className={`no-drag group flex items-center gap-3 border-b border-[rgba(255,255,255,0.04)]
                  px-4 py-2.5 transition-colors ${
                    isActive ? 'bg-accent-glow' : 'hover:bg-glass-hover'
                  }`}
              >
                {/* Number */}
                <button
                  type="button"
                  onClick={() => onSeek(track.startMs)}
                  className={`font-mono text-[11px] tabular-nums w-5 text-left ${
                    isActive ? 'text-accent-muted' : 'text-text-faint hover:text-accent-muted'
                  }`}
                >
                  {track.trackNumber.toString().padStart(2, '0')}
                </button>

                {/* Title + performer */}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <input
                    type="text"
                    value={track.title}
                    onChange={(e) => onUpdateTrack(idx, { title: e.target.value })}
                    placeholder="Track title"
                    className="w-full border-none bg-transparent text-[13px] text-text-secondary
                      outline-none placeholder:text-text-ghost"
                  />
                  <input
                    type="text"
                    value={track.performer ?? ''}
                    onChange={(e) => onUpdateTrack(idx, { performer: e.target.value || undefined })}
                    placeholder="Artist"
                    className="w-full border-none bg-transparent text-[11px] text-text-muted
                      outline-none placeholder:text-text-ghost"
                  />
                </div>

                {/* Time info */}
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-[10px] tabular-nums text-text-muted">
                    {formatTime(track.startMs)}
                  </span>
                  {trackDuration > 0 && (
                    <span className="font-mono text-[10px] tabular-nums text-text-ghost">
                      {formatTime(trackDuration)}
                    </span>
                  )}
                </div>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => onRemoveTrack(idx)}
                  className="rounded p-1 text-text-ghost opacity-0 transition-all
                    hover:bg-red-bg hover:text-red group-hover:opacity-100"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
