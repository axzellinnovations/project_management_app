import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { T } from '../constants/tokens';

export interface BoardLabel {
  id: number;
  name: string;
  color?: string | null;
}

export interface BoardSubtask {
  id: number;
  title: string;
  status: string;
}

export interface BoardTask {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  priority?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
  assigneeName?: string | null;
  assigneePhotoUrl?: string | null;
  projectId?: number;
  sprintId?: number | null;
  storyPoint?: number | null;
  projectTaskNumber?: number | null;
  labels?: BoardLabel[];
  subtasks?: BoardSubtask[];
  commentCount?: number;
  attachmentCount?: number;
}

export interface BoardMember {
  id: number;
  userId: number;
  name: string;
  role?: string | null;
}

export interface KanbanBoardColumn {
  id: number;
  name: string;
  status: string;
  position: number;
  color?: string | null;
  wipLimit?: number | null;
}

export interface KanbanBoardData {
  kanbanId: number;
  name?: string;
  projectId: number;
  columns: KanbanBoardColumn[];
}

const FALLBACK_COLUMNS: KanbanBoardColumn[] = [
  { id: 0, name: 'To Do', status: 'TODO', position: 0, color: T.statusTodo.dot, wipLimit: 0 },
  { id: 0, name: 'In Progress', status: 'IN_PROGRESS', position: 1, color: T.statusInProg.dot, wipLimit: 0 },
  { id: 0, name: 'In Review', status: 'IN_REVIEW', position: 2, color: T.statusInReview.dot, wipLimit: 0 },
  { id: 0, name: 'Done', status: 'DONE', position: 3, color: T.statusDone.dot, wipLimit: 0 },
];

function normalizeColumns(columns?: KanbanBoardColumn[]) {
  const source = columns?.length ? columns : FALLBACK_COLUMNS;
  return [...source]
    .filter((column) => !!column.status)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

export function useProjectBoard(projectId: number) {
  const [board, setBoard] = useState<KanbanBoardData | null>(null);
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(() => normalizeColumns(board?.columns), [board?.columns]);

  const fetchBoard = useCallback(async (background = false) => {
    if (!projectId) return;

    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [boardRes, tasksRes, membersRes] = await Promise.all([
        api.get(`/api/kanbans/project/${projectId}/board`),
        api.get(`/api/tasks/project/${projectId}`),
        api.get(`/api/projects/${projectId}/members`).catch(() => ({ data: [] })),
      ]);

      const rawBoard = boardRes.data as KanbanBoardData | null;
      setBoard(rawBoard ? { ...rawBoard, columns: normalizeColumns(rawBoard.columns) } : null);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      const rawMembers = Array.isArray(membersRes.data) ? membersRes.data : [];
      setMembers(rawMembers.map((member: {
        id?: number;
        userId?: number;
        role?: string | null;
        user?: { userId?: number; fullName?: string | null; username?: string | null };
        name?: string | null;
      }) => {
        const userId = member.user?.userId ?? member.userId ?? member.id ?? 0;
        const name = member.name || member.user?.fullName || member.user?.username || `Member ${userId}`;
        return {
          id: member.id ?? userId,
          userId,
          name,
          role: member.role ?? null,
        };
      }).filter((member: BoardMember) => member.userId > 0));
    } catch {
      setError('Failed to load board. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchBoard(false);
  }, [fetchBoard]);

  const refresh = useCallback(() => fetchBoard(true), [fetchBoard]);

  const moveTask = useCallback(async (task: BoardTask, status: string) => {
    if (task.status === status) return;
    const previous = tasks;

    setTasks((current) => current.map((item) => (
      item.id === task.id ? { ...item, status } : item
    )));

    try {
      const response = await api.patch(`/api/tasks/${task.id}/status`, { status });
      const updated = response.data as BoardTask;
      setTasks((current) => current.map((item) => (
        item.id === task.id ? { ...item, ...updated } : item
      )));
    } catch (err) {
      setTasks(previous);
      throw err;
    }
  }, [tasks]);

  const createTask = useCallback(async ({
    title,
    status,
    dueDate,
    assigneeId,
  }: {
    title: string;
    status: string;
    dueDate?: string | null;
    assigneeId?: number | null;
  }) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const response = await api.post('/api/tasks', {
      projectId,
      title: cleanTitle,
      status,
      priority: 'MEDIUM',
      dueDate: dueDate || undefined,
      assigneeId: assigneeId || undefined,
    });
    const created = response.data as BoardTask;
    setTasks((current) => current.some((task) => task.id === created.id) ? current : [...current, created]);
  }, [projectId]);

  const deleteTask = useCallback(async (taskId: number) => {
    const previous = tasks;
    setTasks((current) => current.filter((task) => task.id !== taskId));
    try {
      await api.delete(`/api/tasks/${taskId}`);
    } catch (err) {
      setTasks(previous);
      throw err;
    }
  }, [tasks]);

  const updateTaskDueDate = useCallback(async (taskId: number, dueDate: string | null) => {
    const previous = tasks;
    setTasks((current) => current.map((task) => (
      task.id === taskId ? { ...task, dueDate } : task
    )));

    try {
      await api.patch(`/api/tasks/${taskId}/dates`, { dueDate });
    } catch (err) {
      setTasks(previous);
      throw err;
    }
  }, [tasks]);

  const createColumn = useCallback(async (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    if (!board?.kanbanId) {
      throw new Error('Board configuration is not loaded.');
    }

    const response = await api.post('/api/kanban-columns', {
      name: cleanName,
      position: columns.length,
      kanbanId: board.kanbanId,
    });
    const created = response.data as KanbanBoardColumn;
    setBoard((current) => current ? {
      ...current,
      columns: normalizeColumns([...current.columns, created]),
    } : current);
  }, [board?.kanbanId, columns.length]);

  const deleteColumn = useCallback(async (columnId: number) => {
    if (!columnId) return;

    const previous = board;
    setBoard((current) => current ? {
      ...current,
      columns: current.columns.filter((column) => column.id !== columnId),
    } : current);

    try {
      await api.delete(`/api/kanban-columns/${columnId}`);
    } catch (err) {
      setBoard(previous);
      throw err;
    }
  }, [board]);

  return {
    board,
    columns,
    tasks,
    members,
    loading,
    refreshing,
    error,
    refresh,
    moveTask,
    createTask,
    deleteTask,
    updateTaskDueDate,
    createColumn,
    deleteColumn,
  };
}
