import { useCallback, useMemo, useState } from 'react';
import type { OverallDetails } from '../shared/cue-builder';
import { OpenAudio } from './components/open-audio';
import { DoneModal } from './components/output-view';
import { ProcessingModal } from './components/processing-view';
import { TrackWorkspace } from './components/track-workspace';
import { useCutProgress } from './hooks/use-cut-progress';
import { useProject } from './hooks/use-project';
import { mixcut } from './lib/mixcut-api';

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
