import { tasksApi, kanbanApi, projectsApi, labelsApi } from '@/services/api-contract';
import { normalizeTaskPriority } from '@/services/tasks-contract';
import type { TaskListAllQueryParams, KanbanMoveTaskRequest } from '@/services/tasks-contract';
import { Task, Label, KanbanColumnConfig } from './types';
import { resolveProfilePhotoUrl } from '@/lib/profile-photo';

export type TaskResponseDTO = Task;

export interface KanbanBoardResponse {
  kanbanId: number;
  name: string;
  projectId: number;
  columns: KanbanColumnConfig[];
}

export interface TeamMemberOption {
  id: number;
  memberId?: number;
  userId?: number;
  name: string;
  email?: string | null;
  photoUrl?: string | null;
}

/**
 * Fetch all tasks for a specific project (unpaginated, ordered by backlogPosition).
 * Uses the /all endpoint so the returned order matches the persisted board order
 * instead of the paginated createdAt-desc default.
 * @param projectId - The project ID to fetch tasks for
 * @returns Promise with array of tasks
 */
export async function fetchTasksByProject(
  projectId: number,
  filters?: { milestoneId?: number | null; archived?: boolean }
): Promise<Task[]> {
  try {
    const params: TaskListAllQueryParams = {};
    if (filters?.archived !== undefined) {
      params.archived = filters.archived;
    }
    return await tasksApi.listAllByProject(projectId, params);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
}

/**
 * Fetch all tasks for a specific project (unpaginated, for timeline/Gantt)
 * @param projectId - The project ID to fetch tasks for
 * @returns Promise with array of tasks
 */
export async function fetchAllTasksByProject(
  projectId: number,
  filters?: { milestoneId?: number | null; archived?: boolean }
): Promise<Task[]> {
  try {
    const params: TaskListAllQueryParams = {};
    if (filters?.milestoneId != null) {
      params.milestoneId = filters.milestoneId;
    }
    if (filters?.archived !== undefined) {
      params.archived = filters.archived;
    }
    return await tasksApi.listAllByProject(projectId, params);
  } catch (error) {
    console.error('Error fetching all tasks:', error);
    throw error;
  }
}

export const archiveTask = async (taskId: number): Promise<TaskResponseDTO> => {
  return tasksApi.archive(taskId);
};

export const unarchiveTask = async (taskId: number): Promise<TaskResponseDTO> => {
  return tasksApi.unarchive(taskId);
};

export const getArchivedTasks = async (projectId: number): Promise<TaskResponseDTO[]> => {
  return tasksApi.getArchived(projectId);
};

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
    return await tasksApi.updateStatus(taskId, newStatus);
  } catch (patchError: unknown) {
    // Fallback: if PATCH endpoint doesn't exist yet (404/401), use PUT with title
    const status = (patchError as { response?: { status?: number } })?.response?.status;
    if ((status === 404 || status === 401) && taskTitle) {
      console.warn(`PATCH status unavailable (${status}), falling back to PUT`);
      return await tasksApi.update(taskId, {
        title: taskTitle,
        status: newStatus,
      });
    }
    console.error(`Error updating task ${taskId} status:`, patchError);
    throw patchError;
  }
}

export async function deleteKanbanColumn(columnId: number): Promise<void> {
  try {
    await kanbanApi.deleteColumn(columnId);
  } catch (error) {
    console.error('Error deleting kanban column:', error);
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
    const requestData: Record<string, unknown> = {};

    if (updates.title !== undefined) requestData.title = updates.title;
    if (updates.description !== undefined) requestData.description = updates.description;
    if (updates.priority !== undefined) requestData.priority = updates.priority;
    if (updates.status !== undefined) requestData.status = updates.status;
    if (updates.storyPoint !== undefined) requestData.storyPoint = updates.storyPoint;
    if (updates.dueDate !== undefined) requestData.dueDate = updates.dueDate || null;
    if (updates.startDate !== undefined) requestData.startDate = updates.startDate || null;
    if (updates.assigneeId !== undefined) requestData.assigneeId = updates.assigneeId;

    if (updates.labelId !== undefined) {
      requestData.labelIds = updates.labelId ? [updates.labelId] : [];
    }

    return await tasksApi.update(taskId, requestData);
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
): Promise<Task> {
  try {
    const data: Record<string, string | null> = {};
    if (startDate !== undefined) data.startDate = startDate;
    if (dueDate !== undefined) data.dueDate = dueDate;

    return await tasksApi.updateDates(taskId, data);
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
    await tasksApi.delete(taskId);
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
    if (!taskData.title || !taskData.title.trim()) {
      throw new Error('Task title is required');
    }
    if (!taskData.projectId) {
      throw new Error('Project ID is required');
    }
    if (!taskData.status) {
      throw new Error('Task status is required');
    }

    const requestData = {
      title: taskData.title.trim(),
      description: taskData.description || '',
      status: taskData.status,
      priority: normalizeTaskPriority(taskData.priority),
      projectId: taskData.projectId,
      dueDate: taskData.dueDate || null,
      startDate: taskData.startDate || null,
      assigneeId: taskData.assigneeId ? Number(taskData.assigneeId) : undefined,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('Creating task', {
        titleLength: requestData.title.length,
        status: requestData.status,
      });
    }
    return await tasksApi.create(requestData);
  } catch (error) {
    console.error('Error creating task:', error);
    const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
    
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
    return await labelsApi.listByProject(projectId);
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
    const data = await kanbanApi.getBoard(projectId);
    if (!data) return null;

    return {
      kanbanId: data.kanbanId,
      name: data.name,
      projectId: data.projectId,
      columns: (data.columns || []).map((col: { id: number; status?: string; title?: string; name?: string; color?: string; wipLimit?: number }) => ({
        id: col.id as number,
        status: (col.status as string) || (col.title as string || col.name as string || '').toUpperCase().replace(/\s+/g, '_'),
        title: (col.title as string) || (col.name as string) || '',
        color: (col.color as string) || '',
        wipLimit: (col.wipLimit as number) || 0,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Reorder kanban columns
 */
export async function reorderKanbanColumns(reorderRequest: Array<{ id: number; position: number }>): Promise<void> {
  try {
    await kanbanApi.reorderColumns(reorderRequest);
  } catch (error) {
    console.error('Error reordering kanban columns:', error);
    throw error;
  }
}

/**
 * Atomically move a kanban task to a new column and persist the new column order.
 * Combines status update + backlogPosition rewrite in a single backend transaction.
 */
export async function moveKanbanTask(payload: KanbanMoveTaskRequest): Promise<Task> {
  try {
    return await tasksApi.moveKanbanTask(payload);
  } catch (error) {
    console.error('Error moving kanban task:', error);
    throw error;
  }
}

/**
 * Rename a kanban column
 */
export async function renameKanbanColumn(columnId: number, name: string): Promise<void> {
  try {
    await kanbanApi.renameColumn(columnId, { name });
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
    await kanbanApi.updateColumnSettings(columnId, settings);
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
    return await projectsApi.get(projectId);
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
    const payload = await projectsApi.getTeamMembers(teamId);
    const raw = payload as unknown as { members?: unknown[]; data?: unknown[]; content?: unknown[] } | unknown[];

    const rawMembers: unknown[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { members?: unknown[] }).members)
        ? (raw as { members: unknown[] }).members
        : Array.isArray((raw as { data?: unknown[] }).data)
          ? (raw as { data: unknown[] }).data
          : Array.isArray((raw as { content?: unknown[] }).content)
            ? (raw as { content: unknown[] }).content
            : [];

    const results: TeamMemberOption[] = [];
    for (const entry of rawMembers) {
      const member = entry as Record<string, unknown> & { user?: Record<string, unknown> };
      const memberId = Number(member?.id);
      const userId = Number(member?.userId ?? member?.user?.userId);
      const name =
        (member?.name as string) ??
        (member?.username as string) ??
        (member?.fullName as string) ??
        (member?.user?.username as string) ??
        (member?.user?.fullName as string) ??
        (member?.user?.email as string) ??
        '';

      const assignableId = Number.isFinite(userId) ? userId : memberId;
      if (!Number.isFinite(assignableId) || !name) continue;
      results.push({
        id: assignableId,
        memberId: Number.isFinite(memberId) ? memberId : undefined,
        userId: Number.isFinite(userId) ? userId : undefined,
        name,
        photoUrl: resolveProfilePhotoUrl(
          (member?.profilePicUrl as string | null | undefined) ??
            (member?.user?.profilePicUrl as string | null | undefined),
          Number.isFinite(userId) ? userId : undefined,
        ),
      });
    }
    return results;
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
    const colRaw = await kanbanApi.createColumn({
      kanbanId,
      name,
      position,
    });
    const col = colRaw as { id: number; status?: string; name?: string; color?: string; wipLimit?: number };
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
    return await labelsApi.create({
      projectId,
      name,
      color,
    });
  } catch (error) {
    console.error('Error creating project label:', error);
    throw error;
  }
}

/**
 * Update an existing project label
 */
export async function updateProjectLabel(
  id: number,
  name: string,
  color: string
): Promise<Label> {
  try {
    return await labelsApi.update(id, { name, color });
  } catch (error) {
    console.error('Error updating project label:', error);
    throw error;
  }
}

/**
 * Delete a project label
 */
export async function deleteProjectLabel(id: number): Promise<void> {
  try {
    await labelsApi.delete(id);
  } catch (error) {
    console.error('Error deleting project label:', error);
    throw error;
  }
}
