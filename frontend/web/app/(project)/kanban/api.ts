import axios from '@/lib/axios';
import { Task, Label, KanbanColumnConfig } from './types';

export interface KanbanBoardResponse {
  kanbanId: number;
  name: string;
  projectId: number;
  columns: KanbanColumnConfig[];
}

export interface TeamMemberOption {
  id: number;
  name: string;
}

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
  newStatus: string,
  taskTitle?: string
): Promise<Task> {
  try {
    // Try the lightweight PATCH endpoint first (no @NotBlank title required).
    const response = await axios.patch(`/api/tasks/${taskId}/status`, {
      status: newStatus,
    });
    return response.data;
  } catch (patchError: unknown) {
    // Fallback: if PATCH endpoint doesn't exist yet (404/401), use PUT with title
    const status = (patchError as { response?: { status?: number } })?.response?.status;
    if ((status === 404 || status === 401) && taskTitle) {
      console.warn(`PATCH /api/tasks/${taskId}/status unavailable (${status}), falling back to PUT`);
      const response = await axios.put(`/api/tasks/${taskId}`, {
        title: taskTitle,
        status: newStatus,
      });
      return response.data;
    }
    console.error(`Error updating task ${taskId} status:`, patchError);
    throw patchError;
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
    // Transform frontend Task fields → backend TaskRequestDTO fields
    const requestData: Record<string, unknown> = {};

    if (updates.title !== undefined) requestData.title = updates.title;
    if (updates.description !== undefined) requestData.description = updates.description;
    if (updates.priority !== undefined) requestData.priority = updates.priority;
    if (updates.status !== undefined) requestData.status = updates.status;
    if (updates.storyPoint !== undefined) requestData.storyPoint = updates.storyPoint;
    if (updates.dueDate !== undefined) requestData.dueDate = updates.dueDate || null;
    if (updates.startDate !== undefined) requestData.startDate = updates.startDate || null;
    if (updates.assigneeId !== undefined) requestData.assigneeId = updates.assigneeId;

    // Backend expects labelIds (List<Long>), not labelId
    if (updates.labelId !== undefined) {
      requestData.labelIds = updates.labelId ? [updates.labelId] : [];
    }

    const response = await axios.put(`/api/tasks/${taskId}`, requestData);
    return response.data;
  } catch (error) {
    console.error(`Error updating task ${taskId}:`, error);
    throw error;
  }
}

/**
 * Update task dates using specialized PATCH endpoint
 * @param taskId - The task ID to update
 * @param startDate - Date string (YYYY-MM-DD) or null
 * @param dueDate - Date string (YYYY-MM-DD) or null
 */
export async function updateTaskDates(
  taskId: number,
  startDate?: string | null,
  dueDate?: string | null
): Promise<void> {
  try {
    const data: Record<string, string | null> = {};
    if (startDate !== undefined) data.startDate = startDate;
    if (dueDate !== undefined) data.dueDate = dueDate;

    await axios.patch(`/api/tasks/${taskId}/dates`, data);
  } catch (error) {
    console.error(`Error updating task ${taskId} dates:`, error);
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
export async function createTask(taskData: Partial<Task> & { projectId: number; title: string; status: string }): Promise<Task> {
  try {
    // Validate required fields
    if (!taskData.title || !taskData.title.trim()) {
      throw new Error('Task title is required');
    }
    if (!taskData.projectId) {
      throw new Error('Project ID is required');
    }
    if (!taskData.status) {
      throw new Error('Task status is required');
    }

    // Format the request to match backend expectations
    const requestData = {
      title: taskData.title.trim(),
      description: taskData.description || '',
      status: taskData.status,
      priority: taskData.priority || 'MEDIUM',
      projectId: taskData.projectId,
      dueDate: taskData.dueDate || null,
      startDate: taskData.startDate || null,
      assigneeId: taskData.assigneeId ? Number(taskData.assigneeId) : null,
    };

    if (process.env.NODE_ENV === 'development') console.log('Creating task with data:', requestData);
    const response = await axios.post(`/api/tasks`, requestData);
    return response.data;
  } catch (error) {
    console.error('Error creating task:', error);
    const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
    
    // Provide more detailed error messages
    let errorMessage = 'Failed to create task';
    if (axiosError.response?.data?.message) {
      errorMessage = axiosError.response.data.message;
    } else if (axiosError.response?.status === 400) {
      errorMessage = 'Invalid task data. Please check your inputs.';
    } else if (axiosError.response?.status === 401) {
      errorMessage = 'Authentication required. Please log in again.';
    } else if (axiosError.response?.status === 403) {
      errorMessage = 'You do not have permission to create tasks in this project.';
    } else if (axiosError.response?.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Fetch project labels
 */
export async function fetchProjectLabels(projectId: number): Promise<Label[]> {
  try {
    const response = await axios.get(`/api/labels/project/${projectId}`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching project labels:', error);
    return [];
  }
}

/**
 * Fetch Kanban board definition (columns with color, wipLimit, position)
 */
export async function fetchKanbanBoard(projectId: number): Promise<KanbanBoardResponse | null> {
  try {
    const response = await axios.get(`/api/kanbans/project/${projectId}/board`);
    const data = response.data;
    if (!data) return null;

    // Map backend column DTO fields → frontend KanbanColumnConfig fields
    // Backend: { id, name, status, position, color, wipLimit }
    // Frontend: { id, title, status, color, wipLimit }
    return {
      kanbanId: data.kanbanId,
      name: data.name,
      projectId: data.projectId,
      columns: (data.columns || []).map((col: Record<string, unknown>) => ({
        id: col.id as number,
        status: (col.status as string) || (col.name as string || '').toUpperCase().replace(/\s+/g, '_'),
        title: (col.name as string) || '',
        color: (col.color as string) || '',
        wipLimit: (col.wipLimit as number) || 0,
      })),
    };
  } catch (error) {
    console.error('Error fetching kanban board:', error);
    return null;
  }
}

/**
 * Reorder kanban columns
 */
export async function reorderKanbanColumns(reorderRequest: Array<{ id: number; position: number }>): Promise<void> {
  try {
    await axios.patch('/api/kanban-columns/reorder', reorderRequest);
  } catch (error) {
    console.error('Error reordering kanban columns:', error);
    throw error;
  }
}

/**
 * Rename a kanban column
 */
export async function renameKanbanColumn(columnId: number, name: string): Promise<void> {
  try {
    await axios.patch(`/api/kanban-columns/${columnId}/rename`, { name });
  } catch (error) {
    console.error('Error renaming kanban column:', error);
    throw error;
  }
}

/**
 * Update kanban column settings (color, wipLimit)
 */
export async function updateKanbanColumnSettings(
  columnId: number,
  settings: { color?: string; wipLimit?: number }
): Promise<void> {
  try {
    await axios.patch(`/api/kanban-columns/${columnId}/settings`, settings);
  } catch (error) {
    console.error('Error updating kanban column settings:', error);
    throw error;
  }
}

/**
 * Fetch project details by ID
 */
export async function fetchProject(projectId: number): Promise<{ teamId?: number; type?: string; [key: string]: unknown }> {
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
export async function fetchTeamMembers(teamId: number): Promise<TeamMemberOption[]> {
  try {
    const response = await axios.get(`/api/teams/${teamId}/members`);
    const payload = response.data;

    // Accept common API shapes: [], { members: [] }, { data: [] }, { content: [] }
    const rawMembers = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.members)
        ? payload.members
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.content)
            ? payload.content
            : [];

    return rawMembers
      .map((member: Record<string, unknown> & { user?: Record<string, unknown> }) => {
        const id = Number(member?.id);
        const name =
          (member?.name as string) ??
          (member?.username as string) ??
          (member?.fullName as string) ??
          (member?.user?.username as string) ??
          (member?.user?.fullName as string) ??
          (member?.user?.email as string) ??
          '';

        if (!Number.isFinite(id) || !name) {
          return null;
        }

        return { id, name };
      })
      .filter((member: TeamMemberOption | null): member is TeamMemberOption => member !== null);
  } catch (error) {
    console.error('Error fetching team members:', error);
    throw error;
  }
}

/**
 * Create a new kanban column (adds a new status to the project board)
 */
export async function createKanbanColumn(kanbanId: number, name: string, position: number): Promise<KanbanColumnConfig> {
  try {
    const response = await axios.post('/api/kanban-columns', {
      kanbanId,
      name,
      position,
    });
    const col = response.data;
    return {
      id: col.id,
      status: col.status || col.name?.toUpperCase().replace(/\s+/g, '_') || name.toUpperCase().replace(/\s+/g, '_'),
      title: col.name || name,
      color: col.color || '',
      wipLimit: col.wipLimit || 0,
    };
  } catch (error) {
    console.error('Error creating kanban column:', error);
    throw error;
  }
}

/**
 * Create a new project label
 */
export async function createProjectLabel(
  projectId: number,
  name: string,
  color: string
): Promise<Label> {
  try {
    const response = await axios.post('/api/labels', {
      projectId,
      name,
      color,
    });
    return response.data;
  } catch (error) {
    console.error('Error creating project label:', error);
    throw error;
  }
}

