import {
  createTask,
  deleteTask,
  fetchTasksByProject,
  fetchTeamMembers,
  updateTask,
  updateTaskStatus,
} from './api';
import axios from '@/lib/axios';

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('kanban api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetchTasksByProject returns task list', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [{ id: 1, title: 'Task 1' }] });

    const result = await fetchTasksByProject(12);

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/tasks/project/12');
    expect(result).toEqual([{ id: 1, title: 'Task 1' }]);
  });

  it('createTask validates required fields', async () => {
    await expect(createTask({ projectId: 12, status: 'TODO' })).rejects.toThrow('Failed to create task');
    await expect(createTask({ title: 'Task', status: 'TODO' })).rejects.toThrow('Failed to create task');
    await expect(createTask({ title: 'Task', projectId: 12 })).rejects.toThrow('Failed to create task');
  });

  it('createTask maps backend errors to user friendly message', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: {
        status: 403,
      },
    });

    await expect(
      createTask({ title: 'Build', projectId: 12, status: 'TODO' })
    ).rejects.toThrow('You do not have permission to create tasks in this project.');
  });

  it('update and delete task call expected endpoints', async () => {
    mockedAxios.put.mockResolvedValueOnce({ data: { id: 3, status: 'DONE' } });
    mockedAxios.put.mockResolvedValueOnce({ data: { id: 3, title: 'Updated' } });
    mockedAxios.delete.mockResolvedValueOnce({});

    const statusResult = await updateTaskStatus(3, 'DONE');
    const taskResult = await updateTask(3, { title: 'Updated' });
    await deleteTask(3);

    expect(mockedAxios.put).toHaveBeenNthCalledWith(1, '/api/tasks/3', { status: 'DONE' });
    expect(mockedAxios.put).toHaveBeenNthCalledWith(2, '/api/tasks/3', { title: 'Updated' });
    expect(mockedAxios.delete).toHaveBeenCalledWith('/api/tasks/3');
    expect(statusResult).toEqual({ id: 3, status: 'DONE' });
    expect(taskResult).toEqual({ id: 3, title: 'Updated' });
  });

  it('fetchTeamMembers supports wrapped payload shape', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        members: [{ id: '8', user: { username: 'alice' } }, { id: 'x', name: '' }],
      },
    });

    const result = await fetchTeamMembers(10);

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/teams/10/members');
    expect(result).toEqual([{ id: 8, name: 'alice' }]);
  });
});
