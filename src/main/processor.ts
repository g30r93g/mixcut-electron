import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';
import { BrowserWindow } from 'electron';
import { M4ACUT, ATOMIC_PARSLEY } from './binary-path';
import { buildCueString, OverallDetails } from '../shared/cue-builder';
import type { CueTrack, CutProgress } from '../shared/types';

const execFileAsync = promisify(execFile);

export function buildProcessorArgs(cuePath: string, audioPath: string): string[] {
  return ['-C', cuePath, audioPath];
}

interface AtomicParsleyOptions {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  tracknum?: string;
  genre?: string;
  year?: string;
  gapless?: boolean;
  artworkPath?: string;
}

export function buildAtomicParsleyArgs(
  filePath: string,
  options: AtomicParsleyOptions,
): string[] {
  const args = [filePath];
  if (options.title) args.push('--title', options.title);
  if (options.artist) args.push('--artist', options.artist);
  if (options.album) args.push('--album', options.album);
  if (options.albumArtist) args.push('--albumArtist', options.albumArtist);
  if (options.tracknum) args.push('--tracknum', options.tracknum);
  if (options.genre) args.push('--genre', options.genre);
  if (options.year) args.push('--year', options.year);
  if (options.gapless != null) args.push('--gapless', String(options.gapless));
  if (options.artworkPath) args.push('--artwork', options.artworkPath);
  args.push('--overWrite');
  return args;
}

function sendProgress(window: BrowserWindow, progress: CutProgress) {
  window.webContents.send('cut-progress', progress);
}

export interface CutTracksParams {
  audioPath: string;
  tracks: CueTrack[];
  metadata: OverallDetails;
  artworkPath?: string;
  outputDir: string;
}

export async function cutTracks(
  window: BrowserWindow,
  params: CutTracksParams,
): Promise<void> {
  const { audioPath, tracks, metadata, artworkPath, outputDir } = params;
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mixcut-'));

  try {
    // 1. Generate CUE file
    const cueContent = buildCueString({
      entries: tracks,
      overallDetails: metadata,
      audioFileName: path.basename(audioPath),
    });
    if (!cueContent) throw new Error('No tracks to process');

    const cuePath = path.join(workDir, 'source.cue');
    await fs.writeFile(cuePath, cueContent, 'utf-8');

    // 2. Run m4acut
    sendProgress(window, { stage: 'cutting', message: 'Splitting audio...' });
    await execFileAsync(M4ACUT(), buildProcessorArgs(cuePath, audioPath), { cwd: workDir });

    // 3. List output files
    const allFiles = await fs.readdir(workDir);
    const outputFiles = allFiles
      .filter((f) => f.endsWith('.m4a') && f !== 'source.m4a')
      .sort()
      .map((f) => path.join(workDir, f));

    // 4. Apply metadata to each track
    const sortedTracks = [...tracks].sort((a, b) => a.trackNumber - b.trackNumber);
    for (let i = 0; i < outputFiles.length; i++) {
      sendProgress(window, { stage: 'tagging', trackNumber: i + 1, totalTracks: outputFiles.length });
      const filePath = outputFiles[i];
      const track = sortedTracks[i];

      const flags: AtomicParsleyOptions = { gapless: true };
      if (track?.title?.trim()) flags.title = track.title.trim();
      if (track?.performer?.trim()) flags.artist = track.performer.trim();
      if (metadata.title?.trim()) flags.album = metadata.title.trim();
      if (metadata.performer?.trim()) flags.albumArtist = metadata.performer.trim();
      flags.tracknum = `${i + 1}/${outputFiles.length}`;
      if (metadata.genre?.trim()) flags.genre = metadata.genre.trim();
      if (metadata.releaseYear?.trim()) flags.year = metadata.releaseYear.trim();
      if (artworkPath) flags.artworkPath = artworkPath;

      await execFileAsync(ATOMIC_PARSLEY(), buildAtomicParsleyArgs(filePath, flags));
    }

    // 5. Move to output directory
    await fs.mkdir(outputDir, { recursive: true });
    for (const filePath of outputFiles) {
      const dest = path.join(outputDir, path.basename(filePath));
      await fs.copyFile(filePath, dest);
    }

    sendProgress(window, { stage: 'complete', outputDir });
  } catch (err: any) {
    sendProgress(window, { stage: 'error', message: err?.message ?? 'Unknown error during processing' });
    throw err;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
