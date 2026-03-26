'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import BacklogCard from './components/BacklogCard';
import ProductBacklogSection from './components/ProductBacklogSection';
import api from '@/lib/axios';

export interface TaskItem {
  id: number;
  taskNo: number;
  title: string;
  storyPoints: number;
  selected: boolean;
  assigneeName?: string;
  sprintId?: number | null;
  status?: string;
  startDate?: string;
  dueDate?: string;
}

export interface SprintItem {
  id: number;
  name: string;
  tasks: TaskItem[];
}

type RawTask = {
  id: number;
  title: string;
  storyPoint: number;
  assigneeName?: string;
  sprintId?: number | null;
  status?: string;
  startDate?: string;
  dueDate?: string;
};

function SprintBacklogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('projectId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productTasks, setProductTasks] = useState<TaskItem[]>([]);
  const [sprints, setSprints] = useState<SprintItem[]>([]);

  const mapRawTask = (raw: RawTask, index: number): TaskItem => ({
    id: raw.id,
    taskNo: index + 1,
    title: raw.title,
    storyPoints: raw.storyPoint,
    selected: false,
    assigneeName: raw.assigneeName ?? 'Unassigned',
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
        const [sprintsRes, tasksRes] = await Promise.all([
          api.get(`/api/sprints/project/${projectId}`),
          api.get(`/api/tasks/project/${projectId}`),
        ]);

        const rawSprints = sprintsRes.data as { id: number; name: string }[];
        const rawTasks = tasksRes.data as RawTask[];
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

        setSprints(rawSprints.map((s) => ({ id: s.id, name: s.name, tasks: sprintTaskMap.get(s.id) ?? [] })));
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const toggleTaskSelection = (id: number) => {
    setProductTasks((prev) =>
      prev.map((task) => task.id === id ? { ...task, selected: !task.selected } : task)
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

  const createSprint = async (name: string, startDate: string = new Date().toISOString().split('T')[0], endDate: string = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) => {
    const trimmed = name.trim();
    if (!trimmed || !projectId) return;

    try {
      const response = await api.post('/api/sprints', {
        proId: Number(projectId),
        name: trimmed,
        startDate,
        endDate,
      });
      const created = response.data as { id: number; name: string };

      const selectedTasks = productTasks.filter((task) => task.selected);
      const remainingTasks = productTasks.filter((task) => !task.selected);

      await Promise.all(
        selectedTasks.map((task) => api.put(`/api/tasks/${task.id}`, { sprintId: created.id }))
      );

      const cleanedTasks = selectedTasks.map((task) => ({ ...task, selected: false, sprintId: created.id }));
      setSprints((prev) => [...prev, { id: created.id, name: created.name, tasks: cleanedTasks }]);
      if (selectedTasks.length > 0) setProductTasks(remainingTasks);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      alert(axiosErr?.response?.data?.message || 'Failed to create sprint.');
    }
  };

  const moveTaskToSprint = async (taskId: number, sprintId: number) => {
    const draggedTask = productTasks.find((task) => task.id === taskId);
    if (!draggedTask) return;

    try {
      await api.put(`/api/tasks/${taskId}`, { sprintId });
      setSprints((prev) =>
        prev.map((sprint) =>
          sprint.id === sprintId
            ? { ...sprint, tasks: [...sprint.tasks, { ...draggedTask, selected: false, sprintId }] }
            : sprint
        )
      );
      setProductTasks((prev) => prev.filter((task) => task.id !== taskId));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      alert(axiosErr?.response?.data?.message || 'Failed to move task to sprint.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {loading && (
        <div className="flex items-center justify-center h-64 text-gray-500">
          Loading sprint backlog...
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
              onDropTask={moveTaskToSprint}
              onCreateTask={createSprintTask}
              onDeleteTask={(taskId, sprintId) => {
                setSprints((prev) =>
                  prev.map((s) =>
                    s.id === sprintId
                      ? { ...s, tasks: s.tasks.filter((t) => t.id !== taskId) }
                      : s
                  )
                );
              }}
            />
          ))}

          <ProductBacklogSection
            tasks={productTasks}
            projectId={projectId!}
            onToggleTask={toggleTaskSelection}
            onStoryPointsChange={updateTaskStoryPoints}
            onCreateTask={createTask}
            onCreateSprint={createSprint}
            onAssignTask={(taskId, assigneeName) => {
              setProductTasks((prev) =>
                prev.map((t) => t.id === taskId ? { ...t, assigneeName } : t)
              );
            }}
          />
        </>
      )}
    </div>
  );
}

export default function SprintBacklogPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-500">Loading sprint backlog...</div>}>
      <SprintBacklogContent />
    </Suspense>
  );
}