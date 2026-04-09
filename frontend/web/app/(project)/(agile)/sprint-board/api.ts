import axios from '@/lib/axios';
import { Sprintboard } from './types';

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

