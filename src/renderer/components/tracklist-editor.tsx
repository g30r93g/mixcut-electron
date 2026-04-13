import { useCallback, useMemo } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
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
    <div className="rounded-lg border border-paper-darker bg-paper-dark/40">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-paper-darker px-5 py-3">
        <span className="font-mono text-[10px] tracking-widest text-ink-lighter uppercase">
          Tracklist
        </span>
        <button
          type="button"
          onClick={() => onAddTrack(null)}
          className="no-drag flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10px]
            tracking-wider text-ink-lighter uppercase transition-colors hover:bg-amber-faint hover:text-amber"
        >
          <Plus className="size-3" />
          Add Track
        </button>
      </div>

      {/* Track list */}
      {sortedTracks.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="font-serif text-sm text-ink-lighter italic">
            Click the waveform to add track markers, or import a .cue file
          </p>
        </div>
      ) : (
        <div className="divide-y divide-paper-darker">
          {sortedTracks.map((track) => {
            const idx = getOriginalIndex(track.trackNumber);
            const isActive = track.trackNumber === activeTrackNumber;
            const nextTrack = sortedTracks.find((t) => t.trackNumber > track.trackNumber);
            const endMs = nextTrack?.startMs ?? durationMs;
            const trackDuration = endMs - track.startMs;

            return (
              <div
                key={track.trackNumber}
                className={`no-drag group flex items-center gap-3 px-5 py-3 transition-colors ${
                  isActive ? 'bg-amber-faint' : 'hover:bg-paper-dark'
                }`}
              >
                {/* Grip + number */}
                <div className="flex items-center gap-2">
                  <GripVertical className="size-3 text-ink-faint opacity-0 group-hover:opacity-100" />
                  <button
                    type="button"
                    onClick={() => onSeek(track.startMs)}
                    className={`font-mono text-xs tabular-nums ${
                      isActive ? 'text-amber' : 'text-ink-faint hover:text-amber'
                    }`}
                  >
                    {track.trackNumber.toString().padStart(2, '0')}
                  </button>
                </div>

                {/* Title + performer */}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <input
                    type="text"
                    value={track.title}
                    onChange={(e) => onUpdateTrack(idx, { title: e.target.value })}
                    placeholder="Track title"
                    className="w-full border-none bg-transparent text-sm text-ink outline-none
                      placeholder:text-ink-faint"
                  />
                  <input
                    type="text"
                    value={track.performer ?? ''}
                    onChange={(e) => onUpdateTrack(idx, { performer: e.target.value || undefined })}
                    placeholder="Artist"
                    className="w-full border-none bg-transparent text-[11px] text-ink-lighter
                      outline-none placeholder:text-ink-faint"
                  />
                </div>

                {/* Time info */}
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-[10px] tabular-nums text-ink-lighter">
                    {formatTime(track.startMs)}
                  </span>
                  {trackDuration > 0 && (
                    <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                      {formatTime(trackDuration)}
                    </span>
                  )}
                </div>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => onRemoveTrack(idx)}
                  className="rounded p-1 text-ink-faint opacity-0 transition-all
                    hover:bg-red-faint hover:text-red group-hover:opacity-100"
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
