'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { DragEndEvent } from '@dnd-kit/core';
import { useSearchParams } from 'next/navigation';
import DragDropProvider from './components/DragDropProvider';
import KanbanColumn from './components/KanbanColumn';
import DateRangeFilter from './components/DateRangeFilter';
import CreateTaskModal from './components/CreateTaskModal';
import { Task, KanbanColumn as KanbanColumnType, DateFilter, TaskStatus } from './types';
import { fetchTasksByProject, updateTaskStatus, deleteTask, createTask } from './api';
import { AlertCircle, Loader, CheckCircle2 } from 'lucide-react';

const COLUMN_CONFIGS: Array<{
  status: string;
  title: string;
}> = [
  { status: 'TODO', title: 'To Do' },
  { status: 'IN_PROGRESS', title: 'In Progress' },
  { status: 'IN_REVIEW', title: 'In Review' },
  { status: 'DONE', title: 'Done' },
];

export default function KanbanPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    startDate: null,
    endDate: null,
  });
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColumnStatus, setSelectedColumnStatus] = useState<string>('TODO');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [completeSuccess, setCompleteSuccess] = useState(false);

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

  // Filter tasks by date range
  const filteredTasks = useCallback(() => {
    if (!dateFilter.startDate && !dateFilter.endDate) {
      return tasks;
    }

    return tasks.filter((task) => {
      if (!task.dueDate) return true; // Include tasks without due dates if no filter

      const taskDate = new Date(task.dueDate);

      if (dateFilter.startDate && taskDate < dateFilter.startDate) {
        return false;
      }

      if (dateFilter.endDate) {
        const endDateWithTime = new Date(dateFilter.endDate);
        endDateWithTime.setHours(23, 59, 59, 999);
        if (taskDate > endDateWithTime) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, dateFilter]);

  // Group tasks by status column
  const columns: KanbanColumnType[] = COLUMN_CONFIGS.map((config) => ({
    status: config.status,
    title: config.title,
    tasks: filteredTasks().filter((task) => task.status === config.status),
  }));

  // Handle task drag and drop
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const taskId = parseInt(active.id as string);
    const newStatus = over.id as string;
    const task = tasks.find((t) => t.id === taskId);

    if (!task || task.status === newStatus) return;

    // Optimistic update: update UI immediately
    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.id === taskId ? { ...t, status: newStatus } : t
      )
    );

    // Call API to persist change
    setUpdatingTaskId(taskId);
    try {
      await updateTaskStatus(taskId, newStatus);
    } catch (err) {
      // Revert on error
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId ? { ...t, status: task.status } : t
        )
      );
      setError(`Failed to update task status: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Failed to update task status:', err);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Handle task deletion
  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    // Optimistic delete
    const originalTasks = tasks;
    setTasks((prevTasks) => prevTasks.filter((t) => t.id !== taskId));

    try {
      await deleteTask(taskId);
    } catch (err) {
      // Revert on error
      setTasks(originalTasks);
      setError(`Failed to delete task: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Failed to delete task:', err);
    }
  };

  // Handle date filter change
  const handleDateFilterChange = (filter: DateFilter) => {
    setDateFilter(filter);
  };

  // Handle create task button click
  const handleCreateTaskClick = (columnStatus: string) => {
    setSelectedColumnStatus(columnStatus);
    setIsCreateModalOpen(true);
  };

  // Handle create task submission
  const handleCreateTask = async (taskData: Partial<Task>) => {
    if (!projectId) return;

    setIsCreatingTask(true);
    try {
      const newTask = await createTask(taskData);
      setTasks((prevTasks) => [...prevTasks, newTask]);
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error('Failed to create task:', err);
      throw err;
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Handle complete board
  const handleCompleteBoard = async () => {
    if (confirm('Are you sure you want to mark this board as complete? This action cannot be undone.')) {
      setCompleteSuccess(true);
      setTimeout(() => setCompleteSuccess(false), 3000);
    }
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Missing Project ID
          </h1>
          <p className="text-gray-600">
            Please provide a project ID in the URL: <code className="bg-gray-100 px-2 py-1 rounded">/kanban?projectId=1</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Kanban Board</h1>
            <p className="text-sm text-gray-600 mt-1">Organize and track your project tasks</p>
          </div>
          <div className="flex items-center gap-4">
            <DateRangeFilter onFilterChange={handleDateFilterChange} />
            <button
              onClick={handleCompleteBoard}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <CheckCircle2 size={18} />
              Complete Board
            </button>
          </div>
        </div>

        {/* Success Message */}
        {completeSuccess && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 mb-4">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">Board marked as complete!</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Error</p>
              <p className="text-xs">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Loading tasks...</p>
          </div>
        </div>
      ) : (
        /* Kanban Board */
        <DragDropProvider
          tasks={tasks}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 overflow-x-auto pb-6 min-h-96">
            {columns.map((column) => (
              <div
                key={column.status}
                className="flex-shrink-0"
                style={{ width: '350px' }}
              >
                <KanbanColumn
                  column={column}
                  onDeleteTask={handleDeleteTask}
                  onCreateTask={handleCreateTaskClick}
                />
              </div>
            ))}
          </div>

          {/* Update Status Indicator */}
          {updatingTaskId && (
            <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm">Updating task...</span>
            </div>
          )}
        </DragDropProvider>
      )}

      {/* Create Task Modal */}
      {projectId && (
        <CreateTaskModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreateTask={handleCreateTask}
          columnStatus={selectedColumnStatus}
          projectId={parseInt(projectId as string)}
          loading={isCreatingTask}
        />
      )}
    </div>
  );
}
