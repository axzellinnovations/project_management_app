'use client';
export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import TimelineView from '../kanban/components/TimelineView';
import Sidebar from '../nav/Sidebar';
import TopBar from '../nav/TopBar';
import { Task } from '../kanban/types';
import { fetchTasksByProject, updateTask } from '../kanban/api';
import { AlertCircle, Loader } from 'lucide-react';

export default function TimelinePage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Handle task update
  const handleTaskUpdate = async (taskId: number, updates: Partial<Task>) => {
    try {
      await updateTask(taskId, updates);
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId ? { ...t, ...updates } : t
        )
      );
    } catch (err) {
      setError(`Failed to update task: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Failed to update task:', err);
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
            Please provide a project ID in the URL: <code className="bg-gray-100 px-2 py-1 rounded">/timeline?projectId=1</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TopBar */}
        <TopBar />
        
        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Timeline View</h1>
                <p className="text-sm text-gray-600 mt-1">Visualize your project timeline with Gantt chart</p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4">
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
            /* Timeline View */
            <TimelineView
              tasks={tasks}
              onTaskUpdate={handleTaskUpdate}
              projectId={parseInt(projectId as string)}
            />
          )}
        </div>
      </div>
    </div>
  );
}