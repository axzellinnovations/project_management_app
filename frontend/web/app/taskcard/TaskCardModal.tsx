'use client';

import React, { useEffect, useState } from 'react';
import TaskHeader from './TaskHeader';
import TaskMainContent from './TaskMainContent';
import TaskSidebar from './TaskSidebar';
import api from '@/lib/axios';
import { toast } from '@/components/ui';
import { motion, AnimatePresence } from 'framer-motion';

interface TaskData {
  id: number;
  title: string;
  description: string;
  projectId: number;
  projectName: string;
  status: string;
  priority: string;
  storyPoint: number;
  reporterName: string;
  assigneeName: string;
  sprintName: string;
  milestoneId?: number | null;
  milestoneName?: string | null;
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const updateTask = async (updates: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    storyPoint: number;
    dueDate: string;
    milestoneId: number | null;
  }>) => {
    if (!taskData) return;
    try {
      await api.put(`/api/tasks/${taskId}`, updates);
      await fetchTaskData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast('Failed to update task: ' + (axiosErr?.response?.data?.message || 'Unknown error'), 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999]" onClick={onClose}>
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm" 
      />
      {/* Slide-over panel */}
      <motion.div
        initial={{ x: '100%', boxShadow: '-10px 0 30px rgba(0,0,0,0)' }}
        animate={{ x: 0, boxShadow: '-10px 0 30px rgba(0,0,0,0.1)' }}
        exit={{ x: '100%', boxShadow: '-10px 0 30px rgba(0,0,0,0)' }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        className="absolute inset-y-0 right-0 w-full md:w-[900px] bg-white flex flex-col font-sans overflow-hidden"
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
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              <TaskMainContent
                title={taskData.title}
                description={taskData.description}
                subtasks={taskData.subtasks || []}
                dependencies={taskData.dependencies || []}
                taskId={taskData.id}
                projectId={taskData.projectId}
                onUpdateTitle={(title) => updateTask({ title })}
                onUpdateDescription={(description) => updateTask({ description })}
                onSubtaskAdded={fetchTaskData}
                onDependencyChanged={fetchTaskData}
              />
              <TaskSidebar
                taskId={taskData.id}
                projectId={taskData.projectId}
                status={taskData.status}
                assignee={taskData.assigneeName}
                reporter={taskData.reporterName}
                labels={taskData.labels?.map((l) => l.name) || []}
                priority={taskData.priority}
                sprint={taskData.sprintName}
                storyPoint={taskData.storyPoint}
                milestoneId={taskData.milestoneId}
                milestoneName={taskData.milestoneName}
                dates={{
                  created: taskData.createdAt,
                  updated: taskData.updatedAt,
                  dueDate: taskData.dueDate,
                }}
                onUpdateStatus={(status) => updateTask({ status })}
                onUpdatePriority={(priority) => updateTask({ priority })}
                onUpdateStoryPoint={(storyPoint) => updateTask({ storyPoint })}
                onUpdateDueDate={(dueDate) => updateTask({ dueDate })}
                onUpdateMilestone={(milestoneId) => updateTask({ milestoneId })}
                onUnassign={async () => {
                  try {
                    await api.delete(`/api/tasks/${taskData.id}/assignee`);
                    await fetchTaskData();
                  } catch {
                    toast('Failed to remove assignee', 'error');
                  }
                }}
              />
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
