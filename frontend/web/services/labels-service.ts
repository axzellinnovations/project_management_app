import api from '@/lib/axios';
import type { Label } from '@/types';

export async function getProjectLabels(projectId: number): Promise<Label[]> {
  const res = await api.get<Label[]>(`/api/labels/project/${projectId}`);
  return res.data;
}

export async function createLabel(
  projectId: number,
  name: string,
  color: string,
): Promise<Label> {
  const res = await api.post<Label>('/api/labels', { projectId, name, color });
  return res.data;
}

export async function updateLabel(
  id: number,
  name: string,
  color: string,
): Promise<Label> {
  const res = await api.put<Label>(`/api/labels/${id}`, { name, color });
  return res.data;
}

export async function deleteLabel(id: number): Promise<void> {
  await api.delete(`/api/labels/${id}`);
}
