import api from '@/lib/axios';

// ── Types ──

export interface ProjectSummary {
  id: number;
  name: string;
  isFavorite?: boolean;
  [key: string]: unknown;
}

// ── API ──

export async function fetchRecentProjects(limit = 10): Promise<ProjectSummary[]> {
  const { data } = await api.get<ProjectSummary[]>('/api/projects/recent', { params: { limit } });
  return data;
}

export async function fetchFavoriteProjects(): Promise<ProjectSummary[]> {
  const { data } = await api.get<ProjectSummary[]>('/api/projects/favorites');
  return data;
}

export async function fetchProjectDetails(projectId: string): Promise<ProjectSummary> {
  const { data } = await api.get<ProjectSummary>(`/api/projects/${projectId}`);
  return data;
}

export async function recordProjectAccess(projectId: number): Promise<void> {
  await api.post(`/api/projects/${projectId}/access`);
}

export async function toggleFavorite(projectId: number | string): Promise<void> {
  await api.post(`/api/projects/${projectId}/favorite`);
}

export async function fetchDocuments(
  projectId: string,
  includeDeleted = false,
): Promise<unknown[]> {
  const { data } = await api.get(`/api/projects/${projectId}/documents`, {
    params: { includeDeleted },
  });
  return data;
}
