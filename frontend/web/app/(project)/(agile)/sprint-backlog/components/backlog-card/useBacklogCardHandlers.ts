import { useState, useEffect, useCallback } from 'react';
import { tasksApi, sprintsApi, projectsApi } from '@/services/api-contract';
import { toast } from '@/components/ui';
import type { SprintItem, TaskItem } from '@/types';
import { formatLocalDate } from '@/lib/date-format';
import { buildSessionCacheKey, removeSessionCache } from '@/lib/session-cache';

// ── Types ────────────────────────────────────────────────────────────────────

interface TeamMemberInfo {
  id: number;
  user: { userId: number; fullName: string; username: string; profilePicUrl?: string | null };
}

type SprintStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

export interface LocalSprintTask {
  id: number;
  taskNo: number;
  title: string;
  storyPoints: number;
  selected: boolean;
  assigneeName?: string;
  assigneePhotoUrl?: string | null;
  assignees?: Array<{
    id?: number;
    userId?: number;
    memberId?: number;
    name: string;
    avatar?: string | null;
    photoUrl?: string | null;
    profilePicUrl?: string | null;
  }>;
  status: SprintStatus;
  startDate: string;
  dueDate: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  subtasks: string;
  labels?: Array<{ id: number; name: string; color?: string }>;
}

export interface AvailableDestSprint {
  id: number;
  name: string;
}

interface UseBacklogCardHandlersArgs {
  sprint: SprintItem;
  projectId: string;
  availableSprintsForMove?: AvailableDestSprint[];
  onSprintDeleted: (sprintId: number, tasks: TaskItem[]) => void;
  onSprintUpdated: (sprintId: number, updates: Partial<SprintItem>) => void;
  onStatusChange?: (taskId: number, status: string) => void;
  onStoryPointsChange?: (taskId: number, points: number) => void;
  onAssignTask?: (taskId: number, name: string, photo: string | null, assignees?: TaskItem['assignees']) => void;
  onAssignMultiple?: (taskId: number, userIds: number[], assignees?: TaskItem['assignees']) => Promise<void> | void;
  onRenameTask?: (taskId: number, title: string) => void;
  onDueDateChange?: (taskId: number, dueDate: string) => Promise<void>;
  projectLabels: Array<{ id: number; name: string; color?: string }>;
  existingSprintNames?: string[];
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useBacklogCardHandlers({
  sprint,
  projectId,
  availableSprintsForMove = [],
  onSprintDeleted,
  onSprintUpdated,
  onStatusChange,
  onStoryPointsChange,
  onAssignTask,
  onAssignMultiple,
  onRenameTask,
  onDueDateChange,
  projectLabels,
  existingSprintNames = [],
}: UseBacklogCardHandlersArgs) {
  const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Local task state
  const [localTasks, setLocalTasks] = useState<LocalSprintTask[]>([]);

  // Modal states
  const [showStartSprintModal, setShowStartSprintModal] = useState(false);
  const [startingSprintLoading, setStartingSprintLoading] = useState(false);
  const [startSprintError, setStartSprintError] = useState('');

  const [confirmDeleteSprint, setConfirmDeleteSprint] = useState(false);
  const [confirmCompleteSprint, setConfirmCompleteSprint] = useState(false);
  const [completeDestination, setCompleteDestination] = useState<number | null>(null);
  const [taskToDeleteId, setTaskToDeleteId] = useState<number | null>(null);
  const [deletingSprintLoading, setDeletingSprintLoading] = useState(false);
  const [completingSprintLoading, setCompletingSprintLoading] = useState(false);

  const [showEditSprintModal, setShowEditSprintModal] = useState(false);
  const [editingSprintLoading, setEditingSprintLoading] = useState(false);
  const [editSprintError, setEditSprintError] = useState('');

  const [goalText, setGoalText] = useState(sprint.goal ?? '');
  const [editingGoal, setEditingGoal] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const getMemberDisplayName = (member: TeamMemberInfo) => member.user.fullName || member.user.username;

  // ── Sync local tasks from props ────────────────────────────────────────────

  useEffect(() => {
    queueMicrotask(() => setLocalTasks((prev) => {
      const prevMap = new Map(prev.map((task) => [task.id, task]));
      const uniqueTasks = Array.from(new Map(sprint.tasks.map(t => [t.id, t])).values());
      return uniqueTasks.map((task) => {
        const existing = prevMap.get(task.id);
        return {
          id: task.id,
          taskNo: task.taskNo,
          title: task.title,
          storyPoints: existing?.storyPoints ?? task.storyPoints,
          selected: task.selected,
          assigneeName: existing?.assigneeName ?? task.assigneeName ?? 'Unassigned',
          assigneePhotoUrl: existing?.assigneePhotoUrl ?? task.assigneePhotoUrl ?? null,
          assignees: task.assignees ?? existing?.assignees ?? [],
          status: existing?.status ?? (task.status as SprintStatus) ?? 'TODO',
          startDate: task.startDate ?? existing?.startDate ?? '',
          dueDate: task.dueDate ?? existing?.dueDate ?? '',
          priority: existing?.priority ?? 'Medium',
          subtasks: existing?.subtasks ?? '',
          labels: task.labels ?? existing?.labels ?? [],
        };
      });
    }));
  }, [sprint.tasks]);

  // ── Team members ───────────────────────────────────────────────────────────

  const fetchTeamMembers = useCallback(async (showError = true) => {
    if (loadingMembers) return;
    try {
      setLoadingMembers(true);
      const project = await projectsApi.get(projectId);
      const teamId = project.teamId;
      if (teamId) {
        const data = await projectsApi.getTeamMembers(teamId);
        setTeamMembers(Array.isArray(data) ? (data as TeamMemberInfo[]) : []);
      }
    } catch {
      if (showError) { /* silent */ }
    } finally {
      setLoadingMembers(false);
    }
  }, [projectId, loadingMembers]);

  useEffect(() => {
    queueMicrotask(() => void fetchTeamMembers(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── Task update helpers ────────────────────────────────────────────────────

  const updateTask = (taskId: number, updates: Partial<LocalSprintTask>) => {
    setLocalTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...updates } : t));
  };

  const updateTaskOnServer = async (taskId: number, payload: Record<string, unknown>) => {
    try { await tasksApi.update(taskId, payload); } catch { /* silent */ }
  };

  const handleStatusChange = (taskId: number, status: SprintStatus) => {
    updateTask(taskId, { status });
    if (onStatusChange) onStatusChange(taskId, status);
    else void updateTaskOnServer(taskId, { status });
  };

  const handleStoryPointChange = (taskId: number, points: number) => {
    const value = Number.isNaN(points) ? 0 : points;
    updateTask(taskId, { storyPoints: value });
    if (onStoryPointsChange) onStoryPointsChange(taskId, value);
    else void updateTaskOnServer(taskId, { storyPoint: value });
  };

  const handleDueDateChange = async (taskId: number, date: string) => {
    const normalizedDate = date ? String(date).slice(0, 10) : '';
    const previousDate = localTasks.find((task) => task.id === taskId)?.dueDate ?? '';
    updateTask(taskId, { dueDate: normalizedDate });
    try {
      if (onDueDateChange) await onDueDateChange(taskId, normalizedDate);
      else await tasksApi.updateDates(taskId, { dueDate: normalizedDate || null });
    } catch {
      updateTask(taskId, { dueDate: previousDate });
    }
  };

  const handleRenameTask = async (taskId: number, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    updateTask(taskId, { title: trimmed });
    if (onRenameTask) onRenameTask(taskId, trimmed);
    else { try { await tasksApi.update(taskId, { title: trimmed }); } catch { /* silent */ } }
  };

  const handleDeleteTask = async (taskId: number) => {
    const saved = localTasks.find((t) => t.id === taskId);
    setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
    try { await tasksApi.delete(taskId); } catch {
      if (saved) setLocalTasks((prev) => [...prev, saved]);
    }
  };

  const handleAssignTask = async (taskId: number, userId: number) => {
    try {
      await tasksApi.assignTaskSingle(taskId, userId);
      const member = teamMembers.find((m) => m.user.userId === userId);
      const name = member ? getMemberDisplayName(member) : 'Unassigned';
      const photo = member?.user?.profilePicUrl || null;
      const newAssignees: TaskItem['assignees'] = member ? [{
        id: member.user.userId,
        userId: member.user.userId,
        memberId: member.id,
        name,
        avatar: photo || undefined,
        photoUrl: photo,
        profilePicUrl: photo,
      }] : [];
      updateTask(taskId, {
        assigneeName: name,
        assigneePhotoUrl: photo,
        assignees: newAssignees,
      });
      if (onAssignTask) onAssignTask(taskId, name, photo, newAssignees);
    } catch { /* silent */ }
  };

  const handleAssignMultiple = async (taskId: number, userIds: number[]) => {
    try {
      await tasksApi.assignTaskMultiple(taskId, { assigneeIds: userIds });
      const assignedMembers = teamMembers.filter((m) => userIds.includes(m.user.userId));
      const first = assignedMembers[0];
      const newAssignees: TaskItem['assignees'] = assignedMembers.map((m) => ({
        id: m.user.userId,
        userId: m.user.userId,
        memberId: m.id,
        name: getMemberDisplayName(m),
        avatar: m.user.profilePicUrl || undefined,
        photoUrl: m.user.profilePicUrl || null,
        profilePicUrl: m.user.profilePicUrl || null,
      }));
      const name = first ? getMemberDisplayName(first) : 'Unassigned';
      const photo = first?.user?.profilePicUrl || null;
      updateTask(taskId, {
        assigneeName: name,
        assigneePhotoUrl: photo,
        assignees: newAssignees,
      });
      if (onAssignMultiple) {
        await onAssignMultiple(taskId, userIds, newAssignees);
      } else if (onAssignTask) {
        onAssignTask(taskId, name, photo, newAssignees);
      }
    } catch {
      toast('Failed to update assignees.', 'error');
    }
  };

  const handleAddLabel = async (taskId: number, labelId: number) => {
    try {
      await tasksApi.addLabel(taskId, labelId);
      const label = projectLabels.find((l) => l.id === labelId);
      if (label) {
        setLocalTasks((prev) =>
          prev.map((t) =>
            t.id !== taskId || t.labels?.some((l) => l.id === labelId) ? t : { ...t, labels: [...(t.labels ?? []), label] }
          )
        );
      }
    } catch { /* silent */ }
  };

  const handleRemoveLabel = async (taskId: number, labelId: number) => {
    try {
      await tasksApi.removeLabel(taskId, labelId);
      setLocalTasks((prev) =>
        prev.map((t) => t.id !== taskId ? t : { ...t, labels: (t.labels ?? []).filter((l) => l.id !== labelId) })
      );
    } catch { /* silent */ }
  };

  // ── Sprint actions ─────────────────────────────────────────────────────────

  const handleNameSave = async (name: string) => {
    setEditingSprintLoading(true);
    try {
      await sprintsApi.update(sprint.id, { name });
      const sbKey = buildSessionCacheKey('sprint-board-v2', [projectId]);
      if (sbKey) removeSessionCache(sbKey);
      const blKey = buildSessionCacheKey('sprint-backlog', [projectId, 'active']);
      if (blKey) removeSessionCache(blKey);
      window.dispatchEvent(new CustomEvent('planora:sprint-updated'));
      window.dispatchEvent(new CustomEvent('planora:task-updated'));
      onSprintUpdated(sprint.id, { name });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast(axiosErr?.response?.data?.message || 'Failed to rename sprint.', 'error');
    } finally {
      setEditingSprintLoading(false);
    }
  };

  const confirmEditSprint = async (newName: string) => {
    const trimmedName = newName.trim();
    const currentSprintName = sprint.name.trim().toLowerCase();
    const hasDuplicateName = existingSprintNames.some((name) => {
      const normalized = name.trim().toLowerCase();
      return normalized === trimmedName.toLowerCase() && normalized !== currentSprintName;
    });

    if (hasDuplicateName) {
      setEditSprintError('Sprint name already exists.');
      return;
    }

    setEditingSprintLoading(true);
    setEditSprintError('');
    try {
      await sprintsApi.update(sprint.id, { name: trimmedName });
      setShowEditSprintModal(false);
      const sbKey = buildSessionCacheKey('sprint-board-v2', [projectId]);
      if (sbKey) removeSessionCache(sbKey);
      const blKey = buildSessionCacheKey('sprint-backlog', [projectId, 'active']);
      if (blKey) removeSessionCache(blKey);
      window.dispatchEvent(new CustomEvent('planora:sprint-updated'));
      window.dispatchEvent(new CustomEvent('planora:task-updated'));
      onSprintUpdated(sprint.id, { name: trimmedName });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr?.response?.data?.message || 'Failed to edit sprint.';
      setEditSprintError(msg);
      toast(msg, 'error');
    } finally {
      setEditingSprintLoading(false);
    }
  };

  const saveGoal = async () => {
    setSavingGoal(true);
    try { await sprintsApi.update(sprint.id, { goal: goalText.trim() }); setEditingGoal(false); }
    catch { /* silent */ } finally { setSavingGoal(false); }
  };

  const confirmStartSprint = async (durationDays: number, selectedStartDate?: string) => {
    if (!durationDays || durationDays <= 0) {
      setStartSprintError('Please enter a valid duration greater than 0.');
      return;
    }
    setStartingSprintLoading(true);
    setStartSprintError('');
    
    // Parse the selected start date or default to today
    const startDate = selectedStartDate ? new Date(selectedStartDate) : new Date();
    
    // Ensure we use UTC midnight for the calculation if a string was provided to match input behavior
    const baseDate = selectedStartDate 
      ? new Date(startDate.getTime() + startDate.getTimezoneOffset() * 60000)
      : startDate;

    const endDate = new Date(baseDate.getTime());
    endDate.setDate(baseDate.getDate() + durationDays);

    try {
      await sprintsApi.start(sprint.id, {
        startDate: formatLocalDate(baseDate),
        endDate: formatLocalDate(endDate),
      });
      setShowStartSprintModal(false);
      onSprintUpdated(sprint.id, {
        status: 'ACTIVE',
        startDate: formatLocalDate(baseDate),
        endDate: formatLocalDate(endDate),
      });
      const sbKey = buildSessionCacheKey('sprint-board-v2', [projectId]);
      if (sbKey) removeSessionCache(sbKey);
      const blKey = buildSessionCacheKey('sprint-backlog', [projectId, 'active']);
      if (blKey) removeSessionCache(blKey);
      window.dispatchEvent(new CustomEvent('planora:sprint-updated'));
      window.dispatchEvent(new CustomEvent('planora:task-updated'));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setStartSprintError(error.response?.data?.message || 'Failed to start sprint. Please try again.');
    } finally {
      setStartingSprintLoading(false);
    }
  };

  const incompleteTaskCount = localTasks.filter((t) => t.status !== 'DONE').length;

  const openCompleteSprintModal = () => {
    setCompleteDestination(null); // default: backlog
    setConfirmCompleteSprint(true);
  };

  const doCompleteSprint = async () => {
    setCompletingSprintLoading(true);
    try {
      await sprintsApi.complete(sprint.id, completeDestination);
      setConfirmCompleteSprint(false);
      onSprintUpdated(sprint.id, { status: 'COMPLETED' });
      const sbKey = buildSessionCacheKey('sprint-board-v2', [projectId]);
      if (sbKey) removeSessionCache(sbKey);
      const blKey = buildSessionCacheKey('sprint-backlog', [projectId, 'active']);
      if (blKey) removeSessionCache(blKey);
      window.dispatchEvent(new CustomEvent('planora:sprint-updated'));
      window.dispatchEvent(new CustomEvent('planora:task-updated'));
      toast('Sprint completed successfully.', 'success');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast(axiosErr?.response?.data?.message || 'Failed to complete sprint.', 'error');
      setConfirmCompleteSprint(false);
    } finally {
      setCompletingSprintLoading(false);
    }
  };

  const doDeleteSprint = async () => {
    setDeletingSprintLoading(true);
    try {
      await sprintsApi.delete(sprint.id);
      setConfirmDeleteSprint(false);
      const sbKey = buildSessionCacheKey('sprint-board-v2', [projectId]);
      if (sbKey) removeSessionCache(sbKey);
      const blKey = buildSessionCacheKey('sprint-backlog', [projectId, 'active']);
      if (blKey) removeSessionCache(blKey);
      window.dispatchEvent(new CustomEvent('planora:sprint-updated'));
      window.dispatchEvent(new CustomEvent('planora:task-updated'));
      onSprintDeleted(sprint.id, sprint.tasks);
    } catch {
      setConfirmDeleteSprint(false);
    } finally {
      setDeletingSprintLoading(false);
    }
  };

  return {
    localTasks,
    setLocalTasks,
    teamMembers,
    loadingMembers,
    // Modal states
    showStartSprintModal, setShowStartSprintModal,
    startingSprintLoading, startSprintError,
    confirmDeleteSprint, setConfirmDeleteSprint,
    confirmCompleteSprint, setConfirmCompleteSprint,
    completeDestination, setCompleteDestination,
    incompleteTaskCount,
    availableSprintsForMove,
    taskToDeleteId, setTaskToDeleteId,
    deletingSprintLoading,
    completingSprintLoading,
    showEditSprintModal, setShowEditSprintModal,
    editingSprintLoading,
    editSprintError, setEditSprintError,
    goalText, setGoalText,
    editingGoal, setEditingGoal,
    savingGoal,
    showReportModal, setShowReportModal,
    selectedTaskId, setSelectedTaskId,
    // Handlers
    handleStatusChange,
    handleStoryPointChange,
    handleDueDateChange,
    handleRenameTask,
    handleDeleteTask,
    handleAssignTask,
    handleAssignMultiple,
    handleAddLabel,
    handleRemoveLabel,
    handleNameSave,
    confirmEditSprint,
    saveGoal,
    confirmStartSprint,
    openCompleteSprintModal,
    doCompleteSprint,
    doDeleteSprint,
  };
}
