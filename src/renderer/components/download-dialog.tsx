import { useCallback, useRef, useState } from 'react';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { useDownloadProgress } from '../hooks/use-download-progress';
import { mixcut } from '../lib/mixcut-api';

interface DownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (path: string, name: string, metadata: { title?: string; artist?: string }) => void;
}

export function DownloadDialog({ open, onOpenChange, onComplete }: DownloadDialogProps) {
  const [url, setUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { progress, reset: resetProgress } = useDownloadProgress();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDownload = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setError(null);
    setIsDownloading(true);
    resetProgress();

    try {
      const result = await mixcut.downloadAudio(trimmed);
      onComplete(result.path, result.name, result.metadata);
      // Reset state for next use
      setUrl('');
      setIsDownloading(false);
      resetProgress();
    } catch (err: any) {
      setError(err?.message ?? 'Download failed');
      setIsDownloading(false);
    }
  }, [url, onComplete, resetProgress]);

  const handleCancel = useCallback(() => {
    mixcut.cancelDownload();
    setIsDownloading(false);
    resetProgress();
    setError(null);
  }, [resetProgress]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isDownloading) {
        handleCancel();
      }
      if (!nextOpen) {
        setUrl('');
        setError(null);
        resetProgress();
        setIsDownloading(false);
      }
      onOpenChange(nextOpen);
    },
    [isDownloading, handleCancel, onOpenChange, resetProgress],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isDownloading && url.trim()) {
        handleDownload();
      }
    },
    [handleDownload, isDownloading, url],
  );

  const progressPercent =
    progress?.stage === 'downloading' ? progress.percent : null;
  const isConverting = progress?.stage === 'converting';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Download from URL</DialogTitle>
          <DialogDescription>
            Paste a YouTube or SoundCloud link
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-4">
          {/* URL input */}
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://..."
            disabled={isDownloading}
            autoFocus
            className="w-full rounded-lg border border-border bg-surface-light px-3 py-2 font-mono text-xs text-text
              placeholder:text-text-faint focus:border-accent/40 focus:outline-none
              disabled:opacity-50"
          />

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-400" strokeWidth={1.5} />
              <span className="font-mono text-[11px] text-red-400">{error}</span>
            </div>
          )}

          {/* Progress */}
          {isDownloading && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin text-accent" />
                <span className="font-mono text-[11px] text-text-muted">
                  {isConverting
                    ? 'Converting to m4a...'
                    : progressPercent !== null
                      ? `Downloading... ${progressPercent.toFixed(1)}%`
                      : 'Starting download...'}
                </span>
              </div>
              {progressPercent !== null && (
                <div className="h-[3px] w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {isDownloading ? (
              <Button variant="default" onClick={handleCancel}>
                Cancel
              </Button>
            ) : (
              <Button
                variant="accent"
                onClick={handleDownload}
                disabled={!url.trim()}
              >
                <Download className="size-3.5" strokeWidth={1.5} />
                Download
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
