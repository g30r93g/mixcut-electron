import { Loader2, CheckCircle2, AlertCircle, Scissors, Tag } from 'lucide-react';
import type { CutProgress } from '../../shared/types';

interface ProcessingViewProps {
  progress: CutProgress | null;
}

export function ProcessingView({ progress }: ProcessingViewProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8">
      <div className="w-full max-w-sm text-center">
        {/* Icon */}
        <div className="mb-8 flex justify-center">
          {(!progress || progress.stage === 'cutting') && (
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-amber/20" />
              <div className="relative flex size-16 items-center justify-center rounded-full bg-amber-faint">
                <Scissors className="size-7 text-amber" />
              </div>
            </div>
          )}
          {progress?.stage === 'tagging' && (
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-amber/20" />
              <div className="relative flex size-16 items-center justify-center rounded-full bg-amber-faint">
                <Tag className="size-7 text-amber" />
              </div>
            </div>
          )}
          {progress?.stage === 'complete' && (
            <div className="flex size-16 items-center justify-center rounded-full bg-green-faint">
              <CheckCircle2 className="size-7 text-green" />
            </div>
          )}
          {progress?.stage === 'error' && (
            <div className="flex size-16 items-center justify-center rounded-full bg-red-faint">
              <AlertCircle className="size-7 text-red" />
            </div>
          )}
        </div>

        {/* Status text */}
        <h2 className="font-serif text-2xl text-ink">
          {!progress && 'Processing...'}
          {progress?.stage === 'cutting' && 'Splitting audio'}
          {progress?.stage === 'tagging' && 'Tagging tracks'}
          {progress?.stage === 'complete' && 'Complete'}
          {progress?.stage === 'error' && 'Error'}
        </h2>

        <p className="mt-2 font-mono text-xs text-ink-lighter">
          {!progress && 'Preparing to process...'}
          {progress?.stage === 'cutting' && progress.message}
          {progress?.stage === 'tagging' &&
            `Track ${progress.trackNumber} of ${progress.totalTracks}`}
          {progress?.stage === 'complete' && 'All tracks have been processed'}
          {progress?.stage === 'error' && progress.message}
        </p>

        {/* Progress bar for tagging */}
        {progress?.stage === 'tagging' && (
          <div className="mx-auto mt-6 h-1 w-48 overflow-hidden rounded-full bg-paper-darker">
            <div
              className="h-full rounded-full bg-amber transition-all duration-300"
              style={{
                width: `${(progress.trackNumber / progress.totalTracks) * 100}%`,
              }}
            />
          </div>
        )}

        {/* Spinner for active states */}
        {progress && (progress.stage === 'cutting' || progress.stage === 'tagging') && (
          <Loader2 className="mx-auto mt-6 size-4 animate-spin text-ink-faint" />
        )}
      </div>
    </div>
  );
}
