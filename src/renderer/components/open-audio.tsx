import { useCallback, useEffect, useRef, useState } from 'react';
import { Disc3, Clock, Trash2, Music } from 'lucide-react';
import { BorderBeam } from './ui/border-beam';
import { Button } from './ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './ui/context-menu';
import { useImageColors } from '../hooks/use-image-colors';
import { mixcut } from '../lib/mixcut-api';
import type { ProjectSummary } from '../../shared/types';
import logoSrc from '../../../resources/icon.png';

interface OpenAudioProps {
  onAudioSelected: (path: string, name: string, metadata?: { title?: string; artist?: string }) => void;
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

  const [discSpinning, setDiscSpinning] = useState(false);
  const [discStyle, setDiscStyle] = useState<React.CSSProperties>({});
  const discRef = useRef<SVGSVGElement>(null);

  const handleCardEnter = useCallback(() => {
    setDiscStyle({});
    setDiscSpinning(true);
  }, []);

  const handleCardLeave = useCallback(() => {
    const el = discRef.current;
    if (!el) return;
    const computed = getComputedStyle(el);
    const matrix = computed.transform;
    // Extract current angle from transform matrix
    let angle = 0;
    if (matrix && matrix !== 'none') {
      const values = matrix.match(/matrix\((.+)\)/)?.[1].split(', ');
      if (values) {
        angle = Math.atan2(parseFloat(values[1]), parseFloat(values[0])) * (180 / Math.PI);
        if (angle < 0) angle += 360;
      }
    }
    // Stop the animation and set current angle, then transition to nearest full rotation
    setDiscSpinning(false);
    const target = Math.ceil(angle / 360) * 360;
    setDiscStyle({ transform: `rotate(${angle}deg)`, transition: 'none' });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setDiscStyle({
          transform: `rotate(${target}deg)`,
          transition: 'transform 0.8s cubic-bezier(0.2, 0, 0.1, 1)',
        });
      });
    });
  }, []);

  const handleDeleteProject = useCallback(async (id: string) => {
    await mixcut.deleteProject(id);
    setRecentProjects((prev) => prev.filter((p) => p.id !== id));
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
        <div className="mb-8 flex flex-col items-center">
          <img src={logoSrc} alt="mixcut" className="mb-3 size-20" />
          <h1 className="text-[28px] font-semibold tracking-tight text-text">
            mixcut
          </h1>
          <p className="mt-1.5 font-mono text-[10px] tracking-[0.25em] text-text-muted uppercase">
            Audio Splitter
          </p>
        </div>

        {/* Drop zone */}
        <div
          className="relative"
          onMouseEnter={handleCardEnter}
          onMouseLeave={handleCardLeave}
        >
          <Button
            variant="accent"
            onClick={handleOpenFile}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`group h-auto w-full flex-col rounded-2xl px-9 py-11 text-center transition-all duration-200
              ${isDragOver ? 'border-accent/40 bg-accent/15' : ''}`}
          >
            <Disc3
              ref={discRef}
              className={`mb-4 size-9 transition-colors ${
                isDragOver ? 'text-accent' : 'text-accent/70 group-hover:text-accent'
              } ${discSpinning ? 'disc-spinning' : ''}`}
              style={discStyle}
              strokeWidth={1.5}
            />
            <p className="text-base font-medium text-text">Open an audio file</p>
            <p className="mt-1.5 font-mono text-[11px] text-text-muted">
              Drop .m4a here or click to browse
            </p>
          </Button>
          <BorderBeam color="rgba(120, 160, 255, 0.6)" speed={100} borderRadius="16px" active={discSpinning || isDragOver} />
        </div>

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <div className="mt-8">
            <div className="mb-2.5 flex items-center gap-2 px-1">
              <Clock className="size-3 text-text-faint" strokeWidth={1.5} />
              <span className="font-mono text-[9px] tracking-[0.2em] text-text-faint uppercase">
                Recent
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {recentProjects.slice(0, 5).map((project) => (
                <RecentProjectCard
                  key={project.id}
                  project={project}
                  formatDate={formatDate}
                  onSelect={() => onProjectSelected(project.id)}
                  onDelete={() => handleDeleteProject(project.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RecentProjectCard({
  project,
  formatDate,
  onSelect,
  onDelete,
}: {
  project: ProjectSummary;
  formatDate: (iso: string) => string;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const artworkUrl = project.artworkPath
    ? mixcut.getImageUrl(project.artworkPath)
    : undefined;
  const colors = useImageColors(artworkUrl, project.title || project.name);

  const style: React.CSSProperties = colors
    ? {
        backgroundColor: colors.bg,
        border: `0.5px solid ${colors.accent}25`,
      }
    : {
        border: '0.5px solid rgba(255, 255, 255, 0.06)',
      };

  const beamColor = colors?.accent ?? 'rgba(255, 255, 255, 0.15)';
  const beamHead = colors?.accentLight ?? undefined;
  const [hovered, setHovered] = useState(false);

  return (
    <ContextMenu>
      <ContextMenuTrigger
        className={`no-drag relative flex cursor-pointer items-center gap-3 rounded-[10px]
          px-3.5 py-2.5 text-left transition-all
          ${colors ? 'hover:brightness-125' : 'hover:bg-surface-light'}`}
        style={style}
        onClick={onSelect}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <BorderBeam color={beamColor} headColor={beamHead} speed={100} borderRadius="10px" active={hovered} />
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt=""
            className="size-9 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-light">
            <Music className="size-4 text-text-faint" strokeWidth={1.5} />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className="text-[13px]"
            style={colors ? { color: colors.text } : undefined}
          >
            {project.title || project.name}
          </span>
          {project.performer && (
            <span
              className="font-mono text-[10px]"
              style={colors ? { color: colors.textMuted } : undefined}
            >
              {project.performer}
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span
            className="font-mono text-[10px]"
            style={colors ? { color: colors.textMuted } : undefined}
          >
            {formatDate(project.updatedAt)}
          </span>
          <span
            className="font-mono text-[10px]"
            style={colors ? { color: colors.textMuted } : undefined}
          >
            {project.trackCount} {project.trackCount === 1 ? 'track' : 'tracks'}
          </span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem destructive onClick={onDelete}>
          <Trash2 className="size-3.5" strokeWidth={1.5} />
          Delete Project
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
