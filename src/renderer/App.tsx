import { useCallback, useMemo, useState } from 'react';
import { OpenAudio } from './components/open-audio';
import { TrackWorkspace } from './components/track-workspace';
import { ProcessingView } from './components/processing-view';
import { OutputView } from './components/output-view';
import { useProject } from './hooks/use-project';
import { useCutProgress } from './hooks/use-cut-progress';
import { mixcut } from './lib/mixcut-api';
import type { OverallDetails } from '../shared/cue-builder';

type Step = 'open' | 'edit' | 'processing' | 'done';

export function App() {
  const {
    project,
    createProject,
    loadProject,
    updateTracks,
    updateMetadata,
    setArtworkPath,
    setOutputDir,
    reset,
  } = useProject();

  const progress = useCutProgress();
  const [step, setStep] = useState<Step>('open');

  const handleAudioSelected = useCallback(
    async (path: string, name: string) => {
      await createProject(path, name);
      setStep('edit');
    },
    [createProject],
  );

  const handleProjectSelected = useCallback(
    async (id: string) => {
      await loadProject(id);
      setStep('edit');
    },
    [loadProject],
  );

  const handleCutTracks = useCallback(async () => {
    if (!project) return;
    setStep('processing');

    const overallDetails: OverallDetails = {
      title: project.metadata.title,
      performer: project.metadata.performer,
      genre: project.metadata.genre ?? '',
      releaseYear: project.metadata.year ?? '',
    };

    try {
      await mixcut.cutTracks({
        audioPath: project.audioPath,
        tracks: project.tracks,
        metadata: overallDetails,
        artworkPath: project.artworkPath,
        outputDir: project.outputDir,
      });
      setStep('done');
    } catch {
      setStep('done');
    }
  }, [project]);

  const handleNewSession = useCallback(() => {
    reset();
    setStep('open');
  }, [reset]);

  // Determine actual step based on progress
  const effectiveStep = useMemo(() => {
    if (step === 'processing' && progress?.stage === 'complete') return 'done';
    if (step === 'processing' && progress?.stage === 'error') return 'done';
    return step;
  }, [step, progress]);

  return (
    <div className="flex h-full flex-col">
      {/* Title bar spacer for traffic lights */}
      <div className="h-11 shrink-0" />

      {/* Step indicator */}
      {effectiveStep !== 'open' && (
        <div className="flex shrink-0 items-center gap-1 px-5 pb-1">
          {(['open', 'edit', 'processing', 'done'] as const).map((s, i) => {
            const labels = ['Open', 'Edit', 'Process', 'Done'];
            const stepIndex = ['open', 'edit', 'processing', 'done'].indexOf(effectiveStep);
            const isActive = i === stepIndex;
            const isPast = i < stepIndex;
            return (
              <div key={s} className="flex items-center">
                {i > 0 && <div className="mx-2 h-px w-4 bg-paper-darker" />}
                <span
                  className={`font-mono text-[9px] tracking-widest uppercase ${
                    isActive
                      ? 'text-amber'
                      : isPast
                        ? 'text-ink-lighter'
                        : 'text-ink-faint'
                  }`}
                >
                  {labels[i]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="min-h-0 flex-1">
        {effectiveStep === 'open' && (
          <OpenAudio
            onAudioSelected={handleAudioSelected}
            onProjectSelected={handleProjectSelected}
          />
        )}

        {effectiveStep === 'edit' && project && (
          <TrackWorkspace
            audioPath={project.audioPath}
            audioName={project.name}
            tracks={project.tracks}
            metadata={project.metadata}
            artworkPath={project.artworkPath}
            outputDir={project.outputDir}
            onUpdateTracks={updateTracks}
            onUpdateMetadata={updateMetadata}
            onArtworkChange={setArtworkPath}
            onOutputDirChange={setOutputDir}
            onCutTracks={handleCutTracks}
          />
        )}

        {effectiveStep === 'processing' && <ProcessingView progress={progress} />}

        {effectiveStep === 'done' && (
          <OutputView progress={progress} onNewSession={handleNewSession} />
        )}
      </div>
    </div>
  );
}
