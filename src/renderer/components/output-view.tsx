import { FolderOpen, RotateCcw, CheckCircle2, AlertCircle, Music } from 'lucide-react';
import { mixcut } from '../lib/mixcut-api';
import type { CutProgress } from '../../shared/types';

interface DoneModalProps {
  progress: CutProgress | null;
  onNewSession: () => void;
}

export function DoneModal({ progress, onNewSession }: DoneModalProps) {
  const isComplete = progress?.stage === 'complete';
  const isError = progress?.stage === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-border-strong
        bg-surface px-14 py-10 shadow-2xl">
        {/* Icon */}
        {isComplete && (
          <div className="flex size-[52px] items-center justify-center rounded-full border border-green/20 bg-green/8">
            <CheckCircle2 className="size-[22px] text-green" strokeWidth={1.5} />
          </div>
        )}
        {isError && (
          <div className="flex size-[52px] items-center justify-center rounded-full border border-red/20 bg-red/8">
            <AlertCircle className="size-[22px] text-red" strokeWidth={1.5} />
          </div>
        )}

        {/* Text */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[17px] font-medium text-text">
            {isComplete ? 'Tracks ready' : 'Something went wrong'}
          </span>
          <span className="font-mono text-[11px] text-text-muted">
            {isComplete && 'All tracks saved to output directory'}
            {isError && progress.message}
          </span>
        </div>

        {/* Output path */}
        {isComplete && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface-light px-3.5 py-2">
            <Music className="size-3 text-text-muted" strokeWidth={1.5} />
            <span className="max-w-[250px] truncate font-mono text-[10px] text-text-muted">
              {progress.outputDir}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2.5 pt-1">
          {isComplete && (
            <button
              type="button"
              onClick={() => mixcut.openInFinder(progress.outputDir)}
              className="no-drag flex items-center gap-2 rounded-lg border border-accent/25
                bg-accent/10 px-[18px] py-[9px] text-xs font-medium text-accent
                transition-colors hover:bg-accent/20"
            >
              <FolderOpen className="size-[13px]" strokeWidth={1.5} />
              Open in Finder
            </button>
          )}
          <button
            type="button"
            onClick={onNewSession}
            className="no-drag flex items-center gap-2 rounded-lg border border-border-strong
              bg-surface-light px-[18px] py-[9px] text-xs font-medium text-text-secondary
              transition-colors hover:bg-border"
          >
            <RotateCcw className="size-[13px]" strokeWidth={1.5} />
            New Session
          </button>
        </div>
      </div>
    </div>
  );
}
