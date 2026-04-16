import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';
import { toast } from '@/components/ui';
import type { SprintItem, TaskItem } from '@/types';

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
  status: SprintStatus;
  startDate: string;
  dueDate: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  subtasks: string;
  labels?: Array<{ id: number; name: string; color?: string }>;
}

interface UseBacklogCardHandlersArgs {
  sprint: SprintItem;
  projectId: string;
  onSprintDeleted: (sprintId: number, tasks: TaskItem[]) => void;
  onStatusChange?: (taskId: number, status: string) => void;
  onStoryPointsChange?: (taskId: number, points: number) => void;
  onAssignTask?: (taskId: number, name: string, photo: string | null) => void;
  onRenameTask?: (taskId: number, title: string) => void;
  onDueDateChange?: (taskId: number, dueDate: string) => Promise<void>;
  projectLabels: Array<{ id: number; name: string; color?: string }>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useBacklogCardHandlers({
  sprint,
  projectId,
  onSprintDeleted,
  onStatusChange,
  onStoryPointsChange,
  onAssignTask,
  onRenameTask,
  onDueDateChange,
  projectLabels,
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
  const [taskToDeleteId, setTaskToDeleteId] = useState<number | null>(null);
  const [deletingSprintLoading, setDeletingSprintLoading] = useState(false);
  const [completingSprintLoading, setCompletingSprintLoading] = useState(false);

  const [showEditSprintModal, setShowEditSprintModal] = useState(false);
  const [editingSprintLoading, setEditingSprintLoading] = useState(false);

  const [goalText, setGoalText] = useState(sprint.goal ?? '');
  const [editingGoal, setEditingGoal] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const getMemberDisplayName = (member: TeamMemberInfo) => member.user.fullName || member.user.username;

  // ── Sync local tasks from props ────────────────────────────────────────────

  useEffect(() => {
    setLocalTasks((prev) => {
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
          status: existing?.status ?? (task.status as SprintStatus) ?? 'TODO',
          startDate: task.startDate ?? existing?.startDate ?? '',
          dueDate: task.dueDate ?? existing?.dueDate ?? '',
          priority: existing?.priority ?? 'Medium',
          subtasks: existing?.subtasks ?? '',
          labels: task.labels ?? existing?.labels ?? [],
        };
      });
    });
  }, [sprint.tasks]);

  // ── Team members ───────────────────────────────────────────────────────────

  const fetchTeamMembers = useCallback(async (showError = true) => {
    if (loadingMembers) return;
    try {
      setLoadingMembers(true);
      const projectRes = await api.get(`/api/projects/${projectId}`);
      const teamId = projectRes.data.teamId;
      const membersRes = await api.get(`/api/teams/${teamId}/members`);
      setTeamMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
    } catch {
      if (showError) { /* silent */ }
    } finally {
      setLoadingMembers(false);
    }
  }, [projectId, loadingMembers]);

  useEffect(() => {
    void fetchTeamMembers(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── Task update helpers ────────────────────────────────────────────────────

  const updateTask = (taskId: number, updates: Partial<LocalSprintTask>) => {
    setLocalTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...updates } : t));
  };

  const updateTaskOnServer = async (taskId: number, payload: Record<string, unknown>) => {
    try { await api.put(`/api/tasks/${taskId}`, payload); } catch { /* silent */ }
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
      else await api.patch(`/api/tasks/${taskId}/dates`, { dueDate: normalizedDate || null });
    } catch {
      updateTask(taskId, { dueDate: previousDate });
    }
  };

  const handleRenameTask = async (taskId: number, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    updateTask(taskId, { title: trimmed });
    if (onRenameTask) onRenameTask(taskId, trimmed);
    else { try { await api.put(`/api/tasks/${taskId}`, { title: trimmed }); } catch { /* silent */ } }
  };

  const handleDeleteTask = async (taskId: number) => {
    const saved = localTasks.find((t) => t.id === taskId);
    setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
    try { await api.delete(`/api/tasks/${taskId}`); } catch {
      if (saved) setLocalTasks((prev) => [...prev, saved]);
    }
  };

  const handleAssignTask = async (taskId: number, userId: number) => {
    try {
      await api.patch(`/api/tasks/${taskId}/assign/${userId}`);
      const member = teamMembers.find((m) => m.user.userId === userId);
      if (member) {
        const name = getMemberDisplayName(member);
        const photo = member.user.profilePicUrl || null;
        updateTask(taskId, { assigneeName: name, assigneePhotoUrl: photo });
        if (onAssignTask) onAssignTask(taskId, name, photo);
      }
    } catch { /* silent */ }
  };

  const handleAddLabel = async (taskId: number, labelId: number) => {
    try {
      await api.post(`/api/tasks/${taskId}/label/${labelId}`);
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
      await api.delete(`/api/tasks/${taskId}/label/${labelId}`);
      setLocalTasks((prev) =>
        prev.map((t) => t.id !== taskId ? t : { ...t, labels: (t.labels ?? []).filter((l) => l.id !== labelId) })
      );
    } catch { /* silent */ }
  };

  // ── Sprint actions ─────────────────────────────────────────────────────────

  const handleNameSave = async (name: string) => {
    setEditingSprintLoading(true);
    try {
      await api.put(`/api/sprints/${sprint.id}`, { name });
      sprint.name = name;
    } catch { /* silent */ } finally {
      setEditingSprintLoading(false);
    }
  };

  const confirmEditSprint = async (newName: string) => {
    setEditingSprintLoading(true);
    try {
      await api.put(`/api/sprints/${sprint.id}`, { name: newName });
      setShowEditSprintModal(false);
      sprint.name = newName;
    } catch { /* silent */ } finally {
      setEditingSprintLoading(false);
    }
  };

  const saveGoal = async () => {
    setSavingGoal(true);
    try { await api.put(`/api/sprints/${sprint.id}`, { goal: goalText.trim() }); setEditingGoal(false); }
    catch { /* silent */ } finally { setSavingGoal(false); }
  };

  const confirmStartSprint = async (durationDays: number) => {
    if (!durationDays || durationDays <= 0) {
      setStartSprintError('Please enter a valid duration greater than 0.');
      return;
    }
    setStartingSprintLoading(true);
    setStartSprintError('');
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + durationDays);
    try {
      await api.put(`/api/sprints/${sprint.id}/start`, {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
      setShowStartSprintModal(false);
      sprint.status = 'ACTIVE';
      sprint.startDate = startDate.toISOString().split('T')[0];
      sprint.endDate = endDate.toISOString().split('T')[0];
      window.dispatchEvent(new CustomEvent('planora:task-updated'));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setStartSprintError(error.response?.data?.message || 'Failed to start sprint. Please try again.');
    } finally {
      setStartingSprintLoading(false);
    }
  };

  const doCompleteSprint = async () => {
    setCompletingSprintLoading(true);
    try {
      await api.put(`/api/sprints/${sprint.id}/complete`);
      setConfirmCompleteSprint(false);
      sprint.status = 'COMPLETED';
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
      await api.delete(`/api/sprints/${sprint.id}`);
      setConfirmDeleteSprint(false);
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
    taskToDeleteId, setTaskToDeleteId,
    deletingSprintLoading,
    completingSprintLoading,
    showEditSprintModal, setShowEditSprintModal,
    editingSprintLoading,
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
    handleAddLabel,
    handleRemoveLabel,
    handleNameSave,
    confirmEditSprint,
    saveGoal,
    confirmStartSprint,
    doCompleteSprint,
    doDeleteSprint,
  };
}
