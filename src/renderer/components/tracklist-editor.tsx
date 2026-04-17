import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CueTrack } from '../../shared/types';
import { formatTime, parseTime } from '../lib/time';

interface TracklistEditorProps {
  tracks: CueTrack[];
  currentMs: number;
  durationMs: number;
  onUpdateTrack: (index: number, patch: Partial<CueTrack>) => void;
  onRemoveTrack: (index: number) => void;
  onAddTrack: (startMs: number | null) => void;
  onSeek: (ms: number) => void;
}

function StartTimeInput({ startMs, onChange }: { startMs: number; onChange: (ms: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(formatTime(startMs));
          setEditing(true);
        }}
        className="font-mono text-[10px] tabular-nums text-text-muted hover:text-accent transition-colors"
      >
        {formatTime(startMs)}
      </button>
    );
  }

  const commit = () => {
    const ms = parseTime(draft);
    if (ms !== null) onChange(ms);
    setEditing(false);
  };

  return (
    <input
      autoFocus
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
      className="w-14 border-none bg-transparent text-right font-mono text-[10px] tabular-nums
        text-text-muted outline-none ring-1 ring-accent/30 rounded px-1"
    />
  );
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

  const prevTrackCount = useRef(tracks.length);
  const lastTitleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (tracks.length > prevTrackCount.current) {
      // A track was added — focus its title on next render
      requestAnimationFrame(() => lastTitleRef.current?.focus());
    }
    prevTrackCount.current = tracks.length;
  }, [tracks.length]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <span className="font-mono text-[9px] tracking-[0.2em] text-text-faint uppercase">
          Tracklist
        </span>
        <button
          type="button"
          onClick={() => onAddTrack(null)}
          className="no-drag flex items-center gap-1.5 rounded-md bg-surface-light px-2.5 py-1
            font-mono text-[9px] tracking-[0.15em] text-text-muted uppercase
            transition-colors hover:bg-accent/10 hover:text-accent"
        >
          <Plus className="size-2.5" strokeWidth={2.5} />
          Add
        </button>
      </div>

      {sortedTracks.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-[13px] italic text-text-muted">
            Click the waveform to add track markers, or import a .cue file
          </p>
        </div>
      ) : (
        <div>
          {sortedTracks.map((track, sortedIdx) => {
            const idx = getOriginalIndex(track.trackNumber);
            const isActive = track.trackNumber === activeTrackNumber;
            const isLast = sortedIdx === sortedTracks.length - 1;
            const nextTrack = sortedTracks.find((t) => t.trackNumber > track.trackNumber);
            const endMs = nextTrack?.startMs ?? durationMs;
            const trackDuration = endMs - track.startMs;

            return (
              <div
                key={track.trackNumber}
                className={`no-drag group flex items-center gap-3 border-b border-border/50
                  px-4 py-2.5 transition-colors
                  ${isActive ? 'bg-accent/5' : 'hover:bg-surface-light'}`}
              >
                <button
                  type="button"
                  onClick={() => onSeek(track.startMs)}
                  className={`w-5 text-left font-mono text-[11px] tabular-nums
                    ${isActive ? 'text-accent' : 'text-text-faint hover:text-accent'}`}
                >
                  {track.trackNumber.toString().padStart(2, '0')}
                </button>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <input
                    ref={isLast ? lastTitleRef : undefined}
                    type="text"
                    value={track.title}
                    onChange={(e) => onUpdateTrack(idx, { title: e.target.value })}
                    placeholder="Track title"
                    className="w-full border-none bg-transparent text-[13px] text-text-secondary
                      outline-none placeholder:text-text-faint"
                  />
                  <input
                    type="text"
                    value={track.performer ?? ''}
                    onChange={(e) => onUpdateTrack(idx, { performer: e.target.value || undefined })}
                    placeholder="Artist"
                    className="w-full border-none bg-transparent text-[11px] text-text-muted
                      outline-none placeholder:text-text-faint"
                  />
                </div>

                <div className="flex flex-col items-end gap-0.5">
                  <StartTimeInput
                    startMs={track.startMs}
                    onChange={(ms) => onUpdateTrack(idx, { startMs: ms })}
                  />
                  {trackDuration > 0 && (
                    <span className="font-mono text-[10px] tabular-nums text-text-faint">
                      {formatTime(trackDuration)}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveTrack(idx)}
                  className="rounded p-1 text-text-faint opacity-0 transition-all
                    hover:bg-red/10 hover:text-red group-hover:opacity-100"
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
