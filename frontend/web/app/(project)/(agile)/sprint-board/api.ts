import axios from '@/lib/axios';
import { Sprintboard, SprintboardFullResponse } from './types';

/**
 * Fetch sprint board for a specific sprint
 * @param sprintId - The sprint ID to fetch board for
 */
export async function fetchSprintboardBySprintId(sprintId: number): Promise<Sprintboard> {
  const response = await axios.get(`/api/sprintboards/sprint/${sprintId}`);
  const sprintboard = response.data;

  const columnsWithTasks = await Promise.all(
    sprintboard.columns.map(async (col: { columnStatus: string }) => {
      const tasksRes = await axios.get(`/api/sprintboards/${sprintboard.id}/columns/${col.columnStatus}/tasks`);
      return {
        ...col,
        tasks: tasksRes.data || []
      };
    })
  );

  return {
    ...sprintboard,
    columns: columnsWithTasks
  };
}

export async function fetchSprintboardBySprintIdFull(sprintId: number): Promise<SprintboardFullResponse> {
  const response = await axios.get(`/api/sprintboards/sprint/${sprintId}/full`);
  return response.data;
}

/**
 * Move a task to a different column
 */
export async function moveTaskToColumn(taskId: number, sprintboardId: number, newColumnStatus: string): Promise<void> {
  await axios.put(`/api/sprintboards/tasks/${taskId}/move`, {
    sprintboardId,
    newColumnStatus
  });
}

/**
 * Fetch all sprints for a project to find the active one
 */
export async function fetchSprintsByProject(projectId: number): Promise<unknown[]> {
  const response = await axios.get(`/api/sprints/project/${projectId}`);
  return response.data || [];
}

/**
 * Complete a sprint — calls the dedicated complete endpoint
 */
export async function completeSprint(sprintId: number): Promise<void> {
  await axios.put(`/api/sprints/${sprintId}/complete`);
}

/**
 * Create a new task within a sprint
 */
export async function createTask(taskData: Record<string, unknown>): Promise<unknown> {
  const response = await axios.post('/api/tasks', taskData);
  return response.data;
}

/**
 * Update an existing task
 */
export async function updateTask(taskId: number, taskData: Record<string, unknown>): Promise<unknown> {
  const response = await axios.put(`/api/tasks/${taskId}`, taskData);
  return response.data;
}

/**
 * Add a new column to the sprint board
 */
export async function addColumn(sprintboardId: number, name: string, status: string) {
  const response = await axios.post(`/api/sprintboards/${sprintboardId}/columns`, { name, status });
  return response.data;
}

export async function bulkUpdateTaskStatus(taskIds: number[], status: string): Promise<void> {
  await axios.patch('/api/tasks/bulk/status', { taskIds, status });
}

export async function bulkDeleteTasks(taskIds: number[]): Promise<void> {
  await axios.delete('/api/tasks/bulk', { data: { taskIds } });
}

export async function reorderSprintColumns(
  sprintboardId: number,
  reorderRequest: Array<{ id: number; position: number }>
): Promise<void> {
  await axios.patch(`/api/sprintboards/${sprintboardId}/columns/reorder`, reorderRequest);
}

export async function patchTaskDueDate(taskId: number, dueDate: string | null): Promise<void> {
  await axios.patch(`/api/tasks/${taskId}/dates`, { dueDate });
}

export async function assignTaskSingle(taskId: number, userId: number): Promise<void> {
  await axios.patch(`/api/tasks/${taskId}/assign/${userId}`);
}

export async function assignTaskMultiple(taskId: number, assigneeIds: number[]): Promise<void> {
  await axios.patch(`/api/tasks/${taskId}/assignees`, { assigneeIds });
}

export interface SprintTeamMemberOption {
  id: number;
  userId: number;
  name: string;
  photoUrl?: string | null;
}

export async function fetchTeamMembers(teamId: number): Promise<SprintTeamMemberOption[]> {
  const response = await axios.get(`/api/teams/${teamId}/members`);
  const payload = response.data;
  const items = Array.isArray(payload) ? payload : payload?.members ?? payload?.data ?? payload?.content ?? [];
  return items
    .map((member: Record<string, unknown> & { user?: Record<string, unknown> }) => {
      const id = Number(member?.id);
      const userId = Number(member?.user?.userId ?? member?.userId);
      const name = (member?.user?.fullName as string)
        || (member?.user?.username as string)
        || (member?.fullName as string)
        || (member?.username as string);
      const photoUrl = (member?.user?.profilePicUrl as string) || null;
      if (!Number.isFinite(id) || !Number.isFinite(userId) || !name) return null;
      return { id, userId, name, photoUrl };
    })
    .filter((item: SprintTeamMemberOption | null): item is SprintTeamMemberOption => item !== null);
}

