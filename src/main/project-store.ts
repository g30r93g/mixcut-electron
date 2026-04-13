import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ProjectState, ProjectSummary } from '../shared/types';

export class ProjectStore {
  private projectsDir: string;

  constructor(dataDir: string) {
    this.projectsDir = path.join(dataDir, 'projects');
  }

  async save(project: ProjectState): Promise<void> {
    await fs.mkdir(this.projectsDir, { recursive: true });
    const filePath = path.join(this.projectsDir, `${project.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf-8');
  }

  async load(id: string): Promise<ProjectState | null> {
    const filePath = path.join(this.projectsDir, `${id}.json`);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as ProjectState;
    } catch {
      return null;
    }
  }

  async list(): Promise<ProjectSummary[]> {
    try {
      const files = await fs.readdir(this.projectsDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      const summaries: ProjectSummary[] = [];
      for (const file of jsonFiles) {
        const filePath = path.join(this.projectsDir, file);
        try {
          const raw = await fs.readFile(filePath, 'utf-8');
          const project = JSON.parse(raw) as ProjectState;
          summaries.push({ id: project.id, name: project.name, updatedAt: project.updatedAt });
        } catch { /* skip corrupt files */ }
      }
      return summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch {
      return [];
    }
  }

  async delete(id: string): Promise<void> {
    const filePath = path.join(this.projectsDir, `${id}.json`);
    await fs.rm(filePath, { force: true });
  }
}
