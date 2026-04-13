import { useCallback, useEffect, useState } from 'react';
import { Disc3, FolderOpen, Clock } from 'lucide-react';
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
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="font-serif text-5xl tracking-tight text-ink">mixcut</h1>
          <p className="mt-2 font-mono text-xs tracking-widest text-ink-lighter uppercase">
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
            no-drag group w-full cursor-pointer rounded-lg border-2 border-dashed
            px-8 py-14 text-center transition-all duration-200
            ${
              isDragOver
                ? 'border-amber bg-amber-faint'
                : 'border-ink-faint hover:border-amber hover:bg-amber-faint/50'
            }
          `}
        >
          <Disc3
            className={`mx-auto mb-4 size-10 transition-colors ${
              isDragOver ? 'text-amber' : 'text-ink-lighter group-hover:text-amber'
            }`}
          />
          <p className="font-serif text-xl text-ink">Open an audio file</p>
          <p className="mt-1.5 font-mono text-xs text-ink-lighter">
            Drop an .m4a file here or click to browse
          </p>
        </button>

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <div className="mt-10">
            <div className="mb-3 flex items-center gap-2 text-ink-lighter">
              <Clock className="size-3.5" />
              <span className="font-mono text-[10px] tracking-widest uppercase">
                Recent Projects
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {recentProjects.slice(0, 5).map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onProjectSelected(project.id)}
                  className="no-drag group flex items-center justify-between rounded-md px-3 py-2.5
                    text-left transition-colors hover:bg-paper-dark"
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className="size-3.5 text-ink-faint group-hover:text-amber" />
                    <span className="text-sm text-ink-light">{project.name}</span>
                  </div>
                  <span className="font-mono text-[10px] text-ink-faint">
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
