'use client';

import { useEffect, useRef, useState } from 'react';
import TaskHeader from './TaskHeader';
import TaskMainContent from './TaskMainContent';
import TaskSidebar from './TaskSidebar';
import { toast } from '@/components/ui';
import OverlayPortal from '@/components/ui/OverlayPortal';
import { motion } from 'framer-motion';
import { useStomp } from '@/ws/stomp-provider';
import { getProjectGitHubRepo } from '@/services/github-service';
import CreateIssueFromTaskModal from '@/components/github/CreateIssueFromTaskModal';
import { authApi } from '@/services/auth-contract';
import api from '@/lib/axios';
import { getApiErrorStatus, normalizeApiError } from '@/lib/api-error';
import { labelsApi, projectsApi, sprintsApi, tasksApi } from '@/services/api-contract';
import type { Task } from '@/types';
import { resolveProfilePhotoUrl } from '@/lib/profile-photo';
import { applyTaskMutation, createMutationId, publishTaskMutation } from '@/lib/task-cache';

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
  assigneePhotoUrl: string | null;
  sprintName: string;
  milestoneId?: number | null;
  milestoneName?: string | null;
  labels: Array<{ id: number; name: string; color?: string | null }>;
  createdAt: string;
  updatedAt: string;
  dueDate: string | null;
  subtasks: Array<{ id: number; title: string; status: string; priority?: string; dueDate?: string | null }>;
  dependencies: Array<{ id: number; title: string; relation: string }>;
  assignees?: MultiAssignee[];
  recurrenceRule?: string | null;
  recurrenceEnd?: string | null;
  customInterval?: number | null;
  recurrenceLimit?: number | null;
  reporterId?: number | null;
  sprintId?: number | null;
  startDate?: string | null;
  completedAt?: string | null;
  githubIssueNumber?: number | null;
  githubRepoFullName?: string | null;
  archived?: boolean;
}

interface ProjectMemberOption {
  memberId: number;
  userId: number;
  name: string;
  photoUrl?: string | null;
}

interface LabelOption {
  id: number;
  name: string;
  color?: string | null;
}

interface SprintOption {
  id: number;
  name: string;
}

interface TaskCardModalProps {
  taskId: number;
  onClose: (wasModified: boolean) => void;
}

const toTaskData = (task: Task & {
  projectName?: string;
  reporterName?: string;
  assigneeName?: string;
  sprintName?: string;
  githubIssueNumber?: number | null;
  githubRepoFullName?: string | null;
}): TaskData => ({
  id: task.id,
  title: task.title,
  description: task.description ?? '',
  projectId: task.projectId ?? 0,
  projectName: task.projectName ?? '',
  status: task.status ?? 'TODO',
  priority: task.priority ?? 'MEDIUM',
  storyPoint: task.storyPoint ?? 0,
  reporterName: task.reporterName ?? '',
  assigneeName: task.assigneeName ?? '',
  assigneePhotoUrl: resolveProfilePhotoUrl(task.assigneePhotoUrl, task.assigneeId),
  sprintName: task.sprintName ?? '',
  milestoneId: task.milestoneId ?? null,
  milestoneName: task.milestoneName ?? null,
  labels: task.labels ?? [],
  createdAt: task.createdAt ?? '',
  updatedAt: task.updatedAt ?? '',
  dueDate: task.dueDate ?? null,
  subtasks: task.subtasks ?? [],
  dependencies: task.dependencies ?? [],
  assignees: task.assignees?.map((assignee) => {
    const raw = assignee as MultiAssignee & { id?: number; memberId?: number; userId?: number; avatar?: string; profilePicUrl?: string };
    const memberId = raw.memberId ?? raw.id;
    const userId = raw.userId ?? raw.id;
    const photoUrl = raw.photoUrl ?? resolveProfilePhotoUrl(raw.avatar ?? raw.profilePicUrl, userId);
    return {
      memberId,
      userId,
      name: assignee.name,
      photoUrl,
    };
  }),
  recurrenceRule: task.recurrenceRule ?? null,
  recurrenceEnd: task.recurrenceEnd ?? null,
  customInterval: task.customInterval ?? null,
  recurrenceLimit: task.recurrenceLimit ?? null,
  reporterId: task.reporterId ?? null,
  sprintId: task.sprintId ?? null,
  startDate: task.startDate ?? null,
  completedAt: task.completedAt ?? null,
  githubIssueNumber: task.githubIssueNumber ?? null,
  githubRepoFullName: task.githubRepoFullName ?? null,
  archived: task.archived ?? false,
});

function serializeTaskCacheEntry(response: object): string {
  return JSON.stringify({ ...response, timestamp: Date.now() });
}

export default function TaskCardModal({ taskId, onClose }: TaskCardModalProps) {
  const [taskData, setTaskData] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [canChangeReporter, setCanChangeReporter] = useState(false);
  const [, setIsSyncing] = useState(false);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberOption[]>([]);
  const [projectLabels, setProjectLabels] = useState<LabelOption[]>([]);
  const [projectSprints, setProjectSprints] = useState<SprintOption[]>([]);
  const [showGitHubIssueModal, setShowGitHubIssueModal] = useState(false);
  // useRef instead of useState so wasModified always holds the current value inside
  // the Escape keydown listener without needing it in the dependency array.
  const wasModified = useRef<boolean>(false);
  const { subscribe } = useStomp();
  const commentRefetchRef = useRef<(() => void) | null>(null);

  const fetchTaskData = async () => {
    try {
      setLoading(true);
      const response = await tasksApi.get(taskId);
      setTaskData(toTaskData(response as Task & {
        projectName?: string;
        reporterName?: string;
        assigneeName?: string;
        sprintName?: string;
        githubIssueNumber?: number | null;
        githubRepoFullName?: string | null;
      }));
      localStorage.setItem(`planora:task:${taskId}`, serializeTaskCacheEntry(response));
      setError(null);
      if (response?.projectId) {
        void loadTaskMeta(response.projectId);
      }
    } catch (err: unknown) {
      if (getApiErrorStatus(err) === 404) {
        localStorage.removeItem(`planora:task:${taskId}`);
        toast('This task no longer exists.', 'error');
        onClose(false);
      } else {
        setError(normalizeApiError(err, 'Failed to fetch task data'));
        setTaskData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadTaskMeta = async (projectId: number) => {
    try {
      const [projectRes, currentUserRes, membersRes, labelsRes, sprintsRes] = await Promise.all([
        projectsApi.get(projectId),
        authApi.getCurrentUser(),
        projectsApi.getMembers(projectId),
        labelsApi.listByProject(projectId),
        sprintsApi.listByProject(projectId).catch(() => []),
      ]);
      const teamId = projectRes?.teamId as number | undefined;
      const currentUserId = currentUserRes?.userId as number | undefined;
      const membersRaw = (membersRes || []) as Array<{ id: number; role?: string; user?: { userId: number; username: string; profilePicUrl?: string | null } }>;
      const currentMember = membersRaw.find((member) => member.user?.userId === currentUserId);
      const role = currentMember?.role || 'MEMBER';
      setCanEdit(role !== 'VIEWER');
      setCanChangeReporter(role === 'ADMIN' || role === 'OWNER');
      setProjectMembers(
        membersRaw
          .filter((member) => member.user?.userId != null)
          .map((member) => ({
            memberId: member.id,
            userId: member.user!.userId,
            name: member.user!.username,
            photoUrl: resolveProfilePhotoUrl(member.user!.profilePicUrl, member.user!.userId),
          })),
      );
      const labelsRaw = (labelsRes || []) as Array<{ id: number; name: string; color?: string | null }>;
      setProjectLabels(labelsRaw.map((label) => ({ id: label.id, name: label.name, color: label.color })));
      const sprintsRaw = (sprintsRes || []) as Array<{ id: number; name: string; status?: string }>;
      setProjectSprints(
        sprintsRaw
          .filter((sprint) => sprint.status !== 'COMPLETED')
          .map((sprint) => ({ id: sprint.id, name: sprint.name })),
      );
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
        const cachedTask = toTaskData(JSON.parse(cached));
        queueMicrotask(() => {
          setTaskData(cachedTask);
          setLoading(false);
        });
      } catch { /* ignore */ }
    }
    queueMicrotask(() => void fetchTaskData());
    return () => {
      const cached = localStorage.getItem(`planora:task:${taskId}`);
      if (cached) {
        try {
          const { timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp > 5 * 60_000) {
            localStorage.removeItem(`planora:task:${taskId}`);
          }
        } catch { /* ignore */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => { wasModified.current = false; }, [taskId]);

  useEffect(() => {
    if (!taskData?.projectId) return;
    const sub = subscribe(
      `/topic/project/${taskData.projectId}/tasks`,
      (msg: { body: string }) => {
        try {
          const event = JSON.parse(msg.body) as { type: string; taskId?: number };
          if (event.type === 'TASK_COMMENT_ADDED' && event.taskId === taskId) {
            commentRefetchRef.current?.();
          } else if (event.type === 'TASK_DELETED' && event.taskId === taskId) {
            localStorage.removeItem(`planora:task:${taskId}`);
            toast.info("This task was deleted by another team member.");
            onClose(false);
          }
        } catch { /* ignore malformed messages */ }
      },
    );
    return () => { sub?.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskData?.projectId, taskId]);

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
    customInterval: number | null;
    recurrenceLimit: number | null;
    reporterId: number | null;
    sprintId: number | null;
    startDate: string | null;
    labelIds: number[];
  }>) => {
    if (!taskData) return;
    const mutationId = createMutationId();
    const previousTask = { ...taskData };
    // Optimistic: apply locally before the API call so the UI reflects the change without latency
    setTaskData((prev) => prev ? { ...prev, ...updates } : prev);
    applyTaskMutation({
      operation: 'updated', projectId: taskData.projectId, taskId, mutationId,
      source: 'optimistic', patch: updates as Partial<Task>, occurredAt: new Date().toISOString(),
    });
    setIsSyncing(true);
    try {
      const updatedTask = await tasksApi.update(taskId, updates);
      const nextTaskData = toTaskData(updatedTask as Task & {
        projectName?: string;
        reporterName?: string;
        assigneeName?: string;
        sprintName?: string;
        githubIssueNumber?: number | null;
        githubRepoFullName?: string | null;
      });
      setTaskData(nextTaskData);
      wasModified.current = true;
      const committed = {
        operation: 'updated' as const, projectId: taskData.projectId, taskId, mutationId,
        source: 'http' as const, task: updatedTask, occurredAt: new Date().toISOString(),
      };
      applyTaskMutation(committed);
      publishTaskMutation(committed);
      localStorage.setItem(`planora:task:${taskId}`, JSON.stringify({ ...updatedTask, timestamp: Date.now() }));
    } catch (err: unknown) {
      applyTaskMutation({
        operation: 'updated', projectId: taskData.projectId, taskId, mutationId,
        source: 'rollback', task: previousTask as unknown as Task, occurredAt: new Date().toISOString(),
      });
      // Revert the optimistic update by re-fetching the server's authoritative state
      await fetchTaskData();
      toast(`Failed to update task: ${normalizeApiError(err, 'Unknown error')}`, 'error');
    } finally {
      setIsSyncing(false);
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

  const handleCreateLabel = async (name: string, color: string) => {
    if (!taskData?.projectId || !name.trim()) return null;
    try {
      const created = await labelsApi.create({
        projectId: taskData.projectId,
        name: name.trim(),
        color,
      });
      setProjectLabels((prev) => [...prev, created]);
      return created;
    } catch (err) {
      toast(`Failed to create label: ${normalizeApiError(err, 'Unknown error')}`, 'error');
      return null;
    }
  };

  const handleUpdateLabel = async (id: number, name: string, color: string) => {
    if (!name.trim()) return null;
    try {
      const updated = await labelsApi.update(id, { name: name.trim(), color });
      setProjectLabels((prev) => prev.map((l) => (l.id === id ? updated : l)));
      setTaskData((prev) => {
        if (!prev) return prev;
        const hasLabel = prev.labels?.some((l) => l.id === id);
        if (!hasLabel) return prev;
        return {
          ...prev,
          labels: prev.labels.map((l) => (l.id === id ? { id: updated.id, name: updated.name } : l)),
        };
      });
      return updated;
    } catch (err) {
      toast(`Failed to update label: ${normalizeApiError(err, 'Unknown error')}`, 'error');
      return null;
    }
  };

  const handleDeleteLabel = async (id: number) => {
    try {
      await labelsApi.delete(id);
      setProjectLabels((prev) => prev.filter((l) => l.id !== id));
      setTaskData((prev) => {
        if (!prev) return prev;
        const hasLabel = prev.labels?.some((l) => l.id === id);
        if (!hasLabel) return prev;
        return {
          ...prev,
          labels: prev.labels.filter((l) => l.id !== id),
        };
      });
      if (taskData?.labels?.some((l) => l.id === id)) {
        const remainingIds = taskData.labels.filter((l) => l.id !== id).map((l) => l.id);
        void updateTask({ labelIds: remainingIds });
      }
      return true;
    } catch (err) {
      toast(`Failed to delete label: ${normalizeApiError(err, 'Unknown error')}`, 'error');
      return false;
    }
  };

  const projectGitHubRepo = taskData?.projectId ? getProjectGitHubRepo(taskData.projectId) : null;

  const handleGitHubIssueCreated = (issue: { number: number }) => {
    if (!taskData) return;
    const nextTaskData = {
      ...taskData,
      githubIssueNumber: issue.number,
      githubRepoFullName: taskData.githubRepoFullName ?? projectGitHubRepo?.repoFullName ?? null,
    };
    setTaskData(nextTaskData);
    localStorage.setItem(`planora:task:${taskId}`, JSON.stringify({ ...nextTaskData, timestamp: Date.now() }));
    wasModified.current = true;
  };

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[var(--cu-z-modal)]" onClick={() => onClose(wasModified.current)}>
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
        className="absolute inset-0 md:inset-y-3 md:left-auto md:right-3 md:w-[980px] md:max-w-[calc(100vw-24px)] max-h-[100dvh] bg-cu-bg flex flex-col font-sans overflow-hidden md:shadow-2xl md:rounded-2xl border border-transparent md:border-cu-border"
        // stopPropagation prevents clicks inside the panel from bubbling to the backdrop and closing the modal
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-cu-bg-tertiary rounded-full" />
        </div>

        {loading && !taskData && (
          <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden animate-pulse">
            <div className="flex-1 p-6 border-r border-cu-border space-y-6">
              <div className="h-8 w-3/4 rounded-lg bg-cu-bg-secondary" />
              <div className="flex gap-2">
                <div className="h-9 w-20 rounded-xl bg-cu-bg-secondary" />
                <div className="h-9 w-28 rounded-xl bg-cu-bg-secondary" />
                <div className="h-9 w-24 rounded-xl bg-cu-bg-secondary" />
              </div>
              <div>
                <div className="h-3 w-24 rounded bg-cu-bg-tertiary mb-3" />
                <div className="h-28 rounded-xl bg-cu-bg-secondary" />
              </div>
              <div>
                <div className="h-3 w-20 rounded bg-cu-bg-tertiary mb-3" />
                <div className="space-y-2">
                  <div className="h-10 rounded-xl bg-cu-bg-secondary" />
                  <div className="h-10 rounded-xl bg-cu-bg-secondary" />
                </div>
              </div>
            </div>
            <div className="w-full md:w-80 p-4 bg-cu-bg-secondary space-y-4 flex-shrink-0">
              <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                <div className="h-10 rounded-xl bg-cu-bg-tertiary" />
                <div className="h-10 rounded-xl bg-cu-bg-tertiary" />
              </div>
              <div className="h-52 rounded-xl bg-cu-bg border border-cu-border" />
              <div className="h-32 rounded-xl bg-cu-bg border border-cu-border" />
            </div>
          </div>
        )}

        {!loading && (error || !taskData) && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="bg-cu-bg p-8 rounded-lg max-w-md w-full text-center border border-cu-border">
              <h2 className="text-cu-danger font-semibold mb-2">Error Loading Task</h2>
              <p className="text-cu-text-secondary mb-4">{error || 'Task not found'}</p>
              <button
                onClick={() => onClose(wasModified.current)}
                className="bg-cu-primary text-white px-4 py-2 rounded hover:bg-cu-primary-hover transition-colors"
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
              status={taskData.status}
              priority={taskData.priority}
              dueDate={taskData.dueDate}
              onClose={(wasModifiedFlag) => onClose(wasModifiedFlag || wasModified.current)}
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
                  overview={{
                    status: taskData.status,
                    priority: taskData.priority,
                    dueDate: taskData.dueDate,
                    storyPoint: taskData.storyPoint,
                    labels: taskData.labels ?? [],
                    assignees: taskData.assignees?.length
                      ? taskData.assignees.map((assignee) => ({ name: assignee.name, photoUrl: assignee.photoUrl }))
                      : taskData.assigneeName
                        ? [{ name: taskData.assigneeName, photoUrl: taskData.assigneePhotoUrl }]
                        : [],
                    githubIssueNumber: taskData.githubIssueNumber,
                    githubRepoFullName: taskData.githubRepoFullName,
                    archived: taskData.archived,
                  }}
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
                  taskTitle={taskData.title}
                  taskDescription={taskData.description}
                  status={taskData.status}
                  assignee={taskData.assigneeName}
                  assigneePhotoUrl={taskData.assigneePhotoUrl}
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
                  githubIssueNumber={taskData.githubIssueNumber ?? null}
                  githubRepoFullName={taskData.githubRepoFullName ?? null}
                  projectGitHubRepo={projectGitHubRepo}
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
                  customInterval={taskData.customInterval}
                  recurrenceLimit={taskData.recurrenceLimit}
                  onUpdateRecurrence={(rule, end, customInterval, recurrenceLimit) => canEdit && updateTask({ recurrenceRule: rule, recurrenceEnd: end, customInterval, recurrenceLimit })}
                  canEdit={canEdit}
                  members={projectMembers}
                  allLabels={projectLabels}
                  sprints={projectSprints}
                  canChangeReporter={canChangeReporter}
                  onUpdateReporter={(reporterId) => canChangeReporter && updateTask({ reporterId })}
                  onUpdateSprint={(sprintId) => canEdit && updateTask({ sprintId })}
                  onUpdateLabels={(labelIds) => canEdit && handleUpdateLabels(labelIds)}
                  onCreateLabel={canEdit ? handleCreateLabel : undefined}
                  onUpdateLabel={canEdit ? handleUpdateLabel : undefined}
                  onDeleteLabel={canEdit ? handleDeleteLabel : undefined}
                  onCreateGitHubIssue={() => setShowGitHubIssueModal(true)}
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
            {showGitHubIssueModal && projectGitHubRepo && (
              <CreateIssueFromTaskModal
                open={showGitHubIssueModal}
                taskId={taskData.id}
                taskTitle={taskData.title}
                taskDescription={taskData.description}
                taskLabels={taskData.labels?.map((label) => label.name) || []}
                repoFullName={projectGitHubRepo.repoFullName}
                onClose={() => setShowGitHubIssueModal(false)}
                onCreated={handleGitHubIssueCreated}
              />
            )}
          </>
        )}
      </motion.div>
      </div>
    </OverlayPortal>
  );
}
