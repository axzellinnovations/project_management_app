'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import { fetchTasksByProject } from '@/app/(project)/kanban/api';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import type { CreateTaskData } from '@/components/shared/CreateTaskModal';
import type { Task } from '@/types';
import { STATUS_ORDER } from '../lib/list-config';

export function useListTasks() {
  const searchParams = useSearchParams();
  const projectIdStr = searchParams.get('projectId');
  const projectId = projectIdStr ? Number(projectIdStr) : null;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const cacheKey = projectId ? `planora:tasks:${projectId}` : null;

  const loadTasks = useCallback(async () => {
    if (!projectId || !cacheKey) return;
    // Serve stale data instantly
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        setTasks(JSON.parse(cached) as Task[]);
        setLoading(false);
      } catch { /* ignore corrupt cache */ }
    }
    // Always revalidate in background
    try {
      const data = await fetchTasksByProject(projectId);
      setTasks(data as Task[]);
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      if (!cached) setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [projectId, cacheKey]);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  useTaskWebSocket(projectIdStr, useCallback((event) => {
    if (event.type === 'TASK_DELETED' && event.taskId) {
      setTasks((prev) => prev.filter((t) => t.id !== event.taskId));
    } else if (event.type === 'TASK_CREATED' || event.type === 'TASK_UPDATED') {
      void loadTasks();
    }
  }, [loadTasks]));

  const handleStatusChange = useCallback(async (taskId: number, newStatus: string) => {
    setTasks((prev) => {
      const next = prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t);
      if (cacheKey) sessionStorage.setItem(cacheKey, JSON.stringify(next));
      return next;
    });
    try {
      await api.put(`/api/tasks/${taskId}`, { status: newStatus });
    } catch {
      if (cacheKey) sessionStorage.removeItem(cacheKey);
      void loadTasks();
    }
  }, [loadTasks, cacheKey]);

  const handleDelete = useCallback(async (taskId: number) => {
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== taskId);
      if (cacheKey) sessionStorage.setItem(cacheKey, JSON.stringify(next));
      return next;
    });
    try {
      await api.delete(`/api/tasks/${taskId}`);
    } catch {
      if (cacheKey) sessionStorage.removeItem(cacheKey);
      void loadTasks();
    }
  }, [loadTasks, cacheKey]);

  const handleAddTask = useCallback(async (data: CreateTaskData) => {
    if (!projectId) return;
    try {
      const res = await api.post('/api/tasks', {
        projectId,
        title: data.title,
        storyPoint: data.storyPoint,
        priority: data.priority,
        assigneeId: data.assigneeId,
        labelIds: data.labelIds,
        dueDate: data.dueDate,
      });
      setTasks((prev) => {
        const next = [...prev, res.data as Task];
        if (cacheKey) sessionStorage.setItem(cacheKey, JSON.stringify(next));
        return next;
      });
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  }, [projectId, cacheKey]);

  const sortedTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? tasks.filter((t) => t.title.toLowerCase().includes(q) || t.assigneeName?.toLowerCase().includes(q))
      : tasks;
    return [...filtered].sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    );
  }, [tasks, search]);

  return {
    projectId,
    projectIdStr,
    tasks,
    loading,
    error,
    search,
    setSearch,
    sortedTasks,
    loadTasks,
    handleStatusChange,
    handleDelete,
    handleAddTask,
  };
}
