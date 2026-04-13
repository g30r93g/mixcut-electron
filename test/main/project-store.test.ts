import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectStore } from '../../src/main/project-store';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ProjectState } from '../../src/shared/types';

let testDir: string;
let store: ProjectStore;

const makeProject = (overrides: Partial<ProjectState> = {}): ProjectState => ({
  id: crypto.randomUUID(),
  name: 'Test Album',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  audioPath: '/tmp/test.m4a',
  outputDir: '/tmp/output',
  metadata: { title: 'Test Album', performer: 'Artist' },
  tracks: [],
  ...overrides,
});

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mixcut-store-test-'));
  store = new ProjectStore(testDir);
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

describe('ProjectStore', () => {
  it('saves and loads a project', async () => {
    const project = makeProject();
    await store.save(project);
    const loaded = await store.load(project.id);
    expect(loaded).toEqual(project);
  });

  it('lists projects sorted by updatedAt descending', async () => {
    const older = makeProject({ updatedAt: '2024-01-01T00:00:00Z' });
    const newer = makeProject({ updatedAt: '2024-06-01T00:00:00Z' });
    await store.save(older);
    await store.save(newer);
    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(newer.id);
  });

  it('deletes a project', async () => {
    const project = makeProject();
    await store.save(project);
    await store.delete(project.id);
    const list = await store.list();
    expect(list).toHaveLength(0);
  });

  it('returns null for non-existent project', async () => {
    const loaded = await store.load('non-existent');
    expect(loaded).toBeNull();
  });
});
