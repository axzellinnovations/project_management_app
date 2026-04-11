'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import { fetchTasksByProject } from '@/app/(project)/kanban/api';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import type { CreateTaskData } from '@/components/shared/CreateTaskModal';
import type { Task } from '@/types';
import { STATUS_ORDER } from '../lib/list-config';

const MEMBERS_CACHE_TTL_MS = 1000 * 60 * 30;

type MembersCacheEntry = {
  expiresAt: number;
  data: Record<number, string | null>;
};

type TaskEventPatch = {
  id: number;
  title: string;
  storyPoint: number;
  status: string;
  priority: string;
  sprintId: number | null;
  assigneeName: string | null;
  assigneePhotoUrl: string | null;
  startDate: string | null;
  dueDate: string | null;
};

const isHttpUrl = (value: string | null | undefined): value is string =>
  Boolean(value && (value.startsWith('http://') || value.startsWith('https://')));

const sanitizeTaskPhoto = (task: Task): Task => ({
  ...task,
  assigneePhotoUrl: isHttpUrl(task.assigneePhotoUrl) ? task.assigneePhotoUrl : undefined,
});

const normalizeTaskPatch = (patch: TaskEventPatch): Partial<Task> => ({
  id: patch.id,
  title: patch.title,
  storyPoint: patch.storyPoint,
  status: patch.status,
  priority: patch.priority,
  sprintId: patch.sprintId ?? undefined,
  assigneeName: patch.assigneeName ?? undefined,
  assigneePhotoUrl: isHttpUrl(patch.assigneePhotoUrl) ? patch.assigneePhotoUrl : undefined,
  startDate: patch.startDate ?? undefined,
  dueDate: patch.dueDate ?? undefined,
});

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
      try {
        const parsed = JSON.parse(cached) as MembersCacheEntry | Record<number, string | null>;
        if ('expiresAt' in parsed && 'data' in parsed) {
          if (parsed.expiresAt > Date.now()) {
            return parsed.data;
          }
        } else {
          const legacyHasInvalidValue = Object.values(parsed).some((value) => value && !isHttpUrl(value));
          if (!legacyHasInvalidValue) {
            return parsed;
          }
        }
      } catch {
        /* ignore */
      }
    }
    try {
      const res = await api.get(`/api/projects/${projectId}/members`);
      const map: Record<number, string | null> = {};
      (res.data as { user: { userId: number; profilePicUrl?: string } }[]).forEach((m) => {
        map[m.user.userId] = isHttpUrl(m.user.profilePicUrl) ? m.user.profilePicUrl : null;
      });
      const entry: MembersCacheEntry = {
        expiresAt: Date.now() + MEMBERS_CACHE_TTL_MS,
        data: map,
      };
      localStorage.setItem(membersCacheKey, JSON.stringify(entry));
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
        setTasks((JSON.parse(cached) as Task[]).map(sanitizeTaskPhoto));
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
      ).map(sanitizeTaskPhoto);
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
        const taskPatch = normalizeTaskPatch(event.task as TaskEventPatch);
        const next = prev.map((t) =>
          t.id === event.task!.id
            ? sanitizeTaskPhoto({
                ...t,
                ...taskPatch,
                assigneePhotoUrl: taskPatch.assigneePhotoUrl ?? t.assigneePhotoUrl,
              })
            : t
        );
        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next));
        return next;
      });
    } else if (event.type === 'TASK_CREATED' && event.task) {
      // Fetch the single new task for full data (labels, milestones etc.)
      void api.get(`/api/tasks/${event.task.id}`).then((res) => {
        setTasks((prev) => {
          if (prev.some((t) => t.id === event.task!.id)) return prev;
          const next = [...prev, sanitizeTaskPhoto(res.data as Task)];
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
