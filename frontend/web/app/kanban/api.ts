import axios from '@/lib/axios';
import { Task } from './types';

/**
 * Fetch all tasks for a specific project
 * @param projectId - The project ID to fetch tasks for
 * @returns Promise with array of tasks
 */
export async function fetchTasksByProject(projectId: number): Promise<Task[]> {
  try {
    const response = await axios.get(`/api/tasks/project/${projectId}`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
}

/**
 * Update task status (move between columns)
 * @param taskId - The task ID to update
 * @param newStatus - The new status value (TODO, IN_PROGRESS, IN_REVIEW, DONE)
 * @returns Promise with updated task
 */
export async function updateTaskStatus(
  taskId: number,
  newStatus: string
): Promise<Task> {
  try {
    const response = await axios.put(`/api/tasks/${taskId}`, {
      status: newStatus,
    });
    return response.data;
  } catch (error) {
    console.error(`Error updating task ${taskId} status:`, error);
    throw error;
  }
}

/**
 * Update task with due date and other details
 * @param taskId - The task ID to update
 * @param updates - Object with fields to update (dueDate, startDate, etc.)
 * @returns Promise with updated task
 */
export async function updateTask(
  taskId: number,
  updates: Partial<Task>
): Promise<Task> {
  try {
    const response = await axios.put(`/api/tasks/${taskId}`, updates);
    return response.data;
  } catch (error) {
    console.error(`Error updating task ${taskId}:`, error);
    throw error;
  }
}

/**
 * Delete a task
 * @param taskId - The task ID to delete
 * @returns Promise that resolves when delete is complete
 */
export async function deleteTask(taskId: number): Promise<void> {
  try {
    await axios.delete(`/api/tasks/${taskId}`);
  } catch (error) {
    console.error(`Error deleting task ${taskId}:`, error);
    throw error;
  }
}

/**
 * Create a new task
 * @param taskData - Object with task details (title, description, status, etc.)
 * @returns Promise with newly created task
 */
export async function createTask(taskData: any): Promise<Task> {
  try {
    // Format the request to match backend expectations
    const requestData = {
      title: taskData.title,
      description: taskData.description || '',
      status: taskData.status,
      priority: taskData.priority || 'MEDIUM',
      storyPoint: taskData.storyPoint || 0,
      projectId: taskData.projectId,
      dueDate: taskData.dueDate || null,
      startDate: taskData.startDate || null,
      assigneeId: taskData.assigneeId || null,
    };

    const response = await axios.post(`/api/tasks`, requestData);
    return response.data;
  } catch (error) {
    console.error('Error creating task:', error);
    const axiosError = error as any;
    throw new Error(
      axiosError.response?.data?.message ||
      (axiosError.response?.status === 400
        ? 'Invalid task data. Please check your inputs.'
        : 'Failed to create task')
    );
  }
}

/**
 * Fetch project details by ID
 */
export async function fetchProject(projectId: number): Promise<any> {
  try {
    const response = await axios.get(`/api/projects/${projectId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching project:', error);
    throw error;
  }
}

/**
 * Fetch members of a team
 */
export async function fetchTeamMembers(teamId: number): Promise<any[]> {
  try {
    const response = await axios.get(`/api/teams/${teamId}/members`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching team members:', error);
    throw error;
  }
}
