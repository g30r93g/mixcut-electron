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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-glass-border-strong
        bg-glass-card px-14 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        {/* Icon */}
        {isComplete && (
          <div className="flex size-[52px] items-center justify-center rounded-full border border-green-border bg-green-bg">
            <CheckCircle2 className="size-[22px] text-green" strokeWidth={1.5} />
          </div>
        )}
        {isError && (
          <div className="flex size-[52px] items-center justify-center rounded-full border border-[rgba(255,100,100,0.15)] bg-red-bg">
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
          <div className="flex items-center gap-2 rounded-md border border-glass-border bg-glass px-3.5 py-2">
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
              className="no-drag flex items-center gap-2 rounded-lg border border-accent-border
                bg-accent-bg px-[18px] py-[9px] text-xs font-medium text-accent-text
                transition-colors hover:bg-accent-border/30"
            >
              <FolderOpen className="size-[13px]" strokeWidth={1.5} />
              Open in Finder
            </button>
          )}
          <button
            type="button"
            onClick={onNewSession}
            className="no-drag flex items-center gap-2 rounded-lg border border-glass-border-strong
              bg-glass px-[18px] py-[9px] text-xs font-medium text-text-secondary
              transition-colors hover:bg-glass-hover"
          >
            <RotateCcw className="size-[13px]" strokeWidth={1.5} />
            New Session
          </button>
        </div>
      </div>
    </div>
  );
}
