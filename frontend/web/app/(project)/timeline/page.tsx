'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import TimelineView from '../kanban/components/TimelineView';
import { Task } from '../kanban/types';
import { fetchTasksByProject } from '../kanban/api';
import { AlertCircle, CalendarRange, Diamond, ListChecks } from 'lucide-react';
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

  const timelineStats = useMemo(() => {
    const dated = tasks.filter((task) => task.startDate || task.dueDate).length;
    const overdue = tasks.filter((task) => {
      if (!task.dueDate || (task.status ?? '').toUpperCase() === 'DONE') return false;
      const due = new Date((task.dueDate.length === 10 ? task.dueDate + 'T00:00:00' : task.dueDate));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);
      return due < today;
    }).length;
    return {
      total: tasks.length,
      dated,
      overdue,
      milestones: milestones.length,
    };
  }, [tasks, milestones]);

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

  useEffect(() => {
    const onTaskUpdated = () => { void loadTasks(); };
    window.addEventListener('planora:task-updated', onTaskUpdated);
    return () => window.removeEventListener('planora:task-updated', onTaskUpdated);
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
    <div className="flex-1 flex flex-col min-w-0 h-full bg-gray-50 overflow-y-auto">
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="sticky-section-header glass-panel border border-[#E4E7EC] rounded-2xl px-4 sm:px-6 py-4 mb-4 flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-[20px] sm:text-2xl font-bold text-[#101828]">Timeline</h1>
          <p className="text-[12px] sm:text-[13px] text-[#6A7282] mt-0.5">Modern gantt planning view with drag/resize scheduling.</p>
        </div>
        <div className="ml-auto grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto">
          <div className="rounded-xl border border-[#EAECF0] bg-white px-3 py-2 min-w-[120px]">
            <p className="text-[10px] font-semibold text-[#667085] uppercase">Tasks</p>
            <p className="text-[16px] font-bold text-[#101828]">{timelineStats.total}</p>
          </div>
          <div className="rounded-xl border border-[#EAECF0] bg-white px-3 py-2 min-w-[120px]">
            <p className="text-[10px] font-semibold text-[#667085] uppercase inline-flex items-center gap-1"><CalendarRange size={11} />Scheduled</p>
            <p className="text-[16px] font-bold text-[#175CD3]">{timelineStats.dated}</p>
          </div>
          <div className="rounded-xl border border-[#EAECF0] bg-white px-3 py-2 min-w-[120px]">
            <p className="text-[10px] font-semibold text-[#667085] uppercase inline-flex items-center gap-1"><ListChecks size={11} />Overdue</p>
            <p className="text-[16px] font-bold text-[#B42318]">{timelineStats.overdue}</p>
          </div>
          <div className="rounded-xl border border-[#EAECF0] bg-white px-3 py-2 min-w-[120px]">
            <p className="text-[10px] font-semibold text-[#667085] uppercase inline-flex items-center gap-1"><Diamond size={11} />Milestones</p>
            <p className="text-[16px] font-bold text-[#6941C6]">{timelineStats.milestones}</p>
          </div>
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
          onClose={(wasModified) => {
            setSelectedTaskId(null);
            if (wasModified) {
              void loadTasks();
            }
          }}
        />
      )}
      </div>
    </div>
  );
}