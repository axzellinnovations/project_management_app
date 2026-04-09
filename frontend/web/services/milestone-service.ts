import api from '@/lib/axios';
import type { MilestoneResponse, MilestoneRequest } from '@/types';

export async function getMilestones(projectId: number): Promise<MilestoneResponse[]> {
  const res = await api.get<MilestoneResponse[]>(`/api/projects/${projectId}/milestones`);
  return res.data;
}

export async function getMilestone(milestoneId: number): Promise<MilestoneResponse> {
  const res = await api.get<MilestoneResponse>(`/api/milestones/${milestoneId}`);
  return res.data;
}

export async function createMilestone(
  projectId: number,
  data: MilestoneRequest,
): Promise<MilestoneResponse> {
  const res = await api.post<MilestoneResponse>(`/api/projects/${projectId}/milestones`, data);
  return res.data;
}

export async function updateMilestone(
  milestoneId: number,
  data: MilestoneRequest,
): Promise<MilestoneResponse> {
  const res = await api.put<MilestoneResponse>(`/api/milestones/${milestoneId}`, data);
  return res.data;
}

export async function deleteMilestone(milestoneId: number): Promise<void> {
  await api.delete(`/api/milestones/${milestoneId}`);
}

export async function assignTaskToMilestone(
  taskId: number,
  milestoneId: number | null,
): Promise<void> {
  await api.patch(`/api/tasks/${taskId}/milestone`, { milestoneId });
}
