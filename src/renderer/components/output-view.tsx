import { FolderOpen, Music, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { mixcut } from '../lib/mixcut-api';
import type { CutProgress } from '../../shared/types';

interface OutputViewProps {
  progress: CutProgress | null;
  onNewSession: () => void;
}

export function OutputView({ progress, onNewSession }: OutputViewProps) {
  const isComplete = progress?.stage === 'complete';
  const isError = progress?.stage === 'error';

  return (
    <div className="flex h-full flex-col items-center justify-center px-8">
      <div className="w-full max-w-md text-center">
        {/* Status icon */}
        <div className="mb-6 flex justify-center">
          {isComplete && (
            <div className="flex size-16 items-center justify-center rounded-full bg-green-faint">
              <CheckCircle2 className="size-8 text-green" />
            </div>
          )}
          {isError && (
            <div className="flex size-16 items-center justify-center rounded-full bg-red-faint">
              <AlertCircle className="size-8 text-red" />
            </div>
          )}
        </div>

        <h2 className="font-serif text-3xl text-ink">
          {isComplete ? 'Tracks ready' : 'Something went wrong'}
        </h2>

        {isComplete && (
          <p className="mt-2 font-mono text-xs text-ink-lighter">
            Your tracks have been saved to the output directory
          </p>
        )}

        {isError && (
          <p className="mt-2 font-mono text-xs text-red">{progress.message}</p>
        )}

        {/* Output directory */}
        {isComplete && (
          <div className="mx-auto mt-8 flex items-center justify-center gap-2 rounded-md
            border border-paper-darker bg-paper-dark px-4 py-2.5">
            <Music className="size-3.5 text-ink-faint" />
            <span className="max-w-xs truncate font-mono text-[11px] text-ink-lighter">
              {progress.outputDir}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex items-center justify-center gap-3">
          {isComplete && (
            <button
              type="button"
              onClick={() => mixcut.openInFinder(progress.outputDir)}
              className="no-drag flex items-center gap-2 rounded-md bg-ink px-5 py-2.5 font-mono
                text-xs tracking-wider text-paper uppercase transition-colors hover:bg-ink-light"
            >
              <FolderOpen className="size-3.5" />
              Open in Finder
            </button>
          )}

          <button
            type="button"
            onClick={onNewSession}
            className="no-drag flex items-center gap-2 rounded-md border border-paper-darker px-5
              py-2.5 font-mono text-xs tracking-wider text-ink-lighter uppercase
              transition-colors hover:border-amber hover:bg-amber-faint hover:text-amber"
          >
            <RotateCcw className="size-3.5" />
            New Session
          </button>
        </div>
      </div>
    </div>
  );
}
