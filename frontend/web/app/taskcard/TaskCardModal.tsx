'use client';

import React, { useEffect, useRef, useState } from 'react';
import TaskHeader from './TaskHeader';
import TaskMainContent from './TaskMainContent';
import TaskSidebar from './TaskSidebar';
import api from '@/lib/axios';
import { toast } from '@/components/ui';
import { motion } from 'framer-motion';

interface MultiAssignee {
  memberId: number;
  userId: number;
  name: string;
  photoUrl: string | null;
}

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
  dueDate: string | null;
  subtasks: Array<{ id: number; title: string; status: string }>;
  dependencies: Array<{ id: number; title: string; relation: string }>;
  assignees?: MultiAssignee[];
  recurrenceRule?: string | null;
  recurrenceEnd?: string | null;
  reporterId?: number | null;
  sprintId?: number | null;
  startDate?: string | null;
}

interface ProjectMemberOption {
  memberId: number;
  userId: number;
  name: string;
}

interface LabelOption {
  id: number;
  name: string;
}

interface SprintOption {
  id: number;
  name: string;
}

interface TaskCardModalProps {
  taskId: number;
  onClose: (wasModified: boolean) => void;
}

export default function TaskCardModal({ taskId, onClose }: TaskCardModalProps) {
  const [taskData, setTaskData] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberOption[]>([]);
  const [projectLabels, setProjectLabels] = useState<LabelOption[]>([]);
  const [projectSprints, setProjectSprints] = useState<SprintOption[]>([]);
  // useRef instead of useState so wasModified always holds the current value inside
  // the Escape keydown listener without needing it in the dependency array.
  const wasModified = useRef<boolean>(false);

  const fetchTaskData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/tasks/${taskId}`);
      setTaskData(response.data);
      setError(null);
      if (response.data?.projectId) {
        void loadTaskMeta(response.data.projectId);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || 'Failed to fetch task data');
      setTaskData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadTaskMeta = async (projectId: number) => {
    try {
      const [projectRes, currentUserRes, membersRes, labelsRes, sprintsRes] = await Promise.all([
        api.get(`/api/projects/${projectId}`),
        api.get('/api/user/me'),
        api.get(`/api/projects/${projectId}/members`),
        api.get(`/api/labels/project/${projectId}`),
        api.get(`/api/sprints/project/${projectId}`).catch(() => ({ data: [] })),
      ]);
      const teamId = projectRes.data?.teamId as number | undefined;
      const currentUserId = currentUserRes.data?.userId as number | undefined;
      const membersRaw = (membersRes.data || []) as Array<{ id: number; user?: { userId: number; username: string } }>;
      const memberRole = membersRaw.find((member) => member.user?.userId === currentUserId) as { role?: string } | undefined;
      setCanEdit((memberRole?.role || 'MEMBER') !== 'VIEWER');
      setProjectMembers(
        membersRaw
          .filter((member) => member.user?.userId != null)
          .map((member) => ({
            memberId: member.id,
            userId: member.user!.userId,
            name: member.user!.username,
          })),
      );
      const labelsRaw = (labelsRes.data || []) as Array<{ id: number; name: string }>;
      setProjectLabels(labelsRaw.map((label) => ({ id: label.id, name: label.name })));
      const sprintsRaw = (sprintsRes.data || []) as Array<{ id: number; name: string }>;
      setProjectSprints(sprintsRaw.map((sprint) => ({ id: sprint.id, name: sprint.name })));
      if (!teamId) {
        setCanEdit(true);
      }
    } catch {
      setCanEdit(true);
    }
  };

  useEffect(() => {
    // Stale-while-revalidate: populate the modal from cache immediately so it opens without a loading flash
    const cached = localStorage.getItem(`planora:task:${taskId}`);
    if (cached) {
      try {
        setTaskData(JSON.parse(cached) as TaskData);
        setLoading(false);
      } catch { /* ignore */ }
    }
    fetchTaskData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => { wasModified.current = false; }, [taskId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(wasModified.current); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    // Restores the exact overflow value that was set before the modal opened rather than
    // always resetting to '' — in case the caller already had overflow set for another reason.
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  const updateTask = async (updates: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    storyPoint: number;
    dueDate: string | null;
    milestoneId: number | null;
    recurrenceRule: string | null;
    recurrenceEnd: string | null;
    reporterId: number | null;
    sprintId: number | null;
    startDate: string | null;
    labelIds: number[];
  }>) => {
    if (!taskData) return;
    // Optimistic: apply locally before the API call so the UI reflects the change without latency
    setTaskData((prev) => prev ? { ...prev, ...updates } : prev);
    try {
      await api.put(`/api/tasks/${taskId}`, updates);
      wasModified.current = true;
      // Notify sibling components (e.g. sprint board) that this task changed without requiring a full re-fetch
      window.dispatchEvent(new CustomEvent('planora:task-updated', { detail: { taskId } }));
      // Bust the taskcard page cache so standalone page shows fresh data on next visit
      localStorage.removeItem(`planora:task:${taskId}`);
    } catch (err: unknown) {
      // Revert the optimistic update by re-fetching the server's authoritative state
      await fetchTaskData();
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast('Failed to update task: ' + (axiosErr?.response?.data?.message || 'Unknown error'), 'error');
    }
  };

  const handleUpdateLabels = (nextLabelIds: number[]) => {
    const labelIdSet = new Set(nextLabelIds);
    const nextLabels = projectLabels
      .filter((label) => labelIdSet.has(label.id))
      .map((label) => ({ id: label.id, name: label.name }));
    setTaskData((prev) => (prev ? { ...prev, labels: nextLabels } : prev));
    void updateTask({ labelIds: nextLabelIds });
  };

  return (
    <div className="fixed inset-0 z-[9999]" onClick={() => onClose(wasModified.current)}>
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
        className="absolute inset-0 md:inset-y-3 md:left-auto md:right-3 md:w-[980px] md:max-w-[calc(100vw-24px)] max-h-[100dvh] bg-white flex flex-col font-sans overflow-hidden md:shadow-2xl md:rounded-2xl border border-transparent md:border-[#E5E7EB]"
        // stopPropagation prevents clicks inside the panel from bubbling to the backdrop and closing the modal
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

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
                onClick={() => onClose(wasModified.current)}
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
              numericTaskId={taskData.id}
              onClose={() => onClose(wasModified.current)}
            />
            <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
              <div className="flex flex-1 flex-col min-h-0 md:overflow-y-auto">
                <TaskMainContent
                  title={taskData.title}
                  description={taskData.description}
                  subtasks={taskData.subtasks || []}
                  dependencies={taskData.dependencies || []}
                  taskId={taskData.id}
                  projectId={taskData.projectId}
                  onUpdateTitle={(title) => updateTask({ title })}
                  onUpdateDescription={(description) => canEdit && updateTask({ description })}
                  onSubtaskAdded={(newSubtask) => setTaskData(prev => prev ? { ...prev, subtasks: [...prev.subtasks, newSubtask] } : prev)}
                  onDependencyChanged={fetchTaskData}
                  readOnly={!canEdit}
                />
              </div>
              <div className="flex flex-col min-h-0 md:overflow-y-auto flex-shrink-0">
                <TaskSidebar
                  taskId={taskData.id}
                  projectId={taskData.projectId}
                  status={taskData.status}
                  assignee={taskData.assigneeName}
                  reporter={taskData.reporterName}
                  labels={taskData.labels?.map((l) => l.name) || []}
                  labelIds={taskData.labels?.map((l) => l.id) || []}
                  priority={taskData.priority}
                  sprint={taskData.sprintName}
                  sprintId={taskData.sprintId}
                  reporterId={taskData.reporterId}
                  storyPoint={taskData.storyPoint}
                  milestoneId={taskData.milestoneId}
                  milestoneName={taskData.milestoneName}
                  dates={{
                    created: taskData.createdAt,
                    updated: taskData.updatedAt,
                    dueDate: taskData.dueDate,
                    startDate: taskData.startDate ?? null,
                  }}
                  onUpdateStatus={(status) => canEdit && updateTask({ status })}
                  onUpdatePriority={(priority) => canEdit && updateTask({ priority })}
                  onUpdateStoryPoint={(storyPoint) => canEdit && updateTask({ storyPoint })}
                  onUpdateDueDate={(dueDate) => canEdit && updateTask({ dueDate })}
                  onUpdateStartDate={(startDate) => canEdit && updateTask({ startDate })}
                  onUpdateMilestone={(milestoneId) => canEdit && updateTask({ milestoneId })}
                  assignees={taskData.assignees ?? []}
                  onAssigneesChanged={fetchTaskData}
                  recurrenceRule={taskData.recurrenceRule}
                  recurrenceEnd={taskData.recurrenceEnd}
                  onUpdateRecurrence={(rule, end) => canEdit && updateTask({ recurrenceRule: rule, recurrenceEnd: end })}
                  canEdit={canEdit}
                  members={projectMembers}
                  allLabels={projectLabels}
                  sprints={projectSprints}
                  onUpdateReporter={(reporterId) => canEdit && updateTask({ reporterId })}
                  onUpdateSprint={(sprintId) => canEdit && updateTask({ sprintId })}
                  onUpdateLabels={(labelIds) => canEdit && handleUpdateLabels(labelIds)}
                  onUnassign={async () => {
                    if (!canEdit) return;
                    try {
                      await api.delete(`/api/tasks/${taskData.id}/assignee`);
                      await fetchTaskData();
                    } catch {
                      toast('Failed to remove assignee', 'error');
                    }
                  }}
                />
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
