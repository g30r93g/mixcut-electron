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
}

export function MetadataEditor({
  metadata,
  artworkPath,
  outputDir,
  onMetadataChange,
  onArtworkChange,
  onOutputDirChange,
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
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] text-text-muted uppercase">
          Album Details
        </span>
      </div>

      <div className="flex flex-col gap-3.5 p-4">
        {/* Artwork */}
        <button
          type="button"
          onClick={handlePickArtwork}
          className="no-drag group relative flex size-20 items-center justify-center overflow-hidden
            rounded-lg border border-border bg-surface-light transition-colors
            hover:border-border-strong"
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
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5
                  opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-2.5 text-white" />
              </button>
            </>
          ) : (
            <Image className="size-5 text-text-faint group-hover:text-accent" strokeWidth={1.5} />
          )}
        </button>

        <Field label="Title" value={metadata.title} onChange={(v) => updateField('title', v)} placeholder="Album title" />
        <Field label="Artist" value={metadata.performer} onChange={(v) => updateField('performer', v)} placeholder="Artist name" />
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Genre" value={metadata.genre ?? ''} onChange={(v) => updateField('genre', v)} placeholder="Electronic" />
          <Field label="Year" value={metadata.year ?? ''} onChange={(v) => updateField('year', v)} placeholder="2024" />
        </div>

        {/* Output dir */}
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-2">
          <FolderOpen className="size-3 shrink-0 text-text-faint" strokeWidth={1.5} />
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-text-muted" title={outputDir}>
            {outputDir}
          </span>
          <button
            type="button"
            onClick={handlePickOutputDir}
            className="no-drag shrink-0 font-mono text-[9px] text-accent transition-colors hover:text-accent-dim"
          >
            Change
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
      <span className="font-mono text-[10px] tracking-[0.15em] text-text-muted uppercase">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-border bg-surface px-2.5 py-2 text-[13px] text-text-secondary
          outline-none transition-colors placeholder:text-text-faint focus:border-accent/40"
      />
    </label>
  );
}
