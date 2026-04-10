'use client';

import { AlertTriangle, BarChart3, Rocket } from 'lucide-react';
import CreateSprintModal from './components/CreateSprintModal';
import BacklogCard from './components/BacklogCard';
import ProductBacklogSection from './components/ProductBacklogSection';
import FilterBar, { type BacklogFilters } from './components/FilterBar';
import BulkActionBar from './components/BulkActionBar';
import dynamic from 'next/dynamic';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
const VelocityChart = dynamic(() => import('./components/VelocityChart'), { ssr: false });
import type { SprintVelocityPoint } from './components/VelocityChart';
import api from '@/lib/axios';
import { getUserFromToken } from '@/lib/auth';
import { toast } from '@/components/ui';
import { getProjectLabels, createLabel } from '@/services/labels-service';
import type { TaskItem, SprintItem, Label } from '@/types';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import CreateTaskModal, { type CreateTaskData } from '@/components/shared/CreateTaskModal';

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
  labels?: Label[];
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
  const [velocityData, setVelocityData] = useState<SprintVelocityPoint[]>([]);
  const [projectKey, setProjectKey] = useState<string>('');
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [projectLabels, setProjectLabels] = useState<Array<{ id: number; name: string; color?: string }>>([]);
  const [activeBoardStatuses, setActiveBoardStatuses] = useState<Array<{ value: string; label: string }>>([]);
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
    labels: raw.labels ?? [],
  });

  useEffect(() => {
    if (!projectId) {
      setError('No project selected.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [sprintsRes, tasksRes, membersRes, projectRes, labelsRes] = await Promise.all([
          api.get(`/api/sprints/project/${projectId}`),
          api.get(`/api/tasks/project/${projectId}`),
          api.get(`/api/projects/${projectId}/members`),
          api.get(`/api/projects/${projectId}`),
          getProjectLabels(Number(projectId)),
        ]);

        const rawSprints = sprintsRes.data as { id: number; name: string; status: string; startDate?: string; endDate?: string }[];
        const rawTasks = tasksRes.data as RawTask[];
        setProjectLabels(Array.isArray(labelsRes) ? labelsRes : []);

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

        // Fetch active sprint board columns for custom status support
        const activeSprint = rawSprints.find((s: { status: string }) => s.status === 'ACTIVE');
        if (activeSprint) {
          try {
            const boardRes = await api.get(`/api/sprintboards/sprint/${activeSprint.id}`);
            const defaultStatuses = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
            const extra = (boardRes.data.columns ?? [])
              .filter((c: { columnStatus: string; columnName: string }) => !defaultStatuses.includes(c.columnStatus))
              .map((c: { columnStatus: string; columnName: string }) => ({ value: c.columnStatus, label: c.columnName }));
            setActiveBoardStatuses(extra);
          } catch {
            // silent — no custom statuses
          }
        }
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
      void createSprint(`${projectKey} Sprint ${sprints.length + 1}`);
    } else if (action === 'add-task') {
      setShowCreateTaskModal(true);
    }

    // Clean up URL
    const url = new URL(window.location.href);
    url.searchParams.delete('action');
    window.history.replaceState({}, '', url.toString());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Ctrl+N opens Create Task modal (NTH-5)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setShowCreateTaskModal(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch velocity data when chart is opened (FEATURE-1)
  useEffect(() => {
    if (!showVelocity || !projectId) return;
    api.get<SprintVelocityPoint[]>(`/api/burndown/project/${projectId}/velocity`)
      .then((res) => setVelocityData(res.data))
      .catch(() => setVelocityData([]));
  }, [showVelocity, projectId]);

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

  const LABEL_PALETTE = ['#EF4444','#F97316','#F59E0B','#84CC16','#22C55E','#14B8A6','#06B6D4','#3B82F6','#6366F1','#8B5CF6','#EC4899','#6B7280'];

  const handleCreateLabel = useCallback(async (name: string) => {
    const color = LABEL_PALETTE[Math.floor(Math.random() * LABEL_PALETTE.length)];
    const newLabel = await createLabel(Number(projectId), name, color);
    setProjectLabels((prev) => [...prev, newLabel]);
    return newLabel;
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (ids.length === 0) return;
    try {
      await api.patch('/api/tasks/bulk/status', { taskIds: ids, status });
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
      await api.delete('/api/tasks/bulk', { data: { taskIds: ids } });
      setProductTasks(prev => prev.filter(t => !t.selected));
      setSprints(prev => prev.map(s => ({ ...s, tasks: s.tasks.filter(t => !t.selected) })));
      toast(`Deleted ${ids.length} task(s)`, 'success');
    } catch {
      toast('Failed to delete tasks', 'error');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Sticky Header with Glassmorphism */}
      <div className="sticky top-0 z-40 w-full glass-panel border-b border-[#E4E7EC] px-4 py-4 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Project Backlog</h1>
            <p className="text-[13px] sm:text-[14px] text-slate-500 font-medium">Plan sprints and manage product tasks</p>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowVelocity(!showVelocity)}
              className={`flex h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-bold shadow-sm transition-all active:scale-95 ${
                showVelocity 
                  ? 'bg-slate-900 text-white hover:bg-slate-800' 
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <BarChart3 size={18} />
              <span className="hidden sm:inline">Velocity</span>
            </button>
            
            {(currentUserRole === 'OWNER' || currentUserRole === 'ADMIN') && (
              <button
                onClick={() => { void createSprint(`${projectKey} Sprint ${sprints.length + 1}`); }}
                className="flex h-10 sm:h-11 items-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl bg-[#155DFC] px-3 sm:px-5 text-[12px] sm:text-[13px] font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-[#1149C9] transform active:scale-95 transition-all duration-200"
              >
                <Rocket size={15} />
                <span className="whitespace-nowrap">Create Sprint</span>
              </button>
            )}
          </div>
        </div>

        <div className="mt-5">
          <FilterBar
            filters={filters}
            onChange={setFilters}
            assigneeNames={allAssigneeNames}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-8 custom-scrollbar">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 pb-32 sm:pb-8">
          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 w-full animate-pulse rounded-2xl bg-white shadow-sm border border-slate-100" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <div className="h-16 w-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h3>
              <p className="text-slate-500 max-w-sm text-center mb-8 px-6">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="h-12 px-8 bg-slate-900 text-white rounded-xl font-bold text-[14px] hover:bg-slate-800 transition-all active:scale-95"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Sprints Section */}
              <div className="space-y-8">
                {filteredSprints.length > 0 ? (
                  filteredSprints.map((sprint) => (
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
                      projectLabels={projectLabels}
                      onCreateLabel={handleCreateLabel}
                      extraStatuses={sprint.status === 'ACTIVE' ? activeBoardStatuses : []}
                    />
                  ))
                ) : !filters.search && (
                  <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="h-16 w-16 bg-slate-50 text-slate-400 rounded-3xl flex items-center justify-center mb-5">
                      <Rocket size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">No Active Sprints</h3>
                    <p className="text-slate-500 text-[14px] mb-8">Create a sprint to start planning your development cycle.</p>
                    <button
                      onClick={() => { void createSprint(`${projectKey} Sprint ${sprints.length + 1}`); }}
                      className="h-11 px-6 bg-[#155DFC] text-white rounded-xl font-bold text-[13px] hover:bg-[#1149C9] shadow-md shadow-blue-500/10 transition-all"
                    >
                      Create First Sprint
                    </button>
                  </div>
                )}
              </div>

              {/* Product Backlog Section */}
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
                onCreateSprint={() => { void createSprint(`${projectKey} Sprint ${sprints.length + 1}`); }}
                onDropTask={moveTaskToBacklog}
                onStatusChange={handleTaskStatusChange}
                onAssignTask={(taskId, assigneeName, assigneePhotoUrl) => {
                  setProductTasks((prev) =>
                    prev.map((t) => (t.id === taskId ? { ...t, assigneeName, assigneePhotoUrl } : t))
                  );
                }}
                externalShowCreateModal={showCreateTaskModal}
                onCloseCreateModal={() => setShowCreateTaskModal(false)}
                projectLabels={projectLabels}
                onCreateLabel={handleCreateLabel}
              />

              {showVelocity && <div className="mt-8"><VelocityChart sprints={velocityData} /></div>}
            </>
          )}
        </div>
      </div>

      {/* Floating Action Button (FAB) for Mobile with Gradient */}
      <button
        onClick={() => setShowCreateTaskModal(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 sm:hidden items-center justify-center rounded-2xl bg-gradient-to-br from-[#155DFC] to-[#004EEB] text-white shadow-xl shadow-blue-500/40 transform active:scale-95 transition-all duration-200"
      >
        <span className="text-2xl font-bold">+</span>
      </button>

      {selectedCount > 0 && (
        <BulkActionBar
          selectedCount={selectedCount}
          onClear={handleClearSelection}
          onMoveToSprint={handleBulkMoveToSprint}
          onMoveToBacklog={handleBulkMoveToBacklog}
          onStatusChange={handleBulkStatusChange}
          onDelete={handleBulkDelete}
          sprints={sprints.filter(s => s.status !== 'COMPLETED')}
        />
      )}

      {showCreateTaskModal && (
        <CreateTaskModal
          isOpen={showCreateTaskModal}
          onClose={() => setShowCreateTaskModal(false)}
          onCreateTask={createTask}
          projectId={Number(projectId!)}
        />
      )}

      <style jsx global>{`
        .glass-panel {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(12px) saturate(180%);
          -webkit-backdrop-filter: blur(12px) saturate(180%);
        }
      `}</style>
    </div>
  );
}