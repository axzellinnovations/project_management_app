import axios from '@/lib/axios';
import { Sprintboard } from './types';

/**
 * Fetch sprint board for a specific sprint
 * @param sprintId - The sprint ID to fetch board for
 */
export async function fetchSprintboardBySprintId(sprintId: number): Promise<Sprintboard> {
  try {
    const response = await axios.get(`/api/sprintboards/sprint/${sprintId}`);
    const sprintboard = response.data;
    
    // Fetch tasks for each column
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
  } catch (error) {
    console.error('Error fetching sprintboard:', error);
    throw error;
  }
}

/**
 * Move a task to a different column
 */
export async function moveTaskToColumn(taskId: number, sprintboardId: number, newColumnStatus: string): Promise<void> {
  try {
    await axios.put(`/api/sprintboards/tasks/${taskId}/move`, {
      sprintboardId,
      newColumnStatus
    });
  } catch (error) {
    console.error(`Error moving task ${taskId}:`, error);
    throw error;
  }
}

/**
 * Fetch all sprints for a project to find the active one
 */
export async function fetchSprintsByProject(projectId: number): Promise<unknown[]> {
  try {
    const response = await axios.get(`/api/sprints/project/${projectId}`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching sprints:', error);
    throw error;
  }
}

/**
 * Complete a sprint (sets status to COMPLETED)
 */
export async function completeSprint(sprintId: number, sprintData: Record<string, unknown>): Promise<void> {
  try {
    await axios.put(`/api/sprints/${sprintId}`, {
      ...sprintData,
      status: 'COMPLETED'
    });
  } catch (error) {
    console.error(`Error completing sprint ${sprintId}:`, error);
    throw error;
  }
}

/**
 * Create a new task within a sprint
 */
export async function createTask(taskData: Record<string, unknown>): Promise<unknown> {
    try {
        const response = await axios.post('/api/tasks', taskData);
        return response.data;
    } catch (error) {
        console.error('Error creating task:', error);
        throw error;
    }
}

/**
 * Update an existing task
 */
export async function updateTask(taskId: number, taskData: Record<string, unknown>): Promise<unknown> {
    try {
        const response = await axios.put(`/api/tasks/${taskId}`, taskData);
        return response.data;
    } catch (error) {
        console.error('Error updating task:', error);
        throw error;
    }
}

/**
 * Add a new column to the sprint board
 */
export async function addColumn(sprintboardId: number, name: string, status: string) {
  try {
    const response = await axios.post(`/api/sprintboards/${sprintboardId}/columns`, { name, status });
    return response.data;
  } catch (error) {
    console.error('Error adding column:', error);
    throw error;
  }
}
