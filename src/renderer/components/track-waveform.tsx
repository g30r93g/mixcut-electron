import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
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

export const TrackWaveform = forwardRef<TrackWaveformHandle, TrackWaveformProps>(
  ({ audioPath, onDurationChange, onTimeUpdate, onWaveformClick, currentMs, durationMs, tracks, onSeek }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const regionsRef = useRef<RegionsPlugin | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [minPxPerSec, setMinPxPerSec] = useState(120);
    const minPxPerSecRef = useRef(minPxPerSec);

    const sortedTracks = useMemo(
      () => [...tracks].sort((a, b) => a.startMs - b.startMs),
      [tracks],
    );

    // Sync regions with tracks
    useEffect(() => {
      const regions = regionsRef.current;
      const instance = wavesurferRef.current;
      if (!regions || !instance || !isReady) return;

      const duration = instance.getDuration();
      if (duration <= 0) return;

      // Clear existing regions
      regions.clearRegions();

      // Add a region for each track
      sortedTracks.forEach((track, i) => {
        const nextStart = sortedTracks[i + 1]?.startMs ?? duration * 1000;
        const color = TRACK_COLORS[i % TRACK_COLORS.length];

        regions.addRegion({
          start: track.startMs / 1000,
          end: nextStart / 1000,
          color: color + '18', // ~10% opacity hex
          drag: false,
          resize: false,
        });
      });
    }, [sortedTracks, isReady, durationMs]);

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

      const regions = RegionsPlugin.create();
      regionsRef.current = regions;

      const instance = WaveSurfer.create({
        container,
        height: 120,
        waveColor: 'rgba(120, 160, 255, 0.35)',
        progressColor: 'rgba(120, 160, 255, 0.6)',
        cursorColor: 'rgba(255, 255, 255, 0.6)',
        cursorWidth: 1,
        normalize: true,
        barWidth: 2,
        minPxPerSec: minPxPerSecRef.current,
        barGap: 1,
        barRadius: 1,
        plugins: [
          TimelinePlugin.create({
            style: {
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'rgba(255, 255, 255, 0.2)',
            },
          }),
          regions,
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
        regionsRef.current = null;
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
