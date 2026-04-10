'use client';

import { useState, useCallback, useEffect } from 'react';
import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useRouter } from 'next/navigation';
import axios from '@/lib/axios';
import api from '@/lib/axios';
import { Task, KanbanColumn as KanbanColumnType } from './types';
import { fetchTasksByProject, updateTaskStatus, deleteTask, createTask, updateTask } from './api';

export const DEFAULT_COLUMN_CONFIGS: Array<{ status: string; title: string }> = [
  { status: 'TODO', title: 'To Do' },
  { status: 'IN_PROGRESS', title: 'In Progress' },
  { status: 'IN_REVIEW', title: 'In Review' },
  { status: 'DONE', title: 'Done' },
];

export function useKanbanBoard(projectId: string | null) {
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [columnConfigs, setColumnConfigs] = useState(DEFAULT_COLUMN_CONFIGS);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColumnStatus, setSelectedColumnStatus] = useState<string>('TODO');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [completeSuccess, setCompleteSuccess] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<string>('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [selectedTaskIdForModal, setSelectedTaskIdForModal] = useState<number | null>(null);
  const [usersMap, setUsersMap] = useState<Record<string, string | null>>({});
  const [activeMobileColumn, setActiveMobileColumn] = useState<string>(DEFAULT_COLUMN_CONFIGS[0].status);

  // Load column configs from localStorage on mount
  useEffect(() => {
    if (projectId) {
      const saved = localStorage.getItem(`kanban-columns-${projectId}`);
      if (saved) {
        try {
          setColumnConfigs(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse saved columns', e);
        }
      }
    }
  }, [projectId]);

  // Save column configs to localStorage when they change
  useEffect(() => {
    if (projectId) {
      localStorage.setItem(`kanban-columns-${projectId}`, JSON.stringify(columnConfigs));
    }
  }, [columnConfigs, projectId]);

  // Fetch user avatar map
  useEffect(() => {
    api.get('/api/auth/users').then((res) => {
      const map: Record<string, string | null> = {};
      for (const u of (res.data as { username?: string; fullName?: string; profilePicUrl?: string }[])) {
        const key = u.fullName || u.username || '';
        if (key) map[key] = u.profilePicUrl ?? null;
        if (u.username && u.username !== key) map[u.username] = u.profilePicUrl ?? null;
      }
      setUsersMap(map);
    }).catch(() => {/* non-critical */});
  }, []);

  const loadTasks = useCallback(async () => {
    if (!projectId) {
      setError('No project ID provided. Use ?projectId=<id> in URL.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const projectIdNum = parseInt(projectId as string);
      if (isNaN(projectIdNum)) throw new Error('Invalid project ID');
      const projectRes = await axios.get(`/api/projects/${projectIdNum}`);
      if (projectRes.data?.type === 'AGILE') {
        router.push(`/sprint-board?projectId=${projectId}`);
        return;
      }
      const fetchedTasks = await fetchTasksByProject(projectIdNum);
      setTasks(fetchedTasks);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load tasks';
      setError(errorMsg);
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const filteredTasks = useCallback(() => {
    if (!searchTerm.trim()) return tasks;
    const term = searchTerm.toLowerCase();
    return tasks.filter((task) => task.title.toLowerCase().includes(term));
  }, [tasks, searchTerm]);

  const columns: KanbanColumnType[] = columnConfigs.map((config) => ({
    status: config.status,
    title: config.title,
    tasks: filteredTasks().filter((task) => task.status === config.status),
  }));

  const handleAddColumn = () => {
    const name = prompt('Column name');
    if (!name) return;
    const status = name.toUpperCase().replace(/\s+/g, '_');
    setColumnConfigs((prev) => [...prev, { status, title: name }]);
  };

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const oldIndex = columnConfigs.findIndex((c) => c.status === active.id);
    const newIndex = columnConfigs.findIndex((c) => c.status === over?.id);
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      setColumnConfigs((cols) => arrayMove(cols, oldIndex, newIndex));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const type = active.data.current?.type;
    if (type === 'column') {
      handleColumnDragEnd(event);
      return;
    }
    const taskId = parseInt(active.id as string);
    const newStatus = over.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    setUpdatingTaskId(taskId);
    try {
      await updateTaskStatus(taskId, newStatus);
    } catch (err) {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status } : t));
      setError(`Failed to update task status: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    const originalTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await deleteTask(taskId);
    } catch (err) {
      setTasks(originalTasks);
      setError(`Failed to delete task: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleCreateTaskClick = (columnStatus: string) => {
    setSelectedColumnStatus(columnStatus);
    setIsCreateModalOpen(true);
  };

  const handleCreateTask = async (taskData: Partial<Task>) => {
    if (!projectId) return;
    setIsCreatingTask(true);
    try {
      const newTask = await createTask(taskData);
      setTasks((prev) => [...prev, newTask]);
      setIsCreateModalOpen(false);
      setCreateSuccess('Task created successfully!');
      setTimeout(() => setCreateSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to create task:', err);
      throw err;
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleEditTaskClick = (task: Task) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  const handleUpdateTask = async (taskId: number, taskData: Partial<Task>) => {
    setIsUpdatingTask(true);
    try {
      const updatedTask = await updateTask(taskId, taskData);
      setTasks((prev) => prev.map((t) => t.id === taskId ? updatedTask : t));
      setIsEditModalOpen(false);
      setEditingTask(null);
      setCreateSuccess('Task updated successfully!');
      setTimeout(() => setCreateSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to update task: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleCompleteBoard = async () => {
    if (confirm('Are you sure you want to mark this board as complete? This action cannot be undone.')) {
      setCompleteSuccess(true);
      setTimeout(() => setCompleteSuccess(false), 3000);
    }
  };

  return {
    tasks,
    loading,
    error,
    searchTerm,
    columnConfigs,
    columns,
    updatingTaskId,
    isCreateModalOpen, setIsCreateModalOpen,
    selectedColumnStatus, setSelectedColumnStatus,
    isCreatingTask,
    completeSuccess,
    createSuccess,
    isEditModalOpen, setIsEditModalOpen,
    editingTask, setEditingTask,
    isUpdatingTask,
    selectedTaskIdForModal, setSelectedTaskIdForModal,
    usersMap,
    activeMobileColumn, setActiveMobileColumn,
    loadTasks,
    handleAddColumn,
    handleDragEnd,
    handleDeleteTask,
    handleSearchChange,
    handleCreateTaskClick,
    handleCreateTask,
    handleEditTaskClick,
    handleUpdateTask,
    handleCompleteBoard,
  };
}
