import { useCallback } from 'react';
import { Image, FolderOpen, X } from 'lucide-react';
import { mixcut } from '../lib/mixcut-api';
import type { AlbumMetadata } from '../../shared/types';

interface MetadataEditorProps {
  metadata: AlbumMetadata;
  artworkPath?: string;
  outputDir: string;
  onMetadataChange: (metadata: AlbumMetadata) => void;
  onArtworkChange: (path: string | undefined) => void;
  onOutputDirChange: (dir: string) => void;
  onImportCue: () => void;
}

export function MetadataEditor({
  metadata,
  artworkPath,
  outputDir,
  onMetadataChange,
  onArtworkChange,
  onOutputDirChange,
  onImportCue,
}: MetadataEditorProps) {
  const updateField = useCallback(
    (field: keyof AlbumMetadata, value: string) => {
      onMetadataChange({ ...metadata, [field]: value });
    },
    [metadata, onMetadataChange],
  );

  const handlePickArtwork = useCallback(async () => {
    const result = await mixcut.openImageFile();
    if (result) onArtworkChange(result.path);
  }, [onArtworkChange]);

  const handlePickOutputDir = useCallback(async () => {
    const dir = await mixcut.selectOutputDir();
    if (dir) onOutputDirChange(dir);
  }, [onOutputDirChange]);

  return (
    <div className="rounded-lg border border-paper-darker bg-paper-dark/40">
      <div className="border-b border-paper-darker px-5 py-3">
        <span className="font-mono text-[10px] tracking-widest text-ink-lighter uppercase">
          Album Details
        </span>
      </div>

      <div className="p-5">
        <div className="flex gap-5">
          {/* Artwork */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handlePickArtwork}
              className="no-drag group relative flex size-24 items-center justify-center overflow-hidden
                rounded-md border border-paper-darker bg-paper-dark transition-colors
                hover:border-amber"
            >
              {artworkPath ? (
                <>
                  <img
                    src={mixcut.getImageUrl(artworkPath)}
                    alt="Cover artwork"
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onArtworkChange(undefined);
                    }}
                    className="absolute right-0.5 top-0.5 rounded-full bg-ink/60 p-0.5 text-paper
                      opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="size-2.5" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 text-ink-faint group-hover:text-amber">
                  <Image className="size-5" />
                  <span className="font-mono text-[8px] uppercase">Artwork</span>
                </div>
              )}
            </button>
          </div>

          {/* Fields */}
          <div className="flex flex-1 flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Title"
                value={metadata.title}
                onChange={(v) => updateField('title', v)}
                placeholder="Album title"
              />
              <Field
                label="Artist"
                value={metadata.performer}
                onChange={(v) => updateField('performer', v)}
                placeholder="Artist name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Genre"
                value={metadata.genre ?? ''}
                onChange={(v) => updateField('genre', v)}
                placeholder="Electronic, Rock..."
              />
              <Field
                label="Year"
                value={metadata.year ?? ''}
                onChange={(v) => updateField('year', v)}
                placeholder="2024"
              />
            </div>
          </div>
        </div>

        {/* Output dir + CUE import */}
        <div className="mt-4 flex items-center gap-3 border-t border-paper-darker pt-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FolderOpen className="size-3.5 shrink-0 text-ink-faint" />
            <span className="truncate font-mono text-[10px] text-ink-lighter" title={outputDir}>
              {outputDir}
            </span>
            <button
              type="button"
              onClick={handlePickOutputDir}
              className="no-drag shrink-0 rounded px-2 py-0.5 font-mono text-[10px] text-ink-lighter
                transition-colors hover:bg-amber-faint hover:text-amber"
            >
              Change
            </button>
          </div>

          <button
            type="button"
            onClick={onImportCue}
            className="no-drag shrink-0 rounded-md border border-paper-darker px-3 py-1.5
              font-mono text-[10px] tracking-wider text-ink-lighter uppercase
              transition-colors hover:border-amber hover:bg-amber-faint hover:text-amber"
          >
            Import .cue
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="no-drag flex flex-col gap-1">
      <span className="font-mono text-[9px] tracking-widest text-ink-faint uppercase">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-paper-darker bg-paper px-2.5 py-1.5 text-sm text-ink
          outline-none transition-colors placeholder:text-ink-faint focus:border-amber"
      />
    </label>
  );
}
