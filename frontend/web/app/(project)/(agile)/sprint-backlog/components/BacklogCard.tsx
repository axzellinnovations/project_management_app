'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Check,
  Trash2,
  X,
  Rocket,
  Clock,
  CornerDownLeft,
} from 'lucide-react';
import TaskRow from './TaskRow';
import type { SprintItem, TaskItem } from '@/types';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import api from '@/lib/axios';
import SprintReportModal from './SprintReportModal';

interface TeamMemberInfo {
  id: number;
  user: { userId: number; fullName: string; username: string; profilePicUrl?: string | null };
}

interface BacklogCardProps {
  sprint: SprintItem;
  projectId: string;
  currentUserRole?: string | null;
  onDropTask: (taskId: number, sprintId: number) => void;
  onCreateTask: (title: string, sprintId: number) => void;
  onDeleteTask: (taskId: number, sprintId: number) => void;
  onToggleTask: (taskId: number) => void;
  onSprintDeleted: (sprintId: number, tasks: TaskItem[]) => void;
}

type SprintStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

interface LocalSprintTask {
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
}

const DURATION_PRESETS = [
  { label: '1 Week', days: 7 },
  { label: '2 Weeks', days: 14 },
  { label: '3 Weeks', days: 21 },
  { label: '1 Month', days: 30 },
];

// ── Reusable Confirmation Modal ──────────────────────────────────────────────
interface ConfirmModalProps {
  open: boolean;
  variant: 'danger' | 'warning' | 'success';
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  open,
  variant,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const variantConfig = {
    danger: {
      iconBg: 'bg-[#FEF3F2]',
      iconColor: 'text-[#D92D20]',
      icon: <Trash2 size={22} />,
      btnClass: 'bg-[#D92D20] hover:bg-[#B42318] text-white',
      borderColor: 'border-[#FDA29B]',
    },
    warning: {
      iconBg: 'bg-[#FFFAEB]',
      iconColor: 'text-[#B54708]',
      icon: <AlertTriangle size={22} />,
      btnClass: 'bg-[#DC6803] hover:bg-[#B54708] text-white',
      borderColor: 'border-[#FEDF89]',
    },
    success: {
      iconBg: 'bg-[#ECFDF3]',
      iconColor: 'text-[#027A48]',
      icon: <CheckCircle2 size={22} />,
      btnClass: 'bg-[#039855] hover:bg-[#027A48] text-white',
      borderColor: 'border-[#A6F4C5]',
    },
  };

  const cfg = variantConfig[variant];

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(16, 24, 40, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl border border-[#E4E7EC] bg-white shadow-2xl"
        style={{ animation: 'confirmSlideIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1 text-[#98A2B3] hover:text-[#344054] hover:bg-[#F2F4F7] transition-all duration-150"
        >
          <X size={16} />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl border ${cfg.borderColor} ${cfg.iconBg} ${cfg.iconColor}`}>
            {cfg.icon}
          </div>

          {/* Title & Message */}
          <h3 className="text-[16px] font-bold text-[#101828] mb-1">{title}</h3>
          <p className="text-[13.5px] text-[#475467] leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-[#F2F4F7] px-6 py-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-[#D0D5DD] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F9FAFB] transition-all duration-150 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13.5px] font-semibold shadow-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${cfg.btnClass}`}
          >
            {loading && <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
            {confirmLabel}
          </button>
        </div>

        <style>{`
          @keyframes confirmSlideIn {
            from { opacity: 0; transform: scale(0.92) translateY(10px); }
            to   { opacity: 1; transform: scale(1)   translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}

// ── Edit Sprint Modal ────────────────────────────────────────────────────────
interface EditSprintModalProps {
  open: boolean;
  sprintName: string;
  loading: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

function EditSprintModal({ open, sprintName, loading, onConfirm, onCancel }: EditSprintModalProps) {
  const [name, setName] = useState(sprintName);
  const [prevName, setPrevName] = useState(sprintName);

  if (sprintName !== prevName) {
    setName(sprintName);
    setPrevName(sprintName);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(16, 24, 40, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl border border-[#E4E7EC] bg-white shadow-2xl"
        style={{ animation: 'confirmSlideIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1 text-[#98A2B3] hover:text-[#344054] hover:bg-[#F2F4F7] transition-all duration-150"
        >
          <X size={16} />
        </button>

        <div className="p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#B2DDFF] bg-[#EFF8FF] text-[#175CD3]">
            <Pencil size={20} />
          </div>
          <h3 className="text-[16px] font-bold text-[#101828] mb-1">Edit Sprint</h3>
          <p className="text-[13px] text-[#475467] mb-4">Update the sprint name.</p>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onConfirm(name.trim()); }}
            autoFocus
            className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-[14px] text-[#101828] outline-none focus:border-[#175CD3] focus:ring-2 focus:ring-[#175CD3]/20 transition-all duration-150"
            placeholder="Sprint name..."
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[#F2F4F7] px-6 py-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-[#D0D5DD] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F9FAFB] transition-all duration-150 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (name.trim()) onConfirm(name.trim()); }}
            disabled={loading || !name.trim()}
            className="flex items-center gap-2 rounded-lg bg-[#175CD3] hover:bg-[#1849A9] px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
            Save Changes
          </button>
        </div>

        <style>{`
          @keyframes confirmSlideIn {
            from { opacity: 0; transform: scale(0.92) translateY(10px); }
            to   { opacity: 1; transform: scale(1)   translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function BacklogCard({ sprint, projectId, currentUserRole, onDropTask, onCreateTask, onDeleteTask, onToggleTask, onSprintDeleted }: BacklogCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showSprintMenu, setShowSprintMenu] = useState(false);
  const [showCreateTaskBox, setShowCreateTaskBox] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const canDeleteSprint = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';
  const canDeleteTask = currentUserRole !== 'VIEWER';

  // Start Sprint Modal state
  const [showStartSprintModal, setShowStartSprintModal] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(14);
  const [customDuration, setCustomDuration] = useState<string>('');
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [startingSprintLoading, setStartingSprintLoading] = useState(false);
  const [startSprintError, setStartSprintError] = useState<string>('');

  // Confirmation modals state
  const [confirmDeleteSprint, setConfirmDeleteSprint] = useState(false);
  const [confirmCompleteSprint, setConfirmCompleteSprint] = useState(false);
  const [taskToDeleteId, setTaskToDeleteId] = useState<number | null>(null);
  const [deletingSprintLoading, setDeletingSprintLoading] = useState(false);
  const [completingSprintLoading, setCompletingSprintLoading] = useState(false);

  // Edit sprint modal state
  const [showEditSprintModal, setShowEditSprintModal] = useState(false);
  const [editingSprintLoading, setEditingSprintLoading] = useState(false);

  // Sprint goal state
  const [goalText, setGoalText] = useState(sprint.goal ?? '');
  const [editingGoal, setEditingGoal] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  // Sprint report modal state
  const [showReportModal, setShowReportModal] = useState(false);

  const sprintMenuRef = useRef<HTMLDivElement | null>(null);
  const createTaskRef = useRef<HTMLFormElement | null>(null);

  const [localTasks, setLocalTasks] = useState<LocalSprintTask[]>([]);

  const getMemberDisplayName = (member: TeamMemberInfo) => member.user.fullName || member.user.username;

  useEffect(() => {
    setLocalTasks((prev) => {
      const prevMap = new Map(prev.map((task) => [task.id, task]));

      return sprint.tasks.map((task) => {
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
        };
      });
    });
  }, [sprint.tasks]);

  useEffect(() => {
    void fetchTeamMembers(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sprintMenuRef.current &&
        !sprintMenuRef.current.contains(event.target as Node)
      ) {
        setShowSprintMenu(false);
      }
      if (
        createTaskRef.current &&
        !createTaskRef.current.contains(event.target as Node)
      ) {
        setShowCreateTaskBox(false);
        setNewTaskName('');
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSprintMenu(false);
        setShowCreateTaskBox(false);
        setNewTaskName('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const totals = useMemo(() => {
    return localTasks.reduce(
      (acc, task) => {
        if (task.status === 'TODO') acc.todo += task.storyPoints;
        if (task.status === 'IN_PROGRESS') acc.inprogress += task.storyPoints;
        if (task.status === 'DONE') acc.done += task.storyPoints;
        return acc;
      },
      { todo: 0, inprogress: 0, done: 0 }
    );
  }, [localTasks]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const taskId = Number(event.dataTransfer.getData('text/plain'));
    if (!taskId) return;

    onDropTask(taskId, sprint.id);
  };

  const updateTask = (taskId: number, updates: Partial<LocalSprintTask>) => {
    setLocalTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    );
  };

  const updateTaskOnServer = async (taskId: number, payload: Record<string, unknown>) => {
    try {
      await api.put(`/api/tasks/${taskId}`, payload);
    } catch {
      // silent fail — local state already updated
    }
  };

  const handleStatusChange = (taskId: number, status: SprintStatus) => {
    updateTask(taskId, { status });
    updateTaskOnServer(taskId, { status });
  };

  const handleStoryPointChange = (taskId: number, points: number) => {
    const value = Number.isNaN(points) ? 0 : points;
    updateTask(taskId, { storyPoints: value });
    updateTaskOnServer(taskId, { storyPoint: value });
  };

  const handleDueDateChange = async (taskId: number, date: string) => {
    const normalizedDate = date ? String(date).slice(0, 10) : '';
    const previousDate = localTasks.find((task) => task.id === taskId)?.dueDate ?? '';

    updateTask(taskId, { dueDate: normalizedDate });

    try {
      const response = await api.put(`/api/tasks/${taskId}`, {
        dueDate: normalizedDate || null,
      });

      const serverDueDate = response?.data?.dueDate
        ? String(response.data.dueDate).slice(0, 10)
        : '';

      updateTask(taskId, { dueDate: serverDueDate });
    } catch {
      updateTask(taskId, { dueDate: previousDate });
    }
  };

  const handleEditSprint = () => {
    setShowSprintMenu(false);
    setShowEditSprintModal(true);
  };

  const confirmEditSprint = async (newName: string) => {
    setEditingSprintLoading(true);
    try {
      await api.put(`/api/sprints/${sprint.id}`, { name: newName });
      setShowEditSprintModal(false);
      window.location.reload();
    } catch {
      // silently fail
    } finally {
      setEditingSprintLoading(false);
    }
  };

  const saveGoal = async () => {
    setSavingGoal(true);
    try {
      await api.put(`/api/sprints/${sprint.id}`, { goal: goalText.trim() });
      setEditingGoal(false);
    } catch {
      // silently fail
    } finally {
      setSavingGoal(false);
    }
  };

  const handleCompleteSprint = () => {
    setShowSprintMenu(false);
    setConfirmCompleteSprint(true);
  };

  const doCompleteSprint = async () => {
    setCompletingSprintLoading(true);
    try {
      await api.put(`/api/sprints/${sprint.id}`, { status: 'COMPLETED' });
      setConfirmCompleteSprint(false);
      window.location.reload();
    } catch {
      setConfirmCompleteSprint(false);
    } finally {
      setCompletingSprintLoading(false);
    }
  };

  const handleStartSprint = () => {
    setSelectedDuration(14);
    setCustomDuration('');
    setUseCustomDuration(false);
    setStartSprintError('');
    setShowStartSprintModal(true);
    setShowSprintMenu(false);
  };

  const getEffectiveDuration = () => {
    if (useCustomDuration) {
      const val = parseInt(customDuration);
      return isNaN(val) || val <= 0 ? 0 : val;
    }
    return selectedDuration;
  };

  const getPreviewDates = () => {
    const duration = getEffectiveDuration();
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + duration);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return { start: fmt(start), end: fmt(end) };
  };

  const confirmStartSprint = async () => {
    const duration = getEffectiveDuration();
    if (!duration || duration <= 0) {
      setStartSprintError('Please enter a valid duration greater than 0.');
      return;
    }

    setStartingSprintLoading(true);
    setStartSprintError('');

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + duration);

    try {
      await api.put(`/api/sprints/${sprint.id}/start`, {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
      setShowStartSprintModal(false);
      window.location.reload();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setStartSprintError(error.response?.data?.message || 'Failed to start sprint. Please try again.');
    } finally {
      setStartingSprintLoading(false);
    }
  };

  const handleDeleteSprint = () => {
    setShowSprintMenu(false);
    setConfirmDeleteSprint(true);
  };

  const doDeleteSprint = async () => {
    setDeletingSprintLoading(true);
    try {
      // Move all sprint tasks to backlog before deleting
      await Promise.all(
        localTasks.map((task) => api.put(`/api/tasks/${task.id}`, { sprintId: null }))
      );
      await api.delete(`/api/sprints/${sprint.id}`);
      setConfirmDeleteSprint(false);
      onSprintDeleted(sprint.id, sprint.tasks);
    } catch {
      setConfirmDeleteSprint(false);
    } finally {
      setDeletingSprintLoading(false);
    }
  };

  const handleRenameTask = async (taskId: number, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      await api.put(`/api/tasks/${taskId}`, { title: trimmed });
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, title: trimmed } : t))
      );
    } catch {
      // silent
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    const saved = localTasks.find((t) => t.id === taskId);
    setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
    onDeleteTask(taskId, sprint.id);
    try {
      await api.delete(`/api/tasks/${taskId}`);
    } catch {
      // Revert on failure
      if (saved) setLocalTasks((prev) => [...prev, saved]);
    }
  };

  const fetchTeamMembers = async (showError = true) => {
    if (loadingMembers) return;

    try {
      setLoadingMembers(true);
      const projectRes = await api.get(`/api/projects/${projectId}`);
      const teamId = projectRes.data.teamId;
      const membersRes = await api.get(`/api/teams/${teamId}/members`);
      const data = membersRes.data;
      setTeamMembers(Array.isArray(data) ? data : []);
    } catch {
      if (showError) {
        // silent, just don't show members
      }
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleAssignTask = async (taskId: number, userId: number) => {
    try {
      await api.patch(`/api/tasks/${taskId}/assign/${userId}`);
      const member = teamMembers.find((m) => m.user.userId === userId);
      if (member) {
        setLocalTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  assigneeName: getMemberDisplayName(member),
                  assigneePhotoUrl: member.user.profilePicUrl,
                }
              : t
          )
        );
      }
    } catch {
      // silent
    }
  };

  return (
    <>
    <div className="rounded-xl border border-[#E4E7EC] bg-[#F8F9FB] p-5 shadow-sm">
      {/* Sprint Header */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAECF0] pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded border border-[#98A2B3] bg-transparent" />

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-[#344054] p-1 hover:bg-[#F2F4F7] rounded-lg transition-colors duration-150"
          >
            {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[16px] font-bold text-[#101828]">
              {sprint.name}
            </span>
          </div>
        </div>

        <div className="relative flex flex-wrap items-center gap-3" ref={sprintMenuRef}>
          <div className="flex items-center gap-1.5 bg-white border border-[#EAECF0] px-2 py-1 rounded-full shadow-sm">
            <div className="rounded-full bg-[#F2F4F7] px-2 py-[2px] text-[10px] font-bold text-[#344054]" title="To Do">
              {totals.todo}
            </div>
            <div className="rounded-full bg-[#EFF8FF] px-2 py-[2px] text-[10px] font-bold text-[#175CD3]" title="In Progress">
              {totals.inprogress}
            </div>
            <div className="rounded-full bg-[#ECFDF3] px-2 py-[2px] text-[10px] font-bold text-[#027A48]" title="Done">
              {totals.done}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            {sprint.status === 'NOT_STARTED' ? (
              <button
                onClick={handleStartSprint}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg border border-[#175CD3] bg-[#175CD3] px-2.5 py-2 text-[13px] font-bold text-white hover:bg-[#1849A9] shadow-sm transform active:scale-95 transition-all duration-150"
              >
                <Rocket size={14} />
                Start Sprint
              </button>
            ) : sprint.status === 'ACTIVE' ? (
              <button
                onClick={handleCompleteSprint}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg border border-[#027A48] bg-[#039855] px-2.5 py-2 text-[13px] font-bold text-white hover:bg-[#027A48] shadow-sm transform active:scale-95 transition-all duration-150"
              >
                <Check size={14} />
                Complete Sprint
              </button>
            ) : (
              <span className="flex-1 sm:flex-none text-center rounded-lg border border-[#EAECF0] bg-[#F2F4F7] px-2.5 py-2 text-[13px] font-bold text-[#667085]">
                Completed
              </span>
            )}

            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              title="Sprint Report"
              className="flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-2.5 py-2 text-[13px] font-bold text-[#344054] hover:bg-[#F2F4F7] shadow-sm transition-colors duration-150"
            >
              <BarChart3 size={14} className="text-[#667085]" />
              Sprint Report
            </button>

            <button
              type="button"
              onClick={() => setShowSprintMenu((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={showSprintMenu}
              aria-label="Sprint actions"
              className="p-2 text-[#344054] hover:bg-[#F2F4F7] rounded-lg transition-colors duration-150"
            >
              <MoreHorizontal size={20} />
            </button>
          </div>

          {showSprintMenu && (
            <div role="menu" className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-[#D0D5DD] bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <button
                onClick={handleEditSprint}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] font-bold text-[#101828] hover:bg-[#F9FAFB]"
              >
                <Pencil size={18} className="text-[#667085]" />
                <span>Edit Sprint</span>
              </button>

              {sprint.status === 'NOT_STARTED' && (
                <button
                  onClick={handleStartSprint}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] font-bold text-[#101828] hover:bg-[#F9FAFB]"
                >
                  <Rocket size={18} className="text-[#175CD3]" />
                  <span>Start Sprint</span>
                </button>
              )}

              {sprint.status === 'ACTIVE' && (
                <button
                  onClick={handleCompleteSprint}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] font-bold text-[#027A48] hover:bg-[#F9FAFB]"
                >
                  <Check size={18} />
                  <span>Complete Sprint</span>
                </button>
              )}

              <button
                onClick={() => { setShowReportModal(true); setShowSprintMenu(false); }}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] font-bold text-[#101828] hover:bg-[#F9FAFB]"
              >
                <BarChart3 size={18} className="text-[#667085]" />
                <span>View Report</span>
              </button>

              <div className="border-t border-[#EAECF0]" />

              <button
                onClick={handleDeleteSprint}
                disabled={!canDeleteSprint}
                className={`flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] font-bold ${
                  canDeleteSprint ? 'text-[#F04438] hover:bg-[#FEF3F2]' : 'text-[#98A2B3] cursor-not-allowed'
                }`}
                title={!canDeleteSprint ? "Only an Admin or Owner can delete a sprint" : ""}
              >
                <Trash2 size={18} />
                <div className="flex flex-col">
                  <span>Delete Sprint</span>
                  {!canDeleteSprint && (
                    <span className="text-[10px] font-medium text-[#98A2B3]">
                      Admin/Owner only
                    </span>
                  )}
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sprint Goal */}
      {isOpen && (
        <div className="mb-3 px-1">
          {editingGoal ? (
            <div className="flex items-start gap-2">
              <textarea
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
                placeholder="Define the sprint goal..."
                className="flex-1 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-[13px] text-[#344054] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20 focus:border-[#155DFC] resize-none"
                rows={2}
                maxLength={500}
              />
              <button
                onClick={saveGoal}
                disabled={savingGoal}
                className="rounded-lg bg-[#155DFC] px-3 py-2 text-[12px] font-bold text-white hover:bg-[#1149C9] disabled:opacity-50 transition-colors"
              >
                {savingGoal ? '...' : 'Save'}
              </button>
              <button
                onClick={() => { setEditingGoal(false); setGoalText(sprint.goal ?? ''); }}
                className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-[12px] font-bold text-[#344054] hover:bg-[#F2F4F7] transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingGoal(true)}
              className="group flex items-center gap-2 text-[13px] text-[#667085] hover:text-[#344054] transition-colors"
            >
              <span className="font-medium">Goal:</span>
              <span className={goalText ? 'text-[#344054]' : 'italic'}>
                {goalText || 'Click to set a sprint goal...'}
              </span>
              <Pencil size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
      )}

      {isOpen && (
        <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
          <div className="space-y-0 rounded-lg overflow-hidden border border-[#EAECF0]">
            {localTasks.length > 0 ? (
              localTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(task.id));
                    }}
                  >
                    <TaskRow
                      task={task}
                      teamMembers={teamMembers}
                      loadingMembers={loadingMembers}
                      canDelete={canDeleteTask}
                      showCheckbox
                      onToggle={onToggleTask}
                      onStatusChange={(id, status) => handleStatusChange(id, status as SprintStatus)}
                      onStoryPointsChange={handleStoryPointChange}
                      onRenameTask={handleRenameTask}
                      onAssignTask={handleAssignTask}
                      onDueDateChange={handleDueDateChange}
                      onDeleteTask={(id) => setTaskToDeleteId(id)}
                      onOpenTask={(id) => setSelectedTaskId(id)}
                    />
                  </div>
              ))
            ) : (
              <div className="rounded-lg border-2 border-dashed border-[#D0D5DD] bg-[#F9FAFB] px-4 py-10 text-center text-[13px] text-[#667085]">
                Drag tasks here from Product Backlog
              </div>
            )}
          </div>

          {!showCreateTaskBox ? (
            <div className="mt-2 flex justify-start">
              <button
                onClick={() => setShowCreateTaskBox(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-2.5 py-1.5 text-[13px] font-medium text-[#344054] shadow-sm hover:bg-[#F9FAFB] transition-colors duration-150"
              >
                <span className="text-[18px] leading-none mb-0.5">+</span>
                Create Task
              </button>
            </div>
          ) : (
            <form 
              ref={createTaskRef}
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTaskName.trim()) { setShowCreateTaskBox(false); return; }
                onCreateTask(newTaskName.trim(), sprint.id);
                setNewTaskName('');
                setShowCreateTaskBox(false);
              }}
              className="mt-2 group relative flex items-center gap-3 rounded-lg border-2 border-[#175CD3] bg-white px-3 py-1.5 transition-all duration-200"
            >
              <div className="h-5 w-5 flex-shrink-0 rounded border-2 border-[#D0D5DD] opacity-50" />
              <ChevronDown size={16} className="text-[#98A2B3] opacity-50" />

              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowCreateTaskBox(false);
                    setNewTaskName('');
                  }
                }}
                placeholder="Task name"
                autoFocus
                className="flex-1 min-w-0 bg-transparent text-[13px] font-medium text-[#101828] outline-none placeholder-[#98A2B3]"
              />
              
              <button
                type="submit"
                disabled={!newTaskName.trim()}
                className="flex h-7 w-7 items-center justify-center shrink-0 rounded-md bg-[#175CD3] text-white hover:bg-[#1849A9] disabled:opacity-50 transition-colors duration-150"
                title="Create Task"
              >
                <CornerDownLeft size={14} />
              </button>
            </form>
          )}
        </div>
      )}
    </div>

    {selectedTaskId !== null && (
      <TaskCardModal
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
    )}

    {/* ── Task Delete Confirmation Modal ── */}
    <ConfirmModal
      open={taskToDeleteId !== null}
      onCancel={() => setTaskToDeleteId(null)}
      onConfirm={() => {
        if (taskToDeleteId) {
          handleDeleteTask(taskToDeleteId);
          setTaskToDeleteId(null);
        }
      }}
      title="Delete Task"
      message="Are you sure you want to delete this task? This action cannot be undone."
      confirmLabel="Delete"
      loading={false}
      variant="danger"
    />

    {/* ── Start Sprint Modal ── */}
    {showStartSprintModal && (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ backgroundColor: 'rgba(16, 24, 40, 0.55)', backdropFilter: 'blur(4px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) setShowStartSprintModal(false); }}
      >
        <div
          className="relative w-full max-w-md mx-4 rounded-2xl border border-[#E4E7EC] bg-white shadow-2xl"
          style={{ animation: 'modalSlideIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-[#F2F4F7]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#175CD3] to-[#2E90FA] shadow-md">
                <Rocket size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-[#101828] leading-tight">Start Sprint</h2>
                <p className="text-[13px] text-[#667085] mt-0.5">{sprint.name}</p>
              </div>
            </div>
            <button
              onClick={() => setShowStartSprintModal(false)}
              className="rounded-lg p-1.5 text-[#98A2B3] hover:text-[#344054] hover:bg-[#F2F4F7] transition-all duration-150"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {/* Description */}
            <p className="text-[13.5px] text-[#475467] leading-relaxed">
              Set the sprint duration. The sprint will start today and end based on your selection.
            </p>

            {/* Preset chips */}
            <div>
              <label className="block text-[12px] font-semibold text-[#344054] uppercase tracking-wider mb-2.5">
                Quick Select
              </label>
              <div className="grid grid-cols-4 gap-2">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => { setSelectedDuration(preset.days); setUseCustomDuration(false); setStartSprintError(''); }}
                    className={`rounded-lg border px-2 py-2.5 text-[12.5px] font-semibold transition-all duration-150 ${
                      !useCustomDuration && selectedDuration === preset.days
                        ? 'border-[#175CD3] bg-[#EFF8FF] text-[#175CD3] shadow-sm ring-1 ring-[#175CD3]/30'
                        : 'border-[#D0D5DD] bg-white text-[#344054] hover:border-[#98A2B3] hover:bg-[#F9FAFB]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom duration */}
            <div>
              <label className="block text-[12px] font-semibold text-[#344054] uppercase tracking-wider mb-2">
                Custom Duration
              </label>
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Clock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
                  <input
                    type="number"
                    min="1"
                    max="365"
                    placeholder="Enter days..."
                    value={customDuration}
                    onChange={(e) => {
                      setCustomDuration(e.target.value);
                      setUseCustomDuration(true);
                      setStartSprintError('');
                    }}
                    onFocus={() => setUseCustomDuration(true)}
                    className={`w-full rounded-lg border pl-9 pr-14 py-2.5 text-[14px] text-[#101828] outline-none transition-all duration-150 ${
                      useCustomDuration
                        ? 'border-[#175CD3] ring-2 ring-[#175CD3]/20'
                        : 'border-[#D0D5DD] hover:border-[#98A2B3]'
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#98A2B3] font-medium">days</span>
                </div>
              </div>
            </div>

            {/* Date preview */}
            {(() => {
              const duration = getEffectiveDuration();
              if (duration > 0) {
                const { start, end } = getPreviewDates();
                return (
                  <div className="flex items-center gap-3 rounded-xl border border-[#E4E7EC] bg-[#F8F9FB] px-4 py-3">
                    <CalendarDays size={16} className="text-[#667085] flex-shrink-0" />
                    <div className="text-[13px] text-[#475467]">
                      <span className="font-semibold text-[#101828]">{start}</span>
                      <span className="mx-1.5 text-[#98A2B3]">→</span>
                      <span className="font-semibold text-[#101828]">{end}</span>
                      <span className="ml-2 text-[#667085]">({duration} {duration === 1 ? 'day' : 'days'})</span>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Error */}
            {startSprintError && (
              <div className="flex items-start gap-2.5 rounded-lg border border-[#FDA29B] bg-[#FEF3F2] px-3.5 py-3">
                <span className="mt-0.5 shrink-0 text-[#D92D20]">⚠</span>
                <p className="text-[13px] text-[#B42318] leading-snug">{startSprintError}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 border-t border-[#F2F4F7] px-6 py-4">
            <button
              type="button"
              onClick={() => setShowStartSprintModal(false)}
              disabled={startingSprintLoading}
              className="rounded-lg border border-[#D0D5DD] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F9FAFB] transition-all duration-150 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmStartSprint}
              disabled={startingSprintLoading || getEffectiveDuration() <= 0}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#175CD3] to-[#2E90FA] px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm hover:from-[#1849A9] hover:to-[#1570EF] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {startingSprintLoading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Rocket size={15} />
                  Start Sprint
                </>
              )}
            </button>
          </div>
        </div>

        <style>{`
          @keyframes modalSlideIn {
            from { opacity: 0; transform: scale(0.92) translateY(12px); }
            to   { opacity: 1; transform: scale(1)   translateY(0); }
          }
        `}</style>
      </div>
    )}

    {/* ── Edit Sprint Modal ── */}
    <EditSprintModal
      open={showEditSprintModal}
      sprintName={sprint.name}
      loading={editingSprintLoading}
      onConfirm={confirmEditSprint}
      onCancel={() => setShowEditSprintModal(false)}
    />

    {/* ── Delete Sprint Confirmation ── */}
    <ConfirmModal
      open={confirmDeleteSprint}
      variant="danger"
      title="Delete Sprint"
      message={`Are you sure you want to delete "${sprint.name}"? This action cannot be undone. All tasks will be moved back to the backlog.`}
      confirmLabel="Delete Sprint"
      loading={deletingSprintLoading}
      onConfirm={doDeleteSprint}
      onCancel={() => setConfirmDeleteSprint(false)}
    />

    {/* ── Complete Sprint Confirmation ── */}
    <ConfirmModal
      open={confirmCompleteSprint}
      variant="success"
      title="Complete Sprint"
      message={`Mark "${sprint.name}" as completed? Incomplete tasks will remain in the backlog for the next sprint.`}
      confirmLabel="Complete Sprint"
      loading={completingSprintLoading}
      onConfirm={doCompleteSprint}
      onCancel={() => setConfirmCompleteSprint(false)}
    />

    {/* ── Sprint Report Modal ── */}
    <SprintReportModal
      sprint={sprint}
      isOpen={showReportModal}
      onClose={() => setShowReportModal(false)}
    />
  </>
  );
}

export default React.memo(BacklogCard);
