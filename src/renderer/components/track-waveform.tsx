import { Loader2, Pause, Play, ZoomIn, ZoomOut, SkipBack, SkipForward } from 'lucide-react';
import { Button } from './ui/button';
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
import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Kbd } from './ui/kbd';
import type { CueTrack } from '../../shared/types';
import { mixcut } from '../lib/mixcut-api';
import { formatTime } from '../lib/time';

const MARKER_COLOR = 'rgba(255, 80, 80, 0.7)';

export type TrackWaveformHandle = {
  seekTo: (ms: number) => void;
  togglePlayback: () => void;
  skip: (seconds: number) => void;
  zoomBy: (delta: number) => void;
};

interface TrackWaveformProps {
  audioPath: string;
  onDurationChange: (ms: number) => void;
  onTimeUpdate: (ms: number) => void;
  onWaveformClick?: (ms: number) => void;
  currentMs: number;
  durationMs: number;
  tracks: CueTrack[];
}

export const TrackWaveform = forwardRef<TrackWaveformHandle, TrackWaveformProps>(
  ({ audioPath, onDurationChange, onTimeUpdate, onWaveformClick, currentMs, durationMs, tracks }, ref) => {
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

    // Sync track markers with regions
    useEffect(() => {
      const regions = regionsRef.current;
      const instance = wavesurferRef.current;
      if (!regions || !instance || !isReady) return;

      const duration = instance.getDuration();
      if (duration <= 0) return;

      regions.clearRegions();

      sortedTracks.forEach((track) => {
        if (track.startMs <= 0) return; // skip marker at 0:00

        regions.addRegion({
          start: track.startMs / 1000,
          content: '',
          color: MARKER_COLOR,
          drag: false,
          resize: false,
        });
      });
    }, [sortedTracks, isReady, durationMs]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const regions = RegionsPlugin.create();
      regionsRef.current = regions;

      const instance = WaveSurfer.create({
        container,
        height: 120,
        waveColor: 'rgba(120, 160, 255, 0.4)',
        progressColor: 'rgba(120, 160, 255, 0.7)',
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

    const skip = useCallback((seconds: number) => {
      const instance = wavesurferRef.current;
      if (!instance || !isReady) return;
      const dur = instance.getDuration();
      const newTime = Math.max(0, Math.min(instance.getCurrentTime() + seconds, dur));
      instance.setTime(newTime);
      onTimeUpdate(newTime * 1000);
    }, [isReady, onTimeUpdate]);

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
        togglePlayback: () => togglePlayback(),
        skip: (seconds: number) => skip(seconds),
        zoomBy: (delta: number) => setMinPxPerSec((prev) => Math.max(5, Math.min(400, prev + delta))),
      }),
      [isReady, onTimeUpdate, togglePlayback, skip],
    );

    const handleZoomChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
      setMinPxPerSec(Number(e.target.value));
    }, []);

    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="waveform-wrapper no-drag relative mb-10">
          <div ref={containerRef} className="relative h-30 w-full" />
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-8 animate-spin text-text-muted" strokeWidth={1.5} />
            </div>
          )}
        </div>

        <div className="no-drag flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePlayback}
                  disabled={!isReady}
                  className="size-8 rounded-full border border-border bg-surface-light hover:border-border-strong"
                >
                  {isPlaying ? (
                    <Pause className="size-3 shrink-0 text-text" fill="currentColor" stroke="none" />
                  ) : (
                    <Play className="ml-0.5 size-3 shrink-0 text-text" fill="currentColor" stroke="none" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span className="flex items-center gap-1.5">{isPlaying ? 'Pause' : 'Play'} <Kbd>⌘</Kbd><Kbd>Space</Kbd></span>
              </TooltipContent>
            </Tooltip>
            <span className="font-mono text-[11px] text-text-muted">
              <span className="text-text-secondary">{formatTime(currentMs)}</span>
              <span className="mx-1 text-text-faint">/</span>
              {formatTime(durationMs)}
            </span>

            <div className="flex items-center gap-0.5">
              {([30, 15, 5] as const).map((s) => {
                const mod = s === 30 ? '⌘' : s === 15 ? '⇧' : undefined;
                return (
                  <Tooltip key={`back-${s}`}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => skip(-s)}
                        disabled={!isReady}
                        className="relative text-text-faint hover:text-text-secondary"
                      >
                        <SkipBack className="size-3" strokeWidth={1.5} />
                        <span className="absolute -bottom-0.5 font-mono text-[7px]">{s}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <span className="flex items-center gap-1.5">
                        Back {s}s {mod && <Kbd>{mod}</Kbd>}<Kbd>←</Kbd>
                      </span>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {([5, 15, 30] as const).map((s) => {
                const mod = s === 30 ? '⌘' : s === 15 ? '⇧' : undefined;
                return (
                  <Tooltip key={`fwd-${s}`}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => skip(s)}
                        disabled={!isReady}
                        className="relative text-text-faint hover:text-text-secondary"
                      >
                        <SkipForward className="size-3" strokeWidth={1.5} />
                        <span className="absolute -bottom-0.5 font-mono text-[7px]">{s}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <span className="flex items-center gap-1.5">
                        Forward {s}s {mod && <Kbd>{mod}</Kbd>}<Kbd>→</Kbd>
                      </span>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <ZoomOut className="size-3 text-text-faint" strokeWidth={1.5} />
                <input
                  type="range"
                  min={5}
                  max={400}
                  step={10}
                  value={minPxPerSec}
                  onChange={handleZoomChange}
                  disabled={!isReady}
                  className="no-drag h-0.75 w-20 cursor-pointer appearance-none rounded-full
                    bg-border disabled:cursor-not-allowed disabled:opacity-40
                    [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
                />
                <ZoomIn className="size-3 text-text-faint" strokeWidth={1.5} />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <span className="flex items-center gap-1.5">Zoom <Kbd>⌘</Kbd><Kbd>-</Kbd> / <Kbd>⌘</Kbd><Kbd>+</Kbd></span>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  },
);

TrackWaveform.displayName = 'TrackWaveform';
