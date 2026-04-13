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

  // Load board columns + tasks
  useEffect(() => {
    if (!projectId) return;
    const pid = Number(projectId);

    const loadBoard = async () => {
      const cacheKey = `planora:kanban:${projectId}`;
      // Stale-while-revalidate: show cached data immediately
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { columns: cc, tasks: ct, timestamp } = JSON.parse(cached) as { columns: KanbanColumnConfig[]; tasks: Task[]; timestamp?: number };
          
          // Only use cache if it's less than 1 hour old to keep it "fresh" per session
          const isFresh = timestamp && (Date.now() - timestamp < 3600000); // 1 hour
          
          if (isFresh || !navigator.onLine) {
            if (cc?.length) { setColumnConfigs(cc); setActiveMobileColumn(cc[0].status); }
            if (ct) setTasks(ct);
            // If it's truly fresh, we can skip the initial loading spinner
            if (isFresh) setLoading(false);
          }
        }
      } catch { /* ignore corrupt cache */ }

      setLoading(prev => prev === false ? false : true);
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
        if (boardData?.kanbanId) {
          setKanbanId(boardData.kanbanId);
        }
        setTasks(taskData);
        // Update cache with timestamp
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            columns: boardData?.columns?.length ? boardData.columns : undefined,
            tasks: taskData,
            timestamp: Date.now(),
          }));
        } catch { /* storage full / SSR */ }
      } catch (err) {
        console.error('Error loading kanban board:', err);
        setError('Failed to load board. Please refresh.');
      } finally {
        setLoading(false);
      }
    };

    loadBoard();
  }, [projectId]);

  // Load team members
  useEffect(() => {
    if (!projectId) return;
    const pid = Number(projectId);

    const loadTeam = async () => {
      try {
        const project = await fetchProject(pid);
        if (project?.teamId) {
          const members = await fetchTeamMembers(project.teamId as number);
          setTeamMembers(members);
          const map: Record<string, string | null> = {};
          members.forEach(m => { map[m.name] = null; });
          setUsersMap(map);
        }
      } catch (err) {
        console.error('Error loading team members:', err);
      }
    };

    loadTeam();
  }, [projectId]);

  // Load project labels
  useEffect(() => {
    if (!projectId) return;
    fetchProjectLabels(Number(projectId)).then(setLabels).catch(() => {});
  }, [projectId]);

  // WebSocket real-time task updates
  useTaskWebSocket(projectId, useCallback((event) => {
    if (event.type === 'TASK_CREATED' && event.task) {
      const t = event.task;
      setTasks(prev => {
        if (prev.some(x => x.id === t.id)) return prev;
        return [...prev, {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          assigneeName: t.assigneeName ?? undefined,
          assigneePhotoUrl: t.assigneePhotoUrl,
          startDate: t.startDate ?? undefined,
          dueDate: t.dueDate ?? undefined,
        } as Task];
      });
    } else if (event.type === 'TASK_UPDATED' && event.task) {
      const t = event.task;
      setTasks(prev => prev.map(x => x.id === t.id ? {
        ...x,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assigneeName: t.assigneeName ?? undefined,
        assigneePhotoUrl: t.assigneePhotoUrl,
        startDate: t.startDate ?? undefined,
        dueDate: t.dueDate ?? undefined,
      } : x));
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
  };
}
