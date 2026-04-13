import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import { Pause, Play, ZoomIn, ZoomOut } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { mixcut } from '../lib/mixcut-api';
import { formatTime } from '../lib/time';
import type { CueTrack } from '../../shared/types';

const TRACK_COLORS = [
  '#78a0ff',
  '#ff78a0',
  '#78ffa0',
  '#ffa078',
  '#a078ff',
  '#78fff0',
  '#ffdb78',
  '#ff7878',
  '#78c8ff',
  '#c878ff',
];

const DEFAULT_COLOR = 'rgba(120, 160, 255, 0.35)';

export type TrackWaveformHandle = {
  seekTo: (ms: number) => void;
};

interface TrackWaveformProps {
  audioPath: string;
  onDurationChange: (ms: number) => void;
  onTimeUpdate: (ms: number) => void;
  onWaveformClick?: (ms: number) => void;
  currentMs: number;
  durationMs: number;
  tracks: CueTrack[];
  onSeek: (ms: number) => void;
}

function getTrackColorAtTime(ms: number, sortedTracks: CueTrack[], durationMs: number): string {
  if (sortedTracks.length === 0) return DEFAULT_COLOR;
  for (let i = sortedTracks.length - 1; i >= 0; i--) {
    if (ms >= sortedTracks[i].startMs) {
      return TRACK_COLORS[i % TRACK_COLORS.length];
    }
  }
  return DEFAULT_COLOR;
}

export const TrackWaveform = forwardRef<TrackWaveformHandle, TrackWaveformProps>(
  ({ audioPath, onDurationChange, onTimeUpdate, onWaveformClick, currentMs, durationMs, tracks, onSeek }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [minPxPerSec, setMinPxPerSec] = useState(120);
    const minPxPerSecRef = useRef(minPxPerSec);
    const tracksRef = useRef(tracks);
    const durationMsRef = useRef(durationMs);

    const sortedTracks = useMemo(
      () => [...tracks].sort((a, b) => a.startMs - b.startMs),
      [tracks],
    );

    // Keep refs in sync for use inside renderFunction
    useEffect(() => {
      tracksRef.current = sortedTracks;
    }, [sortedTracks]);
    useEffect(() => {
      durationMsRef.current = durationMs;
    }, [durationMs]);

    // Re-render waveform when tracks change
    useEffect(() => {
      const instance = wavesurferRef.current;
      if (!instance || !isReady) return;
      // Force a re-render by calling drawBuffer
      const decodedData = instance.getDecodedData();
      if (decodedData) {
        instance.renderer.render(decodedData);
      }
    }, [sortedTracks, isReady]);

    useImperativeHandle(
      ref,
      () => ({
        seekTo: (ms: number) => {
          const instance = wavesurferRef.current;
          if (!instance || !isReady) return;
          const dur = instance.getDuration();
          if (dur <= 0) return;
          instance.setTime(Math.max(0, Math.min(ms / 1000, dur)));
          onTimeUpdate(ms);
        },
      }),
      [isReady, onTimeUpdate],
    );

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const instance = WaveSurfer.create({
        container,
        height: 120,
        waveColor: DEFAULT_COLOR,
        progressColor: 'rgba(255, 255, 255, 0.5)',
        cursorColor: 'rgba(255, 255, 255, 0.6)',
        cursorWidth: 1,
        normalize: true,
        barWidth: 2,
        minPxPerSec: minPxPerSecRef.current,
        barGap: 1,
        barRadius: 1,
        renderFunction: (peaks: (Float32Array | number[])[], ctx: CanvasRenderingContext2D) => {
          const { width, height } = ctx.canvas;
          const barWidth = 2;
          const barGap = 1;
          const step = barWidth + barGap;
          const halfHeight = height / 2;
          const data = peaks[0];
          if (!data) return;

          const dur = durationMsRef.current;
          const sorted = tracksRef.current;

          ctx.clearRect(0, 0, width, height);

          for (let x = 0; x < width; x += step) {
            const sampleIndex = Math.floor((x / width) * data.length);
            const value = Math.abs(data[sampleIndex] ?? 0);
            const barHeight = Math.max(1, value * halfHeight);

            // Determine time at this x position
            const timeMs = (x / width) * dur;
            const color = getTrackColorAtTime(timeMs, sorted, dur);

            ctx.fillStyle = color;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.roundRect(x, halfHeight - barHeight, barWidth, barHeight * 2, 1);
            ctx.fill();
          }
        },
        plugins: [
          TimelinePlugin.create({
            style: {
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'rgba(255, 255, 255, 0.2)',
            },
          }),
        ],
      });

      wavesurferRef.current = instance;

      instance.on('ready', () => {
        setIsReady(true);
        onDurationChange(instance.getDuration() * 1000);
      });

      const updateProgress = (time: number) => onTimeUpdate(time * 1000);
      instance.on('timeupdate', updateProgress);
      instance.on('audioprocess', updateProgress);
      instance.on('seeking', updateProgress);

      instance.on('interaction', (time: number) => {
        updateProgress(time);
        onWaveformClick?.(time * 1000);
      });

      instance.on('play', () => setIsPlaying(true));
      instance.on('pause', () => setIsPlaying(false));
      instance.on('finish', () => setIsPlaying(false));

      return () => {
        instance.destroy();
        wavesurferRef.current = null;
      };
    }, [onDurationChange, onTimeUpdate, onWaveformClick]);

    useEffect(() => {
      const instance = wavesurferRef.current;
      if (!instance || !audioPath) return;
      setIsReady(false);
      setIsPlaying(false);
      const url = mixcut.getAudioUrl(audioPath);
      instance.load(url);
    }, [audioPath]);

    useEffect(() => {
      const instance = wavesurferRef.current;
      if (!instance || !isReady) return;
      const delta = Math.abs(instance.getCurrentTime() - currentMs / 1000);
      if (!instance.isPlaying() && delta > 0.2) {
        instance.setTime(currentMs / 1000);
      }
    }, [currentMs, isReady]);

    const togglePlayback = useCallback(() => {
      const instance = wavesurferRef.current;
      if (!instance || !isReady) return;
      if (instance.isPlaying()) instance.pause();
      else void instance.play();
    }, [isReady]);

    useEffect(() => {
      minPxPerSecRef.current = minPxPerSec;
      const instance = wavesurferRef.current;
      if (!instance || !isReady) return;
      instance.zoom(minPxPerSec);
    }, [minPxPerSec, isReady]);

    const handleZoomChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
      setMinPxPerSec(Number(e.target.value));
    }, []);

    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="waveform-wrapper no-drag relative mb-10">
          <div ref={containerRef} className="relative h-[120px] w-full" />
        </div>

        <div className="no-drag flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlayback}
              disabled={!isReady}
              className="flex size-8 items-center justify-center rounded-full border border-border
                bg-surface-light transition-colors hover:border-border-strong
                disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPlaying ? (
                <Pause className="size-3 text-text" fill="currentColor" stroke="none" />
              ) : (
                <Play className="ml-0.5 size-3 text-text" fill="currentColor" stroke="none" />
              )}
            </button>
            <span className="font-mono text-[11px] text-text-muted">
              <span className="text-text-secondary">{formatTime(currentMs)}</span>
              <span className="mx-1 text-text-faint">/</span>
              {formatTime(durationMs)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ZoomOut className="size-3 text-text-faint" strokeWidth={1.5} />
            <input
              type="range"
              min={40}
              max={400}
              step={10}
              value={minPxPerSec}
              onChange={handleZoomChange}
              disabled={!isReady}
              className="no-drag h-[3px] w-20 cursor-pointer appearance-none rounded-full
                bg-border disabled:cursor-not-allowed disabled:opacity-40
                [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
            />
            <ZoomIn className="size-3 text-text-faint" strokeWidth={1.5} />
          </div>
        </div>
      </div>
    );
  },
);

TrackWaveform.displayName = 'TrackWaveform';
