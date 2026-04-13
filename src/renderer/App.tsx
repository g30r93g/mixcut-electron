import { useCallback, useMemo, useState } from 'react';
import { OpenAudio } from './components/open-audio';
import { TrackWorkspace } from './components/track-workspace';
import { ProcessingModal } from './components/processing-view';
import { DoneModal } from './components/output-view';
import { useProject } from './hooks/use-project';
import { useCutProgress } from './hooks/use-cut-progress';
import { mixcut } from './lib/mixcut-api';
import type { OverallDetails } from '../shared/cue-builder';

type Step = 'open' | 'edit' | 'processing' | 'done';

const STEP_LABELS = ['Open', 'Edit', 'Process', 'Done'] as const;
const STEP_KEYS: Step[] = ['open', 'edit', 'processing', 'done'];

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

  // Derive effective step from progress
  const effectiveStep = useMemo(() => {
    if (step === 'processing' && (progress?.stage === 'complete' || progress?.stage === 'error')) {
      return 'done';
    }
    return step;
  }, [step, progress]);

  const showWorkspace = effectiveStep !== 'open';
  const showProcessingModal = effectiveStep === 'processing';
  const showDoneModal = effectiveStep === 'done';

  return (
    <div className="flex h-full flex-col">
      {/* Title bar spacer */}
      <div className="h-11 shrink-0" />

      {/* Step indicator — only visible when past the open screen */}
      {showWorkspace && (
        <div className="flex shrink-0 items-center gap-1.5 px-6 pb-1">
          {STEP_KEYS.map((s, i) => {
            const stepIndex = STEP_KEYS.indexOf(effectiveStep);
            const isActive = i === stepIndex;
            const isPast = i < stepIndex;
            return (
              <div key={s} className="flex items-center">
                {i > 0 && (
                  <span className="mx-1.5 font-mono text-[9px] text-text-faint">—</span>
                )}
                <div className="flex items-center gap-1.5">
                  <div
                    className={`size-[5px] rounded-full ${
                      isActive ? 'bg-accent' : isPast ? 'bg-accent-dim' : 'bg-text-faint'
                    }`}
                  />
                  <span
                    className={`font-mono text-[9px] tracking-[0.15em] uppercase ${
                      isActive ? 'text-accent' : isPast ? 'text-text-muted' : 'text-text-faint'
                    }`}
                  >
                    {STEP_LABELS[i]}
                  </span>
                </div>
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

        {showWorkspace && project && (
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
            disabled={showProcessingModal || showDoneModal}
          />
        )}
      </div>

      {/* Modal overlays */}
      {showProcessingModal && <ProcessingModal progress={progress} />}
      {showDoneModal && <DoneModal progress={progress} onNewSession={handleNewSession} />}
    </div>
  );
}
