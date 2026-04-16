'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import { fetchTasksByProject } from '@/app/(project)/kanban/api';
import { getMilestones, assignTaskToMilestone } from '@/services/milestone-service';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import type { CreateTaskData } from '@/components/shared/CreateTaskModal';
import type { Label, MilestoneResponse, Task } from '@/types';
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
  assignees?: Array<{ id?: number; userId?: number; name?: string; username?: string; photoUrl?: string | null; avatar?: string | null }>;
  startDate: string | null;
  dueDate: string | null;
};

export type ListProjectMember = {
  id: number;
  memberId?: number;
  name: string;
  photoUrl?: string | null;
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
  assignees: Array.isArray(patch.assignees)
    ? patch.assignees.map((item) => ({
        id: Number(item.userId ?? item.id ?? 0),
        name: item.name ?? item.username ?? 'User',
        avatar: isHttpUrl(item.photoUrl) ? item.photoUrl : isHttpUrl(item.avatar) ? item.avatar : undefined,
      }))
    : undefined,
  startDate: patch.startDate ?? undefined,
  dueDate: patch.dueDate ?? undefined,
});

export function useListTasks() {
  const searchParams = useSearchParams();
  const projectIdStr = searchParams.get('projectId');
  const projectId = projectIdStr ? Number(projectIdStr) : null;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<ListProjectMember[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [milestones, setMilestones] = useState<MilestoneResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const loadRowEditDependencies = useCallback(async () => {
    if (!projectId) return;
    try {
      const [membersRes, labelsRes, milestonesRes] = await Promise.all([
        api.get(`/api/projects/${projectId}/members`),
        api.get(`/api/labels/project/${projectId}`),
        getMilestones(projectId),
      ]);
      const normalizedMembers = (membersRes.data as Array<{
        id?: number;
        user?: { userId?: number; fullName?: string; username?: string; profilePicUrl?: string | null };
      }>).map((item) => {
        const id = Number(item?.user?.userId ?? item?.id);
        const name = item?.user?.fullName || item?.user?.username || `User ${id}`;
        return {
          id,
          memberId: item?.id,
          name,
          photoUrl: isHttpUrl(item?.user?.profilePicUrl) ? item.user!.profilePicUrl : null,
        };
      }).filter((m) => Number.isFinite(m.id));
      setMembers(normalizedMembers);
      setLabels(Array.isArray(labelsRes.data) ? labelsRes.data : []);
      setMilestones(Array.isArray(milestonesRes) ? milestonesRes : []);
    } catch {
      setMembers([]);
      setLabels([]);
      setMilestones([]);
    }
  }, [projectId]);

  useEffect(() => { void loadTasks(); }, [loadTasks]);
  useEffect(() => { void loadRowEditDependencies(); }, [loadRowEditDependencies]);

  useEffect(() => {
    const onTaskUpdated = () => void loadTasks();
    window.addEventListener('planora:task-updated', onTaskUpdated);
    return () => window.removeEventListener('planora:task-updated', onTaskUpdated);
  }, [loadTasks]);

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

  const handleBulkStatusChange = useCallback(async (taskIds: number[], newStatus: string) => {
    if (taskIds.length === 0) return;
    setTasks((prev) => {
      const idSet = new Set(taskIds);
      const next = prev.map((t) => (idSet.has(t.id) ? { ...t, status: newStatus } : t));
      if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next));
      return next;
    });
    try {
      await api.patch('/api/tasks/bulk/status', { taskIds, status: newStatus });
    } catch {
      // Fallback for environments without bulk endpoint support
      await Promise.all(taskIds.map((id) => api.put(`/api/tasks/${id}`, { status: newStatus }).catch(() => null)));
      if (cacheKey) localStorage.removeItem(cacheKey);
      void loadTasks();
    }
  }, [cacheKey, loadTasks]);

  const handleBulkDelete = useCallback(async (taskIds: number[]) => {
    if (taskIds.length === 0) return;
    setTasks((prev) => {
      const idSet = new Set(taskIds);
      const next = prev.filter((t) => !idSet.has(t.id));
      if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next));
      return next;
    });
    try {
      await api.delete('/api/tasks/bulk', { data: { taskIds } });
    } catch {
      await Promise.all(taskIds.map((id) => api.delete(`/api/tasks/${id}`).catch(() => null)));
      if (cacheKey) localStorage.removeItem(cacheKey);
      void loadTasks();
    }
  }, [cacheKey, loadTasks]);

  const patchTaskOptimistic = useCallback((taskId: number, updates: Partial<Task>) => {
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t));
      if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(next));
      return next;
    });
  }, [cacheKey]);

  const handleDueDateChange = useCallback(async (taskId: number, dueDate: string | null) => {
    const previous = tasks.find((t) => t.id === taskId)?.dueDate;
    patchTaskOptimistic(taskId, { dueDate: dueDate ?? undefined });
    try {
      await api.patch(`/api/tasks/${taskId}/dates`, { dueDate });
    } catch {
      patchTaskOptimistic(taskId, { dueDate: previous });
    }
  }, [patchTaskOptimistic, tasks]);

  const handleAssigneeChange = useCallback(async (taskId: number, assigneeId: number | null) => {
    const previous = tasks.find((t) => t.id === taskId);
    const selectedMember = assigneeId ? members.find((m) => m.id === assigneeId) : null;
    patchTaskOptimistic(taskId, {
      assigneeId: assigneeId ?? undefined,
      assigneeName: selectedMember?.name,
      assigneePhotoUrl: selectedMember?.photoUrl ?? undefined,
    });
    try {
      if (assigneeId === null) await api.put(`/api/tasks/${taskId}`, { assigneeId: null });
      else await api.patch(`/api/tasks/${taskId}/assign/${assigneeId}`);
    } catch {
      if (previous) {
        patchTaskOptimistic(taskId, {
          assigneeId: previous.assigneeId,
          assigneeName: previous.assigneeName,
          assigneePhotoUrl: previous.assigneePhotoUrl,
        });
      }
    }
  }, [members, patchTaskOptimistic, tasks]);

  const handleAssigneesChange = useCallback(async (taskId: number, assigneeIds: number[]) => {
    const previous = tasks.find((t) => t.id === taskId);
    const selectedMembers = members.filter((member) => assigneeIds.includes(member.id));
    const nextAssignees = selectedMembers.map((member) => ({
      id: member.id,
      name: member.name,
      avatar: member.photoUrl ?? undefined,
    }));

    patchTaskOptimistic(taskId, {
      assignees: nextAssignees,
      assigneeIds,
      assigneeId: nextAssignees[0]?.id,
      assigneeName: nextAssignees[0]?.name,
      assigneePhotoUrl: nextAssignees[0]?.avatar ?? undefined,
    });

    try {
      await api.patch(`/api/tasks/${taskId}/assignees`, { assigneeIds });
    } catch {
      if (previous) {
        patchTaskOptimistic(taskId, {
          assignees: previous.assignees,
          assigneeIds: previous.assigneeIds,
          assigneeId: previous.assigneeId,
          assigneeName: previous.assigneeName,
          assigneePhotoUrl: previous.assigneePhotoUrl,
        });
      }
    }
  }, [members, patchTaskOptimistic, tasks]);

  const handleToggleTaskLabel = useCallback(async (taskId: number, label: Label, shouldAttach: boolean) => {
    const previous = tasks.find((t) => t.id === taskId)?.labels ?? [];
    patchTaskOptimistic(taskId, {
      labels: shouldAttach ? [...previous, label] : previous.filter((l) => l.id !== label.id),
    });
    try {
      if (shouldAttach) await api.post(`/api/tasks/${taskId}/label/${label.id}`);
      else await api.delete(`/api/tasks/${taskId}/label/${label.id}`);
    } catch {
      patchTaskOptimistic(taskId, { labels: previous });
    }
  }, [patchTaskOptimistic, tasks]);

  const handleMilestoneChange = useCallback(async (taskId: number, milestoneId: number | null) => {
    const previous = tasks.find((t) => t.id === taskId);
    const selected = milestoneId ? milestones.find((m) => m.id === milestoneId) : null;
    patchTaskOptimistic(taskId, {
      milestoneId: milestoneId ?? undefined,
      milestoneName: selected?.name,
    });
    try {
      await assignTaskToMilestone(taskId, milestoneId);
    } catch {
      if (previous) {
        patchTaskOptimistic(taskId, {
          milestoneId: previous.milestoneId,
          milestoneName: previous.milestoneName,
        });
      }
    }
  }, [milestones, patchTaskOptimistic, tasks]);

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

  const sortedTasks = useMemo(() => (
    [...tasks].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
  ), [tasks]);

  return {
    projectId,
    projectIdStr,
    tasks,
    loading,
    error,
    sortedTasks,
    members,
    labels,
    milestones,
    loadTasks,
    handleStatusChange,
    handleDelete,
    handleAddTask,
    handleBulkStatusChange,
    handleBulkDelete,
    handleDueDateChange,
    handleAssigneeChange,
    handleAssigneesChange,
    handleToggleTaskLabel,
    handleMilestoneChange,
  };
}
