'use client';

import React, { useEffect, useState } from 'react';
import TaskHeader from './TaskHeader';
import TaskMainContent from './TaskMainContent';
import TaskSidebar from './TaskSidebar';
import api from '@/lib/axios';

interface TaskData {
  id: number;
  title: string;
  description: string;
  projectName: string;
  status: string;
  priority: string;
  storyPoint: number;
  reporterName: string;
  assigneeName: string;
  sprintName: string;
  labels: Array<{ id: number; name: string }>;
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  subtasks: Array<{ id: number; title: string; status: string }>;
  dependencies: Array<{ id: number; title: string; relation: string }>;
}

interface TaskCardModalProps {
  taskId: number;
  onClose: () => void;
}

export default function TaskCardModal({ taskId, onClose }: TaskCardModalProps) {
  const [taskData, setTaskData] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTaskData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/tasks/${taskId}`);
      setTaskData(response.data);
      setError(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || 'Failed to fetch task data');
      setTaskData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const updateTask = async (updates: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    storyPoint: number;
    dueDate: string;
  }>) => {
    if (!taskData) return;
    try {
      await api.put(`/api/tasks/${taskId}`, updates);
      await fetchTaskData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      alert('Failed to update task: ' + (axiosErr?.response?.data?.message || 'Unknown error'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl bg-white h-[90vh] shadow-2xl flex flex-col font-sans rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border border-gray-300 border-t-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading task...</p>
            </div>
          </div>
        )}

        {!loading && (error || !taskData) && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-lg max-w-md w-full text-center">
              <h2 className="text-red-600 font-semibold mb-2">Error Loading Task</h2>
              <p className="text-gray-600 mb-4">{error || 'Task not found'}</p>
              <button
                onClick={onClose}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {!loading && taskData && (
          <>
            <TaskHeader
              project={taskData.projectName}
              taskId={`TASK-${taskData.id}`}
              onClose={onClose}
            />
            <div className="flex flex-1 overflow-hidden">
              <TaskMainContent
                title={taskData.title}
                description={taskData.description}
                subtasks={taskData.subtasks || []}
                dependencies={taskData.dependencies || []}
                taskId={taskData.id}
                onUpdateTitle={(title) => updateTask({ title })}
                onUpdateDescription={(description) => updateTask({ description })}
              />
              <TaskSidebar
                status={taskData.status}
                assignee={taskData.assigneeName}
                reporter={taskData.reporterName}
                labels={taskData.labels?.map((l) => l.name) || []}
                priority={taskData.priority}
                sprint={taskData.sprintName}
                storyPoint={taskData.storyPoint}
                dates={{
                  created: taskData.createdAt,
                  updated: taskData.updatedAt,
                  dueDate: taskData.dueDate,
                }}
                onUpdateStatus={(status) => updateTask({ status })}
                onUpdatePriority={(priority) => updateTask({ priority })}
                onUpdateStoryPoint={(storyPoint) => updateTask({ storyPoint })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
