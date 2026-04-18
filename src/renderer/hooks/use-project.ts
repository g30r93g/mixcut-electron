import { useState, useCallback, useEffect, useRef } from 'react';
import { mixcut } from '../lib/mixcut-api';
import type { CueTrack, AlbumMetadata, ProjectState } from '../../shared/types';
import { slugify } from '../../shared/strings';

export function useProject() {
  const [project, setProject] = useState<ProjectState | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!project) return;
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      const now = new Date();
      const updated = { ...project, updatedAt: now.toISOString() };
      mixcut.saveProject(updated);
      setLastSavedAt(now);
    }, 500);
    return () => clearTimeout(saveTimeout.current);
  }, [project]);

  const createProject = useCallback(async (audioPath: string, audioName: string) => {
    const prefs = await mixcut.getPreferences();
    const baseName = audioName.replace(/\.m4a$/i, '');
    const newProject: ProjectState = {
      id: crypto.randomUUID(),
      name: baseName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      audioPath,
      outputDir: `${prefs.defaultOutputDir}/${slugify(baseName)}`,
      metadata: { title: baseName, performer: '' },
      tracks: [],
    };
    await mixcut.saveProject(newProject);
    setProject(newProject);
  }, []);

  const loadProject = useCallback(async (id: string) => {
    const loaded = await mixcut.loadProject(id);
    setProject(loaded);
  }, []);

  const updateTracks = useCallback((tracks: CueTrack[]) => {
    setProject((prev) => (prev ? { ...prev, tracks } : null));
  }, []);

  const updateMetadata = useCallback((metadata: AlbumMetadata) => {
    setProject((prev) => (prev ? { ...prev, metadata } : null));
  }, []);

  const setArtworkPath = useCallback((artworkPath: string | undefined) => {
    setProject((prev) => (prev ? { ...prev, artworkPath } : null));
  }, []);

  const setOutputDir = useCallback((outputDir: string) => {
    setProject((prev) => (prev ? { ...prev, outputDir } : null));
  }, []);

  const reset = useCallback(() => {
    setProject(null);
  }, []);

  return {
    project,
    lastSavedAt,
    createProject,
    loadProject,
    updateTracks,
    updateMetadata,
    setArtworkPath,
    setOutputDir,
    reset,
  };
}
