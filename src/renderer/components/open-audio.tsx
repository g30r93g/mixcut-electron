import { useCallback, useEffect, useState } from 'react';
import { Disc3, Clock } from 'lucide-react';
import { mixcut } from '../lib/mixcut-api';
import type { ProjectSummary } from '../../shared/types';

interface OpenAudioProps {
  onAudioSelected: (path: string, name: string) => void;
  onProjectSelected: (id: string) => void;
}

export function OpenAudio({ onAudioSelected, onProjectSelected }: OpenAudioProps) {
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    mixcut.listProjects().then(setRecentProjects);
  }, []);

  const handleOpenFile = useCallback(async () => {
    const result = await mixcut.openAudioFile();
    if (result) {
      onAudioSelected(result.path, result.name);
    }
  }, [onAudioSelected]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.m4a')) {
        onAudioSelected(file.path, file.name);
      }
    },
    [onAudioSelected],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-8">
      <div className="w-full max-w-[440px]">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-[28px] font-semibold tracking-tight text-text">
            mixcut
          </h1>
          <p className="mt-1.5 font-mono text-[10px] tracking-[0.25em] text-text-muted uppercase">
            Audio Splitter
          </p>
        </div>

        {/* Drop zone */}
        <button
          type="button"
          onClick={handleOpenFile}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            no-drag group flex w-full cursor-pointer flex-col items-center rounded-2xl
            border px-9 py-11 text-center transition-all duration-200
            ${
              isDragOver
                ? 'border-accent/25 bg-accent/10'
                : 'border-border bg-surface hover:border-border-strong hover:bg-surface-light'
            }
          `}
        >
          <Disc3
            className={`mb-4 size-9 transition-colors ${
              isDragOver ? 'text-accent' : 'text-text-muted group-hover:text-accent'
            }`}
            strokeWidth={1.5}
          />
          <p className="text-base font-medium text-text">Open an audio file</p>
          <p className="mt-1.5 font-mono text-[11px] text-text-muted">
            Drop .m4a here or click to browse
          </p>
        </button>

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <div className="mt-8">
            <div className="mb-2.5 flex items-center gap-2 px-1">
              <Clock className="size-3 text-text-faint" strokeWidth={1.5} />
              <span className="font-mono text-[9px] tracking-[0.2em] text-text-faint uppercase">
                Recent
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {recentProjects.slice(0, 5).map((project, i) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onProjectSelected(project.id)}
                  className={`no-drag flex items-center justify-between rounded-[10px]
                    px-3.5 py-2.5 text-left transition-colors hover:bg-surface-light
                    ${i === 0 ? 'border border-border bg-surface' : ''}`}
                >
                  <span className="text-[13px] text-text-secondary">{project.name}</span>
                  <span className="font-mono text-[10px] text-text-faint">
                    {formatDate(project.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
