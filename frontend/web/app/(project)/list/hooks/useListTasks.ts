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
  const membersCacheKey = projectId ? `planora:membersMap:${projectId}` : null;

  // Fetch project members to get profile photo URLs (keyed by userId)
  const loadMembersMap = useCallback(async (): Promise<Record<number, string | null>> => {
    if (!projectId || !membersCacheKey) return {};
    const cached = localStorage.getItem(membersCacheKey);
    if (cached) {
      try { return JSON.parse(cached) as Record<number, string | null>; } catch { /* ignore */ }
    }
    try {
      const res = await api.get(`/api/projects/${projectId}/members`);
      const map: Record<number, string | null> = {};
      (res.data as { user: { userId: number; profilePicUrl?: string } }[]).forEach((m) => {
        map[m.user.userId] = m.user.profilePicUrl ?? null;
      });
      localStorage.setItem(membersCacheKey, JSON.stringify(map));
      return map;
    } catch {
      return {};
    }
  }, [projectId, membersCacheKey]);

  const loadTasks = useCallback(async () => {
    if (!projectId || !cacheKey) return;
    // Serve stale data instantly
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setTasks(JSON.parse(cached) as Task[]);
        setLoading(false);
      } catch { /* ignore corrupt cache */ }
    }
    // Always revalidate in background; load tasks + member photos in parallel
    try {
      const [data, membersMap] = await Promise.all([
        fetchTasksByProject(projectId),
        loadMembersMap(),
      ]);
      const enriched = (data as Task[]).map((t) =>
        t.assigneeId && membersMap[t.assigneeId]
          ? { ...t, assigneePhotoUrl: membersMap[t.assigneeId] ?? undefined }
          : t
      );
      setTasks(enriched);
      localStorage.setItem(cacheKey, JSON.stringify(enriched));
    } catch {
      if (!cached) setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [projectId, cacheKey, loadMembersMap]);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  useTaskWebSocket(projectIdStr, useCallback((event) => {
    if (event.type === 'TASK_DELETED' && event.taskId) {
      setTasks((prev) => {
        const next = prev.filter((t) => t.id !== event.taskId);
        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next));
        return next;
      });
    } else if (event.type === 'TASK_UPDATED' && event.task) {
      // Merge partial fields — no API call needed
      setTasks((prev) => {
        const next = prev.map((t) =>
          t.id === event.task!.id ? { ...t, ...event.task } : t
        );
        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next));
        return next;
      });
    } else if (event.type === 'TASK_CREATED' && event.task) {
      // Fetch the single new task for full data (labels, milestones etc.)
      void api.get(`/api/tasks/${event.task.id}`).then((res) => {
        setTasks((prev) => {
          if (prev.some((t) => t.id === event.task!.id)) return prev;
          const next = [...prev, res.data as Task];
          if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next));
          return next;
        });
      }).catch(() => void loadTasks());
    }
  }, [loadTasks, cacheKey]));

  const handleStatusChange = useCallback(async (taskId: number, newStatus: string) => {
    setTasks((prev) => {
      const next = prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t);
      if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next));
      return next;
    });
    try {
      await api.put(`/api/tasks/${taskId}`, { status: newStatus });
    } catch {
      if (cacheKey) localStorage.removeItem(cacheKey);
      void loadTasks();
    }
  }, [loadTasks, cacheKey]);

  const handleDelete = useCallback(async (taskId: number) => {
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== taskId);
      if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next));
      return next;
    });
    try {
      await api.delete(`/api/tasks/${taskId}`);
    } catch {
      if (cacheKey) localStorage.removeItem(cacheKey);
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
        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next));
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
