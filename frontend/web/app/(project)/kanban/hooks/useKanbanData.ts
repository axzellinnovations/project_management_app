'use client';

import { useState, useEffect, useCallback } from 'react';
import { Task, KanbanColumnConfig, Label } from '../types';
import {
  fetchTasksByProject,
  fetchKanbanBoard,
  fetchProjectLabels,
  fetchProject,
  fetchTeamMembers,
  TeamMemberOption,
} from '../api';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import { buildSessionCacheKey, getSessionCache, setSessionCache } from '@/lib/session-cache';

export const DEFAULT_COLUMN_CONFIGS: KanbanColumnConfig[] = [
  { id: 0, status: 'TODO', title: 'To Do', color: '', wipLimit: 0 },
  { id: 0, status: 'IN_PROGRESS', title: 'In Progress', color: '', wipLimit: 0 },
  { id: 0, status: 'IN_REVIEW', title: 'In Review', color: '', wipLimit: 0 },
  { id: 0, status: 'DONE', title: 'Done', color: '', wipLimit: 0 },
];

export function useKanbanData(projectId: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columnConfigs, setColumnConfigs] = useState<KanbanColumnConfig[]>(DEFAULT_COLUMN_CONFIGS);
  const [usersMap, setUsersMap] = useState<Record<string, string | null>>({});
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [kanbanId, setKanbanId] = useState<number | null>(null);
  const [activeMobileColumn, setActiveMobileColumn] = useState<string>(DEFAULT_COLUMN_CONFIGS[0].status);

  // ── Static Data (Run once per project) ──
  const fetchStaticData = useCallback(async () => {
    if (!projectId) return;
    const pid = Number(projectId);
    try {
      const [project, labelsData] = await Promise.all([
        fetchProject(pid),
        fetchProjectLabels(pid),
      ]);
      setLabels(labelsData);
      if (project?.teamId) {
        const members = await fetchTeamMembers(project.teamId as number);
        setTeamMembers(members);
        const map: Record<string, string | null> = {};
        members.forEach(m => { map[m.name] = null; });
        setUsersMap(map);
      }
    } catch (err) {
      console.error('Error loading static kanban data:', err);
    }
  }, [projectId]);

  // ── Dynamic Data (Periodic Sync) ──
  const fetchData = useCallback(async (options: { showSpinner?: boolean, forceNetwork?: boolean } = {}) => {
    if (!projectId) return;
    const { showSpinner = true, forceNetwork = false } = options;
    const pid = Number(projectId);

    const cKey = buildSessionCacheKey('kanban-board', [projectId]);
    if (cKey && !forceNetwork) {
      const cached = getSessionCache<{ columns: KanbanColumnConfig[]; tasks: Task[]; kanbanId: number | null }>(cKey, { allowStale: true });
      if (cached.data) {
        if (cached.data.columns?.length) {
          setColumnConfigs(cached.data.columns);
          setActiveMobileColumn(cached.data.columns[0].status);
        }
        if (cached.data.tasks) setTasks(cached.data.tasks);
        if (cached.data.kanbanId) setKanbanId(cached.data.kanbanId);
        setLoading(false);
        if (!cached.isStale) return; // Fresh cache
      }
    }

    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const [boardData, taskData] = await Promise.all([
        fetchKanbanBoard(pid),
        fetchTasksByProject(pid),
      ]);
      if (boardData?.columns?.length) {
        setColumnConfigs(boardData.columns);
        setActiveMobileColumn(boardData.columns[0].status);
      }
      if (boardData?.kanbanId) setKanbanId(boardData.kanbanId);
      setTasks(taskData);

      if (cKey) {
        setSessionCache(cKey, { columns: boardData?.columns ?? [], tasks: taskData, kanbanId: boardData?.kanbanId ?? null }, 30 * 60_000);
      }
    } catch (err) {
      console.error('Error loading kanban board:', err);
      if (showSpinner) setError('Failed to load board. Please refresh.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    void fetchStaticData();
    void fetchData({ showSpinner: true });
    const id = setInterval(() => void fetchData({ showSpinner: false }), 30_000);
    return () => clearInterval(id);
  }, [projectId, fetchStaticData, fetchData]);

  // WebSocket real-time task updates
  useTaskWebSocket(projectId, useCallback((event) => {
    if (event.type === 'TASK_CREATED' && event.task) {
      const t = event.task as Task;
      setTasks(prev => {
        if (prev.some(x => x.id === t.id)) return prev;
        return [...prev, t];
      });
    } else if (event.type === 'TASK_UPDATED' && event.task) {
      const t = event.task as Task;
      setTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...t } : x));
    } else if (event.type === 'TASK_DELETED' && event.taskId) {
      setTasks(prev => prev.filter(x => x.id !== event.taskId));
    }
  }, []));

  return {
    tasks,
    setTasks,
    loading,
    error,
    columnConfigs,
    setColumnConfigs,
    usersMap,
    teamMembers,
    labels,
    setLabels,
    kanbanId,
    activeMobileColumn,
    setActiveMobileColumn,
    forceRefresh: () => void fetchData({ showSpinner: false, forceNetwork: true }),
  };
}
