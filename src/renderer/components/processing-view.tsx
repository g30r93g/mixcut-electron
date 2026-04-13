import { Loader2 } from 'lucide-react';
import type { CutProgress } from '../../shared/types';

interface ProcessingModalProps {
  progress: CutProgress | null;
}

export function ProcessingModal({ progress }: ProcessingModalProps) {
  const stage = progress?.stage ?? 'cutting';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-glass-border-strong
        bg-glass-card px-14 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        {/* Icon */}
        <div className="flex size-[52px] items-center justify-center rounded-full border border-accent-border bg-accent-glow">
          {stage === 'cutting' ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(120,160,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="3"/><path d="M8.12 8.12L12 12"/><path d="M20 4L8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8L20 20"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(120,160,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          )}
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[17px] font-medium text-text">
            {stage === 'cutting' && 'Splitting audio'}
            {stage === 'tagging' && 'Tagging tracks'}
            {!progress && 'Processing...'}
          </span>
          <span className="font-mono text-[11px] text-text-muted">
            {stage === 'cutting' && (progress as any)?.message}
            {stage === 'tagging' && `Track ${(progress as any)?.trackNumber} of ${(progress as any)?.totalTracks}`}
            {!progress && 'Preparing...'}
          </span>
        </div>

        {/* Progress bar */}
        {stage === 'tagging' && progress?.stage === 'tagging' && (
          <div className="h-[3px] w-[180px] overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
            <div
              className="h-full rounded-full bg-accent-muted transition-all duration-300"
              style={{ width: `${(progress.trackNumber / progress.totalTracks) * 100}%` }}
            />
          </div>
        )}

        {stage === 'cutting' && (
          <Loader2 className="size-4 animate-spin text-text-faint" />
        )}
      </div>
    </div>
  );
}
