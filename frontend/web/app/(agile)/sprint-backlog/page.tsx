'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import BacklogCard from './components/BacklogCard';
import ProductBacklogSection from './components/ProductBacklogSection';
import api from '@/lib/axios';
import { getUserFromToken } from '@/lib/auth';

export interface TaskItem {
  id: number;
  taskNo: number;
  title: string;
  storyPoints: number;
  selected: boolean;
  assigneeName?: string;
  assigneePhotoUrl?: string | null;
  sprintId?: number | null;
  status?: string;
  startDate?: string;
  dueDate?: string;
  priority?: string;
}

export interface SprintItem {
  id: number;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
  tasks: TaskItem[];
}

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
  priority?: string;
  taskNo?: number;
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

  const mapRawTask = (raw: RawTask, index: number): TaskItem => ({
    id: raw.id,
    taskNo: raw.taskNo ?? index + 1,
    title: raw.title,
    storyPoints: raw.storyPoint,
    selected: false,
    assigneeName: raw.assigneeName ?? 'Unassigned',
    assigneePhotoUrl: raw.assigneePhotoUrl ?? null,
    sprintId: raw.sprintId ?? null,
    status: raw.status ?? 'TODO',
    startDate: raw.startDate ?? '',
    dueDate: raw.dueDate ?? '',
    priority: raw.priority ?? 'LOW',
  });

  useEffect(() => {
    if (!projectId) {
      setError('No project selected.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [sprintsRes, tasksRes, membersRes] = await Promise.all([
          api.get(`/api/sprints/project/${projectId}`),
          api.get(`/api/tasks/project/${projectId}`),
          api.get(`/api/project-members/project/${projectId}`),
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

        setSprints(rawSprints.map((s: { id: number; name: string; status: string; startDate?: string; endDate?: string }) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          startDate: s.startDate,
          endDate: s.endDate,
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
      // silently fail — local state already updated
    }
  };

  const createTask = async (title: string) => {
    const trimmed = title.trim();
    if (!trimmed || !projectId) return;

    try {
      const response = await api.post('/api/tasks', {
        projectId: Number(projectId),
        title: trimmed,
        storyPoint: 0,
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
      setProductTasks((prev) => [...prev, newTask]);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      alert(axiosErr?.response?.data?.message || 'Failed to create task.');
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
            ? { ...s, tasks: [...s.tasks, { ...newTask, taskNo: s.tasks.length + 1 }] }
            : s
        )
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      alert(axiosErr?.response?.data?.message || 'Failed to create task.');
    }
  };

  const createSprint = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !projectId) return;

    try {
      const response = await api.post('/api/sprints', {
        proId: Number(projectId),
        name: trimmed,
        startDate: null,
        endDate: null,
      });
      const created = response.data as { id: number; name: string; status: string; startDate?: string; endDate?: string };

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
        tasks: cleanedTasks
      }]);
      if (selectedTasks.length > 0) setProductTasks(remainingTasks);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      alert(axiosErr?.response?.data?.message || 'Failed to create sprint.');
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
      alert(axiosErr?.response?.data?.message || 'Failed to move task.');
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
      alert(axiosErr?.response?.data?.message || 'Failed to move task back to backlog.');
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
      alert(axiosErr?.response?.data?.message || 'Failed to update status.');
    }
  };

  const handleSprintDeleted = (sprintId: number, tasks: SprintItem['tasks']) => {
    setSprints(prev => prev.filter(s => s.id !== sprintId));
    setProductTasks(prev => [
      ...prev,
      ...tasks.map(t => ({ ...t, sprintId: null })),
    ]);
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
              <p className="text-red-500 text-lg font-semibold">{error}</p>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              {sprints.map((sprint) => (
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
                tasks={productTasks}
                projectId={projectId!}
                currentUserRole={currentUserRole}
                onToggleTask={toggleTaskSelection}
                onStoryPointsChange={updateTaskStoryPoints}
                onCreateTask={createTask}
                onDeleteTask={(taskId) => {
                  setProductTasks((prev) => prev.filter((t) => t.id !== taskId));
                }}
                onCreateSprint={createSprint}
                onDropTask={moveTaskToBacklog}
                onStatusChange={handleTaskStatusChange}
                onAssignTask={(taskId, assigneeName, assigneePhotoUrl) => {
                  setProductTasks((prev) =>
                    prev.map((t) => (t.id === taskId ? { ...t, assigneeName, assigneePhotoUrl } : t))
                  );
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}