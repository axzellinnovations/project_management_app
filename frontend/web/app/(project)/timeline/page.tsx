'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import TimelineView from '../kanban/components/TimelineView';
import { Task } from '../kanban/types';
import { fetchTasksByProject } from '../kanban/api';
import { AlertCircle } from 'lucide-react';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import { getMilestones } from '@/services/milestone-service';
import type { MilestoneResponse } from '@/types';

export default function TimelinePage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<MilestoneResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  useTaskWebSocket(projectId, (event) => {
    if (event.type === 'TASK_UPDATED' && event.task) {
      setTasks((prev) =>
        prev.map((t) => (t.id === event.task!.id ? { ...t, ...(event.task! as Partial<Task>) } : t))
      );
    } else if (event.type === 'TASK_CREATED' && event.task) {
      setTasks((prev) => [...prev, event.task! as unknown as Task]);
    } else if (event.type === 'TASK_DELETED' && event.taskId != null) {
      setTasks((prev) => prev.filter((t) => t.id !== event.taskId));
    }
  });

  // Fetch tasks from backend
  const loadTasks = useCallback(async () => {
    if (!projectId) {
      setError('No project ID provided. Use ?projectId=<id> in URL.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const projectIdNum = parseInt(projectId as string);
      if (isNaN(projectIdNum)) {
        throw new Error('Invalid project ID');
      }
      const fetchedTasks = await fetchTasksByProject(projectIdNum);
      setTasks(fetchedTasks);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to load tasks';
      setError(errorMsg);
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Load milestones (graceful degradation)
  useEffect(() => {
    if (!projectId) return;
    const pid = parseInt(projectId, 10);
    if (isNaN(pid)) return;
    getMilestones(pid).then(setMilestones).catch(() => {});
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Missing Project ID
          </h1>
          <p className="text-gray-600">
            Please provide a project ID in the URL: <code className="bg-gray-100 px-2 py-1 rounded">/timeline?projectId=1</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-page-padding pb-28 sm:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Timeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gantt view of your project tasks</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 mb-5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Error</p>
            <p className="text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-10 w-full rounded-xl" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-xl w-full" style={{ opacity: 1 - i * 0.12 }} />
          ))}
        </div>
      ) : (
        <TimelineView
          tasks={tasks}
          onOpenTask={setSelectedTaskId}
          onTaskUpdated={(taskId, updates) => {
            setTasks((prev) =>
              prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
            );
          }}
          milestones={milestones.map(ms => ({ id: ms.id, name: ms.name, dueDate: ms.dueDate, status: ms.status }))}
        />
      )}

      {selectedTaskId !== null && (
        <TaskCardModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}