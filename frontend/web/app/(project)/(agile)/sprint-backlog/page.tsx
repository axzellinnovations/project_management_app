'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import BacklogCard from './components/BacklogCard';
import ProductBacklogSection from './components/ProductBacklogSection';
import FilterBar, { type BacklogFilters } from './components/FilterBar';
import BulkActionBar from './components/BulkActionBar';
import dynamic from 'next/dynamic';
const VelocityChart = dynamic(() => import('./components/VelocityChart'), { ssr: false });
import api from '@/lib/axios';
import { getUserFromToken } from '@/lib/auth';
import { toast } from '@/components/ui';
import type { TaskItem, SprintItem } from '@/types';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import { type CreateTaskData } from '@/components/shared/CreateTaskModal';
import CreateSprintModal from './components/CreateSprintModal';

type RawTask = {
  id: number;
  title: string;
  storyPoint: number;
  assigneeName?: string;
  assigneePhotoUrl?: string | null;
  sprintId?: number | null;
  status?: string;
  startDate?: string;
  dueDate?: string;
};

export default function SprintBacklogPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('projectId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productTasks, setProductTasks] = useState<TaskItem[]>([]);
  const [sprints, setSprints] = useState<SprintItem[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [showVelocity, setShowVelocity] = useState(false);
  const [projectKey, setProjectKey] = useState<string>('');
  const [showCreateSprintModal, setShowCreateSprintModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [filters, setFilters] = useState<BacklogFilters>({
    search: '',
    statuses: [],
    priorities: [],
    assignee: '',
  });

  // Derive unique assignee names for the filter dropdown
  const allAssigneeNames = useMemo(() => {
    const names = new Set<string>();
    productTasks.forEach((t) => { if (t.assigneeName && t.assigneeName !== 'Unassigned') names.add(t.assigneeName); });
    sprints.forEach((s) => s.tasks.forEach((t) => { if (t.assigneeName && t.assigneeName !== 'Unassigned') names.add(t.assigneeName); }));
    return Array.from(names).sort();
  }, [productTasks, sprints]);

  // Filtered data
  const applyFilters = (tasks: TaskItem[]): TaskItem[] => {
    return tasks.filter((t) => {
      if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.statuses.length > 0 && !filters.statuses.includes(t.status ?? 'TODO')) return false;
      if (filters.priorities.length > 0 && !filters.priorities.includes(t.priority ?? 'LOW')) return false;
      if (filters.assignee && t.assigneeName !== filters.assignee) return false;
      return true;
    });
  };

  const filteredProductTasks = useMemo(() => applyFilters(productTasks), [productTasks, filters]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredSprints = useMemo(() => {
    return sprints
      .filter((s) => s.status !== 'COMPLETED')
      .map((s) => ({ ...s, tasks: applyFilters(s.tasks) }));
  }, [sprints, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const mapRawTask = (raw: RawTask, index: number): TaskItem => ({
    id: raw.id,
    taskNo: index + 1,
    title: raw.title,
    storyPoints: raw.storyPoint,
    selected: false,
    assigneeName: raw.assigneeName ?? 'Unassigned',
    assigneePhotoUrl: raw.assigneePhotoUrl ?? null,
    sprintId: raw.sprintId ?? null,
    status: raw.status ?? 'TODO',
    startDate: raw.startDate ?? '',
    dueDate: raw.dueDate ?? '',
  });

  useEffect(() => {
    if (!projectId) {
      setError('No project selected.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [sprintsRes, tasksRes, membersRes, projectRes] = await Promise.all([
          api.get(`/api/sprints/project/${projectId}`),
          api.get(`/api/tasks/project/${projectId}`),
          api.get(`/api/projects/${projectId}/members`),
          api.get(`/api/projects/${projectId}`),
        ]);

        const rawSprints = sprintsRes.data as { id: number; name: string; status: string; startDate?: string; endDate?: string }[];
        const rawTasks = tasksRes.data as RawTask[];

        interface ProjectMember {
          user: {
            userId: number;
            email?: string;
          };
          role: string;
        }

        const membersData = membersRes.data as ProjectMember[];

        // Determine user role
        const currentUser = getUserFromToken();
        if (currentUser && membersData) {
          const projectMember = membersData.find((m: ProjectMember) =>
            m.user.userId === currentUser.userId || (currentUser.email && m.user.email?.toLowerCase() === currentUser.email.toLowerCase())
          );
          if (projectMember) {
            setCurrentUserRole(projectMember.role);
          }
        }
        setProjectKey((projectRes.data as { projectKey?: string }).projectKey || '');

        const mappedTasks = rawTasks.map((t, i) => mapRawTask(t, i));

        const backlogTasks = mappedTasks.filter((t) => !t.sprintId);

        const sprintTaskMap = new Map<number, TaskItem[]>();
        mappedTasks
          .filter((t) => t.sprintId)
          .forEach((t) => {
            const sid = t.sprintId!;
            if (!sprintTaskMap.has(sid)) sprintTaskMap.set(sid, []);
            sprintTaskMap.get(sid)!.push(t);
          });

        setSprints(rawSprints.map((s: { id: number; name: string; status: string; startDate?: string; endDate?: string; goal?: string }) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          startDate: s.startDate,
          endDate: s.endDate,
          goal: s.goal ?? '',
          tasks: sprintTaskMap.get(s.id) ?? []
        })));
        setProductTasks(backlogTasks);
        setError(null);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr?.response?.data?.message || 'Access denied or project not found.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  // WebSocket: live task updates from other users
  useTaskWebSocket(projectId, useCallback((event) => {
    if (event.type === 'TASK_CREATED' && event.task) {
      const t = event.task;
      const newTask: TaskItem = {
        id: t.id,
        taskNo: 0,
        title: t.title,
        storyPoints: t.storyPoint ?? 0,
        selected: false,
        assigneeName: t.assigneeName ?? 'Unassigned',
        assigneePhotoUrl: t.assigneePhotoUrl ?? null,
        sprintId: t.sprintId ?? null,
        status: t.status ?? 'TODO',
        priority: t.priority ?? 'LOW',
      };
      if (newTask.sprintId) {
        setSprints(prev => prev.map(s =>
          s.id === newTask.sprintId
            ? { ...s, tasks: [...s.tasks.filter(x => x.id !== newTask.id), newTask] }
            : s
        ));
      } else {
        setProductTasks(prev => [...prev.filter(x => x.id !== newTask.id), newTask]);
      }
    } else if (event.type === 'TASK_UPDATED' && event.task) {
      const t = event.task;
      const updated: Partial<TaskItem> = {
        title: t.title,
        storyPoints: t.storyPoint ?? 0,
        status: t.status ?? 'TODO',
        priority: t.priority ?? 'LOW',
        assigneeName: t.assigneeName ?? 'Unassigned',
        assigneePhotoUrl: t.assigneePhotoUrl ?? null,
        sprintId: t.sprintId ?? null,
      };
      setProductTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...updated } : x));
      setSprints(prev => prev.map(s => ({
        ...s, tasks: s.tasks.map(x => x.id === t.id ? { ...x, ...updated } : x)
      })));
    } else if (event.type === 'TASK_DELETED' && event.taskId) {
      const deletedId = event.taskId;
      setProductTasks(prev => prev.filter(x => x.id !== deletedId));
      setSprints(prev => prev.map(s => ({
        ...s, tasks: s.tasks.filter(x => x.id !== deletedId)
      })));
    }
  }, []));

  // Handle Action Triggers from TopBar
  useEffect(() => {
    const action = searchParams.get('action');
    if (!action) return;

    if (action === 'create-sprint') {
      setShowCreateSprintModal(true);
    } else if (action === 'add-task') {
      setShowCreateTaskModal(true);
    }

    // Clean up URL
    const url = new URL(window.location.href);
    url.searchParams.delete('action');
    window.history.replaceState({}, '', url.toString());
  }, [searchParams]);

  const toggleTaskSelection = (id: number) => {
    setProductTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, selected: !task.selected } : task))
    );
    setSprints((prev) =>
      prev.map((sprint) => ({
        ...sprint,
        tasks: sprint.tasks.map((task) =>
          task.id === id ? { ...task, selected: !task.selected } : task
        ),
      }))
    );
  };

  const updateTaskStoryPoints = async (id: number, points: number) => {
    const value = Number.isNaN(points) ? 0 : points;
    setProductTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, storyPoints: value } : task
      )
    );
    try {
      await api.put(`/api/tasks/${id}`, { storyPoint: value });
    } catch {
      toast('Failed to update story points', 'error');
    }
  };

  const createTask = async (data: CreateTaskData) => {
    const trimmed = data.title.trim();
    if (!trimmed || !projectId) return;

    try {
      const response = await api.post('/api/tasks', {
        projectId: Number(projectId),
        title: trimmed,
        storyPoint: data.storyPoint ?? 0,
        priority: data.priority ?? 'MEDIUM',
        assigneeId: data.assigneeId,
        labelIds: data.labelIds,
      });
      const raw = response.data as RawTask;
      const newTask: TaskItem = {
        id: raw.id,
        taskNo: productTasks.length + 1,
        title: raw.title,
        storyPoints: raw.storyPoint,
        selected: false,
        assigneeName: 'Unassigned',
        sprintId: null,
      };
      setProductTasks((prev) => [...prev.filter((x) => x.id !== raw.id), newTask]);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast(axiosErr?.response?.data?.message || 'Failed to create task.', 'error');
    }
  };

  const createSprintTask = async (title: string, sprintId: number) => {
    const trimmed = title.trim();
    if (!trimmed || !projectId) return;

    try {
      const response = await api.post('/api/tasks', {
        projectId: Number(projectId),
        title: trimmed,
        storyPoint: 0,
        sprintId,
      });
      const raw = response.data as RawTask;
      const newTask: TaskItem = {
        id: raw.id,
        taskNo: 0,
        title: raw.title,
        storyPoints: raw.storyPoint,
        selected: false,
        assigneeName: 'Unassigned',
        sprintId,
      };
      setSprints((prev) =>
        prev.map((s) =>
          s.id === sprintId
            ? { ...s, tasks: [...s.tasks.filter((x) => x.id !== newTask.id), { ...newTask, taskNo: s.tasks.length + 1 }] }
            : s
        )
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast(axiosErr?.response?.data?.message || 'Failed to create task.', 'error');
    }
  };

  const createSprint = async (name: string, startDate?: string, endDate?: string, goal?: string) => {
    const trimmed = name.trim();
    if (!trimmed || !projectId) return;

    try {
      const response = await api.post('/api/sprints', {
        proId: Number(projectId),
        name: trimmed,
        startDate: startDate || null,
        endDate: endDate || null,
        goal: goal || null,
      });
      const created = response.data as { id: number; name: string; status: string; startDate?: string; endDate?: string; goal?: string };

      const selectedTasks = productTasks.filter((task) => task.selected);
      const remainingTasks = productTasks.filter((task) => !task.selected);

      await Promise.all(
        selectedTasks.map((task) => api.put(`/api/tasks/${task.id}`, { sprintId: created.id }))
      );

      const cleanedTasks = selectedTasks.map((task) => ({ ...task, selected: false, sprintId: created.id }));
      setSprints((prev) => [...prev, {
        id: created.id,
        name: created.name,
        status: created.status,
        startDate: created.startDate,
        endDate: created.endDate,
        goal: created.goal ?? '',
        tasks: cleanedTasks
      }]);
      if (selectedTasks.length > 0) setProductTasks(remainingTasks);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast(axiosErr?.response?.data?.message || 'Failed to create sprint.', 'error');
    }
  };

  const moveTaskToSprint = async (taskId: number, sprintId: number) => {
    // 1. Find the task in productTasks or any other sprint
    let draggedTask = productTasks.find((task) => task.id === taskId);
    let fromSprintId: number | null = null;

    if (!draggedTask) {
      for (const sprint of sprints) {
        draggedTask = sprint.tasks.find((task) => task.id === taskId);
        if (draggedTask) {
          fromSprintId = sprint.id;
          break;
        }
      }
    }

    if (!draggedTask) return;
    if (fromSprintId === sprintId) return; // Dropped in the same sprint

    try {
      await api.put(`/api/tasks/${taskId}`, { sprintId });

      // Update state locally
      if (fromSprintId === null) {
        // From backlog to sprint
        setProductTasks((prev) => prev.filter((t) => t.id !== taskId));
      } else {
        // Between sprints
        setSprints((prev) =>
          prev.map((s) =>
            s.id === fromSprintId
              ? { ...s, tasks: s.tasks.filter((t) => t.id !== taskId) }
              : s
          )
        );
      }

      setSprints((prev) =>
        prev.map((sprint) =>
          sprint.id === sprintId
            ? { ...sprint, tasks: [...sprint.tasks, { ...draggedTask!, sprintId }] }
            : sprint
        )
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast(axiosErr?.response?.data?.message || 'Failed to move task.', 'error');
    }
  };

  const moveTaskToBacklog = async (taskId: number) => {
    // 1. Find task in sprints
    let draggedTask: TaskItem | undefined;
    let fromSprintId: number | undefined;

    for (const sprint of sprints) {
      draggedTask = sprint.tasks.find((task) => task.id === taskId);
      if (draggedTask) {
        fromSprintId = sprint.id;
        break;
      }
    }

    // If not found in sprints, it's already in the backlog or not found at all
    if (!draggedTask || !fromSprintId) return;

    try {
      await api.put(`/api/tasks/${taskId}`, { sprintId: null });

      // Update state locally
      setSprints((prev) =>
        prev.map((s) =>
          s.id === fromSprintId
            ? { ...s, tasks: s.tasks.filter((t) => t.id !== taskId) }
            : s
        )
      );
      setProductTasks((prev) => [...prev, { ...draggedTask!, sprintId: null }]);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast(axiosErr?.response?.data?.message || 'Failed to move task back to backlog.', 'error');
    }
  };

  const handleTaskStatusChange = async (taskId: number, newStatus: string) => {
    try {
      await api.put(`/api/tasks/${taskId}`, { status: newStatus });

      // Update local state in both productTasks and sprints
      setProductTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      setSprints(prev => prev.map(s => ({
        ...s,
        tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
      })));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast(axiosErr?.response?.data?.message || 'Failed to update status.', 'error');
    }
  };

  const handleSprintDeleted = (sprintId: number, tasks: SprintItem['tasks']) => {
    setSprints(prev => prev.filter(s => s.id !== sprintId));
    setProductTasks(prev => [
      ...prev,
      ...tasks.map(t => ({ ...t, sprintId: null })),
    ]);
  };

  // Bulk action helpers
  const selectedCount = useMemo(() => {
    const backlogSelected = productTasks.filter(t => t.selected).length;
    const sprintSelected = sprints.reduce((acc, s) => acc + s.tasks.filter(t => t.selected).length, 0);
    return backlogSelected + sprintSelected;
  }, [productTasks, sprints]);

  const getSelectedTaskIds = useCallback((): number[] => {
    const ids: number[] = [];
    productTasks.forEach(t => { if (t.selected) ids.push(t.id); });
    sprints.forEach(s => s.tasks.forEach(t => { if (t.selected) ids.push(t.id); }));
    return ids;
  }, [productTasks, sprints]);

  const handleClearSelection = () => {
    setProductTasks(prev => prev.map(t => ({ ...t, selected: false })));
    setSprints(prev => prev.map(s => ({
      ...s, tasks: s.tasks.map(t => ({ ...t, selected: false }))
    })));
  };

  const handleBulkMoveToSprint = async (targetSprintId: number) => {
    const ids = getSelectedTaskIds();
    try {
      await Promise.all(ids.map(id => api.put(`/api/tasks/${id}`, { sprintId: targetSprintId })));

      // Collect all selected tasks from backlog and other sprints
      const movedFromBacklog = productTasks.filter(t => t.selected);
      const movedFromSprints: TaskItem[] = [];
      sprints.forEach(s => {
        if (s.id !== targetSprintId) {
          s.tasks.filter(t => t.selected).forEach(t => movedFromSprints.push(t));
        }
      });
      const allMoved = [...movedFromBacklog, ...movedFromSprints].map(t => ({ ...t, selected: false, sprintId: targetSprintId }));

      setProductTasks(prev => prev.filter(t => !t.selected));
      setSprints(prev => prev.map(s => {
        if (s.id === targetSprintId) {
          // Add moved tasks, also deselect existing selected in target
          const kept = s.tasks.filter(t => !t.selected).map(t => ({ ...t, selected: false }));
          return { ...s, tasks: [...kept, ...allMoved] };
        }
        return { ...s, tasks: s.tasks.filter(t => !t.selected) };
      }));
      toast(`Moved ${ids.length} task(s) to sprint`, 'success');
    } catch {
      toast('Failed to move tasks', 'error');
    }
  };

  const handleBulkMoveToBacklog = async () => {
    const ids: number[] = [];
    const movedTasks: TaskItem[] = [];
    sprints.forEach(s => s.tasks.forEach(t => {
      if (t.selected) { ids.push(t.id); movedTasks.push({ ...t, selected: false, sprintId: null }); }
    }));
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map(id => api.put(`/api/tasks/${id}`, { sprintId: null })));
      setSprints(prev => prev.map(s => ({ ...s, tasks: s.tasks.filter(t => !t.selected) })));
      setProductTasks(prev => [...prev.map(t => ({ ...t, selected: false })), ...movedTasks]);
      toast(`Moved ${ids.length} task(s) to backlog`, 'success');
    } catch {
      toast('Failed to move tasks to backlog', 'error');
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    const ids = getSelectedTaskIds();
    try {
      await Promise.all(ids.map(id => api.put(`/api/tasks/${id}`, { status })));
      setProductTasks(prev => prev.map(t => t.selected ? { ...t, status, selected: false } : t));
      setSprints(prev => prev.map(s => ({
        ...s, tasks: s.tasks.map(t => t.selected ? { ...t, status, selected: false } : t)
      })));
      toast(`Updated ${ids.length} task(s) to ${status.replace('_', ' ')}`, 'success');
    } catch {
      toast('Failed to update task statuses', 'error');
    }
  };

  const handleBulkDelete = async () => {
    const ids = getSelectedTaskIds();
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map(id => api.delete(`/api/tasks/${id}`)));
      setProductTasks(prev => prev.filter(t => !t.selected));
      setSprints(prev => prev.map(s => ({ ...s, tasks: s.tasks.filter(t => !t.selected) })));
      toast(`Deleted ${ids.length} task(s)`, 'success');
    } catch {
      toast('Failed to delete tasks', 'error');
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#F8F9FB]">
      <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-28 sm:pb-8">
          {loading && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton rounded-xl h-32" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              </div>
              <p className="text-red-500 text-lg font-semibold">{error}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    window.location.reload();
                  }}
                  className="px-4 py-2 bg-[#155DFC] text-white rounded-lg font-bold text-sm hover:bg-[#1149C9] transition-all"
                >
                  Retry
                </button>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-4 py-2 border border-[#D0D5DD] text-[#344054] rounded-lg font-bold text-sm hover:bg-[#F9FAFB] transition-all"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              <FilterBar
                filters={filters}
                onChange={setFilters}
                assigneeNames={allAssigneeNames}
              />

              {/* ── Column header bar ── */}
              <div className="hidden sm:grid items-center border border-[#EAECF0] rounded-lg bg-[#F2F4F7] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#667085] select-none" style={{ gridTemplateColumns: '28px 3px 44px 72px 1fr 36px 110px 88px 40px 52px' }}>
                <span />
                <span />
                <span>#</span>
                <span>Priority</span>
                <span className="pl-2">Title</span>
                <span className="text-center">Assignee</span>
                <span className="text-center">Status</span>
                <span className="text-center">Due</span>
                <span className="text-center">Pts</span>
                <span />
              </div>

              {filteredSprints.map((sprint) => (
                <BacklogCard
                  key={sprint.id}
                  sprint={sprint}
                  projectId={projectId!}
                  currentUserRole={currentUserRole}
                  onDropTask={moveTaskToSprint}
                  onCreateTask={createSprintTask}
                  onToggleTask={toggleTaskSelection}
                  onDeleteTask={(taskId, sprintId) => {
                    setSprints((prev) =>
                      prev.map((s) =>
                        s.id === sprintId
                          ? { ...s, tasks: s.tasks.filter((t) => t.id !== taskId) }
                          : s
                      )
                    );
                  }}
                  onSprintDeleted={handleSprintDeleted}
                />
              ))}

              <ProductBacklogSection
                tasks={filteredProductTasks}
                projectId={projectId!}
                projectKey={projectKey}
                sprintCount={sprints.length}
                currentUserRole={currentUserRole}
                onToggleTask={toggleTaskSelection}
                onStoryPointsChange={updateTaskStoryPoints}
                onCreateTask={createTask}
                onDeleteTask={(taskId) => {
                  setProductTasks((prev) => prev.filter((t) => t.id !== taskId));
                }}
                onCreateSprint={() => setShowCreateSprintModal(true)}
                onDropTask={moveTaskToBacklog}
                onStatusChange={handleTaskStatusChange}
                onAssignTask={(taskId, assigneeName, assigneePhotoUrl) => {
                  setProductTasks((prev) =>
                    prev.map((t) => (t.id === taskId ? { ...t, assigneeName, assigneePhotoUrl } : t))
                  );
                }}
                externalShowCreateModal={showCreateTaskModal}
                onCloseCreateModal={() => setShowCreateTaskModal(false)}
              />

              <CreateSprintModal
                isOpen={showCreateSprintModal}
                onClose={() => setShowCreateSprintModal(false)}
                onCreateSprint={createSprint}
                defaultName={`${projectKey || 'Sprint'} ${sprints.length + 1}`}
              />

              {sprints.length > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowVelocity((v) => !v)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors ${showVelocity
                        ? 'border-[#175CD3] bg-[#EFF8FF] text-[#175CD3]'
                        : 'border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB]'
                      }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                    {showVelocity ? 'Hide Velocity' : 'Show Velocity'}
                  </button>
                </div>
              )}
              {showVelocity && sprints.length > 0 && <VelocityChart sprints={sprints} />}

              <BulkActionBar
                selectedCount={selectedCount}
                sprints={sprints}
                onMoveToSprint={handleBulkMoveToSprint}
                onMoveToBacklog={handleBulkMoveToBacklog}
                onBulkStatusChange={handleBulkStatusChange}
                onBulkDelete={handleBulkDelete}
                onClearSelection={handleClearSelection}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}