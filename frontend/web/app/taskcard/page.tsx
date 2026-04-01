"use client";
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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

// Wrapper component that uses searchParams
function TaskPageContent() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get('taskId');
  
  const [taskData, setTaskData] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchTaskData = async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      const response = await api.get(`/api/tasks/${taskId}`);
      setTaskData(response.data);
      setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch task data');
      setTaskData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    
    if (!taskId) {
      setError('Task ID is required');
      setLoading(false);
      return;
    }

    fetchTaskData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, mounted]);

  const updateTask = async (updates: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    storyPoint: number;
    dueDate: string;
  }>) => {
    if (!taskId || !taskData) return;
    
    try {
      await api.put(`/api/tasks/${taskId}`, updates);
      // Refresh task data after update
      await fetchTaskData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Failed to update task:', err);
      alert('Failed to update task: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleClose = () => {
    window.history.back();
  };

  // Only render after mounting to avoid hydration issues
  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border border-gray-300 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading task...</p>
        </div>
      </div>
    );
  }

  if (error || !taskData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h2 className="text-red-600 font-semibold mb-2">Error Loading Task</h2>
          <p className="text-gray-600 mb-4">{error || 'Task not found'}</p>
          <button
            onClick={handleClose}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl bg-white border border-gray-200 h-[90vh] shadow-2xl flex flex-col font-sans rounded-lg overflow-hidden">
        
        {/* 1. Header Component */}
        <TaskHeader 
          project={taskData.projectName} 
          taskId={`TASK-${taskData.id}`} 
          onClose={handleClose} 
        />

        <div className="flex flex-1 overflow-hidden">
          
          {/* 2. Main Content Component (Left Side) */}
          <TaskMainContent 
              title={taskData.title}
              description={taskData.description}
              subtasks={taskData.subtasks || []}
              dependencies={taskData.dependencies || []}
              taskId={taskData.id}
              onUpdateTitle={(title) => updateTask({ title })}
              onUpdateDescription={(description) => updateTask({ description })}
          />

          {/* 3. Sidebar Component (Right Side) */}
          <TaskSidebar 
              status={taskData.status}
              assignee={taskData.assigneeName}
              reporter={taskData.reporterName}
              labels={taskData.labels?.map(l => l.name) || []}
              priority={taskData.priority}
              sprint={taskData.sprintName}
              storyPoint={taskData.storyPoint}
              dates={{
                  created: taskData.createdAt,
                  updated: taskData.updatedAt,
                  dueDate: taskData.dueDate
              }}
              onUpdateStatus={(status) => updateTask({ status })}
              onUpdatePriority={(priority) => updateTask({ priority })}
              onUpdateStoryPoint={(storyPoint) => updateTask({ storyPoint })}
          />

        </div>
      </div>
    </div>
  );
}

// Server component that renders the wrapper
export default function TaskPage() {
  return <TaskPageContent />;
}