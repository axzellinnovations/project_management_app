"use client";
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TaskHeader from './TaskHeader';
import TaskMainContent from './TaskMainContent';
import TaskSidebar from './TaskSidebar';
import api from '@/lib/axios';
import { toast } from '@/components/ui';

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
    const cacheKey = `planora:task:${taskId}`;
    // Stale-while-revalidate: show cached data instantly so the modal feels responsive,
    // then overwrite with fresh data once the API responds.
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setTaskData(JSON.parse(cached) as TaskData);
        setLoading(false);
      } catch { /* ignore corrupt cache */ }
    }
    try {
      const response = await api.get(`/api/tasks/${taskId}`);
      setTaskData(response.data);
      localStorage.setItem(cacheKey, JSON.stringify(response.data));
      setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (!cached) {
        setError(err.response?.data?.message || 'Failed to fetch task data');
        setTaskData(null);
      }
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
      // Invalidate after update so the next page visit fetches fresh data instead of the old snapshot
      localStorage.removeItem(`planora:task:${taskId}`);
      await fetchTaskData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Failed to update task:', err);
      toast('Failed to update task: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  const handleClose = () => {
    window.history.back();
  };

  // Defer render until after mount so useSearchParams (which is client-only) has resolved
  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-4">
        <div className="w-full max-w-[1200px] bg-white rounded-2xl border border-[#E5E7EB] p-6 space-y-4 shadow-sm">
          <div className="skeleton h-8 w-48 rounded-lg" />
          <div className="skeleton h-5 w-full rounded-lg" />
          <div className="skeleton h-5 w-3/4 rounded-lg" />
          <div className="skeleton h-40 w-full rounded-xl mt-4" />
        </div>
      </div>
    );
  }

  if (error || !taskData) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-[#E5E7EB] shadow-sm max-w-md w-full">
          <h2 className="text-red-600 font-semibold mb-2">Error Loading Task</h2>
          <p className="text-gray-600 mb-4">{error || 'Task not found'}</p>
          <button
            onClick={handleClose}
            className="w-full bg-[#155DFC] text-white py-2 rounded-xl hover:bg-[#0042A8] transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-[1200px] bg-white border border-[#E5E7EB] shadow-2xl flex flex-col font-sans rounded-2xl overflow-hidden" style={{ maxHeight: '94dvh' }}>
        
        {/* 1. Header Component */}
        <TaskHeader 
          project={taskData.projectName} 
          taskId={`TASK-${taskData.id}`} 
          onClose={handleClose} 
        />

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
          
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

          {/* 3. Sidebar Component (Right Side) — full width on mobile, fixed on lg+ */}
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