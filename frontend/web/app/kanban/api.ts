import axios from '@/lib/axios';
import { Task } from './types';

export interface TeamMemberOption {
  id: number;
  name: string;
  role?: string;
  email?: string;
}

interface ApiErrorShape {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
}

interface RawTeamMember {
  id?: number | string;
  userId?: number | string;
  name?: string;
  fullName?: string;
  username?: string;
  email?: string;
  role?: string;
  user?: {
    userId?: number | string;
    username?: string;
    fullName?: string;
    email?: string;
  };
}

/**
 * Fetch members directly by project id
 */
export async function fetchProjectMembers(projectId: number): Promise<TeamMemberOption[]> {
  try {
    const response = await axios.get(`/api/projects/${projectId}/members`);
    const payload = response.data;

    const rawMembers = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.members)
        ? payload.members
        : [];

    return rawMembers
      .map((member: RawTeamMember) => {
        const id = Number(member?.user?.userId ?? member?.userId ?? member?.id);
        const name =
          member?.fullName ??
          member?.name ??
          member?.username ??
          member?.user?.fullName ??
          member?.user?.username ??
          member?.email ??
          member?.user?.email ??
          '';

        if (!Number.isFinite(id) || !name) return null;

        return {
          id,
          name,
          role: member?.role,
          email: member?.email ?? member?.user?.email,
        };
      })
      .filter((member: TeamMemberOption | null): member is TeamMemberOption => member !== null);
  } catch (error) {
    console.error('Error fetching project members:', error);
    throw error;
  }
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
    const axiosError = error as ApiErrorShape;

    // Handle network errors
    if (!axiosError.response) {
      throw new Error('Network error. Please check if the server is running and try again.');
    }
    
    let errorMessage = 'Failed to fetch tasks';
    if (axiosError.response?.data?.message) {
      errorMessage = axiosError.response.data.message;
    } else if (axiosError.response?.status === 400) {
      errorMessage = 'Invalid project ID. Please check and try again.';
    } else if (axiosError.response?.status === 401) {
      errorMessage = 'Authentication required. Please log in again.';
    } else if (axiosError.response?.status === 403) {
      errorMessage = 'You do not have permission to view tasks in this project.';
    } else if (axiosError.response?.status === 404) {
      errorMessage = 'Project not found.';
    } else if (axiosError.response?.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    }
    
    throw new Error(errorMessage);
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createTask(taskData: any): Promise<Task> {
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
      storyPoint: taskData.storyPoint || 0,
      projectId: taskData.projectId,
      dueDate: taskData.dueDate || null,
      startDate: taskData.startDate || null,
      assigneeId: taskData.assigneeId ? Number(taskData.assigneeId) : null,
    };

    console.log('Creating task with data:', requestData);
    const response = await axios.post(`/api/tasks`, requestData);
    return response.data;
  } catch (error) {
    console.error('Error creating task:', error);
    const axiosError = error as ApiErrorShape;

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
 * Fetch project details by ID
 */
export async function fetchProject(projectId: number): Promise<Record<string, unknown>> {
  try {
    const response = await axios.get(`/api/projects/${projectId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching project:', error);
    const axiosError = error as ApiErrorShape;
    
    // Handle network errors
    if (!axiosError.response) {
      throw new Error('Network error. Please check if the server is running and try again.');
    }
    
    // Provide detailed error messages based on response status
    let errorMessage = 'Failed to fetch project';
    if (axiosError.response?.data?.message) {
      errorMessage = axiosError.response.data.message;
    } else if (axiosError.response?.status === 400) {
      errorMessage = 'Invalid project ID. Please check and try again.';
    } else if (axiosError.response?.status === 401) {
      errorMessage = 'Authentication required. Please log in again.';
    } else if (axiosError.response?.status === 403) {
      errorMessage = 'You are no longer a member of this project. Please contact the project admin for access.';
    } else if (axiosError.response?.status === 404) {
      errorMessage = 'Project not found. It may have been deleted.';
    } else if (axiosError.response?.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    }
    
    throw new Error(errorMessage);
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
      .map((member: RawTeamMember) => {
        const id = Number(member?.user?.userId ?? member?.userId ?? member?.id);
        const name =
          member?.name ??
          member?.fullName ??
          member?.username ??
          member?.user?.username ??
          member?.user?.fullName ??
          member?.user?.email ??
          '';
        const role = member?.role;
        const email = member?.email ?? member?.user?.email;

        if (!Number.isFinite(id) || !name) {
          return null;
        }

        return { id, name, role, email };
      })
      .filter((member: TeamMemberOption | null): member is TeamMemberOption => member !== null);
  } catch (error) {
    console.error('Error fetching team members:', error);
    const axiosError = error as ApiErrorShape;

    // Handle network errors
    if (!axiosError.response) {
      throw new Error('Network error. Please check if the server is running and try again.');
    }
    
    let errorMessage = 'Failed to fetch team members';
    if (axiosError.response?.data?.message) {
      errorMessage = axiosError.response.data.message;
    } else if (axiosError.response?.status === 400) {
      errorMessage = 'Invalid team ID. Please check and try again.';
    } else if (axiosError.response?.status === 401) {
      errorMessage = 'Authentication required. Please log in again.';
    } else if (axiosError.response?.status === 403) {
      errorMessage = 'You do not have permission to view team members.';
    } else if (axiosError.response?.status === 404) {
      errorMessage = 'Team not found.';
    } else if (axiosError.response?.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    }
    
    throw new Error(errorMessage);
  }
}
