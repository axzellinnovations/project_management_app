'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  Rocket, Trash2,
} from 'lucide-react';
import CreateTaskModal, { type CreateTaskData } from '@/components/shared/CreateTaskModal';
import type { TaskItem } from '@/types';
import api from '@/lib/axios';
import { toast } from '@/components/ui';
import TaskRow from './TaskRow';
import TaskCardModal from '@/app/taskcard/TaskCardModal';

interface TeamMemberInfo {
  id: number;
  user: { userId: number; fullName: string; username: string; profilePicUrl?: string | null };
}

interface ProductBacklogSectionProps {
  tasks: TaskItem[];
  projectId: string;
  projectKey: string;
  sprintCount: number;
  currentUserRole?: string | null;
  onToggleTask: (id: number) => void;
  onStoryPointsChange: (id: number, points: number) => void;
  onCreateTask: (data: CreateTaskData) => Promise<void>;
  onDeleteTask?: (id: number) => void;
  onCreateSprint: () => void;
  onDropTask: (taskId: number) => void;
  onAssignTask: (taskId: number, assigneeName: string, assigneePhotoUrl: string | null) => void;
  onStatusChange: (taskId: number, status: string) => void;
  onRenameTask?: (taskId: number, title: string) => void;
  externalShowCreateModal?: boolean;
  onCloseCreateModal?: () => void;
  projectLabels?: Array<{ id: number; name: string; color?: string }>;
  onCreateLabel?: (name: string) => Promise<{ id: number; name: string; color?: string }>;
}



export default function ProductBacklogSection({
  tasks,
  projectId,
  projectKey: _projectKey,
  sprintCount: _sprintCount,
  currentUserRole,
  onToggleTask: _onToggleTask,
  onStoryPointsChange,
  onCreateTask,
  onDeleteTask,
  onCreateSprint,
  onDropTask,
  onAssignTask,
  onStatusChange,
  onRenameTask,
  externalShowCreateModal,
  onCloseCreateModal,
  projectLabels = [],
  onCreateLabel,
}: ProductBacklogSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showCreateModalInternal, setShowCreateModalInternal] = useState(false);

  // Sync external modal state with internal state and expand section
  const showCreateModal = externalShowCreateModal ?? showCreateModalInternal;
  const setShowCreateModal = (val: boolean) => {
    if (onCloseCreateModal && !val) {
      onCloseCreateModal();
    } else {
      setShowCreateModalInternal(val);
    }
  };

  useEffect(() => {
    if (externalShowCreateModal) {
      setIsOpen(true);
    }
  }, [externalShowCreateModal]);

  const [taskToDeleteId, setTaskToDeleteId] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [labelCache, setLabelCache] = useState<Record<number, Array<{ id: number; name: string; color?: string }>>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showCreateTaskBox, setShowCreateTaskBox] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const canDeleteTask = currentUserRole !== 'VIEWER';

  const getMemberDisplayName = (member: TeamMemberInfo) => member.user.fullName || member.user.username;

  useEffect(() => {
    void fetchTeamMembers(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
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
        toast('Failed to load team members.', 'error');
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
        onAssignTask(taskId, getMemberDisplayName(member), member.user.profilePicUrl || null);
      }
    } catch {
      toast('Failed to assign task.', 'error');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (onDeleteTask) onDeleteTask(taskId);
    try {
      await api.delete(`/api/tasks/${taskId}`);
    } catch {
      // silent — parent state was already updated optimistically
    }
  };

  const handleRenameTask = async (taskId: number, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (onRenameTask) onRenameTask(taskId, trimmed);
    else {
      try {
        await api.put(`/api/tasks/${taskId}`, { title: trimmed });
      } catch {
        // silent
      }
    }
  };

  const handleAddLabel = async (taskId: number, labelId: number) => {
    try {
      await api.post(`/api/tasks/${taskId}/label/${labelId}`);
      const label = projectLabels.find((l) => l.id === labelId);
      if (label) {
        setLabelCache((prev) => {
          const existing = prev[taskId] ?? tasks.find((t) => t.id === taskId)?.labels ?? [];
          if (existing.some((l) => l.id === labelId)) return prev;
          return { ...prev, [taskId]: [...existing, label] };
        });
      }
    } catch {
      // silent
    }
  };

  const handleRemoveLabel = async (taskId: number, labelId: number) => {
    try {
      await api.delete(`/api/tasks/${taskId}/label/${labelId}`);
      setLabelCache((prev) => {
        const existing = prev[taskId] ?? tasks.find((t) => t.id === taskId)?.labels ?? [];
        return { ...prev, [taskId]: existing.filter((l) => l.id !== labelId) };
      });
    } catch {
      // silent
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = Number(e.dataTransfer.getData('text/plain'));
    if (taskId) {
      onDropTask(taskId);
    }
  };

  const totals = useMemo(() => {
    const total = tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW').length;
    const done = tasks.filter(t => t.status === 'DONE').length;
    return { total, inProgress, done, count: tasks.length };
  }, [tasks]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="rounded-xl border border-[#E4E7EC] bg-[#F8F9FB] p-5 shadow-sm"
    >
<div className="flex h-10 items-center border-b border-[#EAECF0] pb-3 mb-3 gap-3">
        {/* Left: collapse toggle + title + task count */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex-shrink-0 text-[#667085] hover:text-[#344054] hover:bg-[#F2F4F7] p-0.5 rounded transition-colors"
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <span className="text-[14px] font-bold text-[#101828] truncate">Backlog</span>
          <span className="flex-shrink-0 rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[12px] font-bold text-[#667085]">
            {totals.count}
          </span>
          {totals.total > 0 && (
            <span className="flex-shrink-0 rounded-full border border-[#EAECF0] bg-white px-2 py-0.5 text-[12px] font-semibold text-[#344054] hidden sm:inline">
              {totals.total} pts
            </span>
          )}
          {totals.inProgress > 0 && (
            <span className="flex-shrink-0 rounded-full bg-[#EFF8FF] px-2 py-0.5 text-[12px] font-bold text-[#175CD3] hidden sm:inline">
              {totals.inProgress} active
            </span>
          )}
          {totals.done > 0 && (
            <span className="flex-shrink-0 rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[12px] font-bold text-[#027A48] hidden sm:inline">
              {totals.done} done
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setIsOpen(true); setShowCreateTaskBox(true); }}
            className="flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-[12px] font-bold text-[#344054] hover:bg-[#F9FAFB] shadow-sm transition-all active:scale-95"
          >
            <span className="text-[14px] leading-none">+</span>
            <span>Task</span>
          </button>
          <button
            onClick={() => onCreateSprint()}
            className="flex items-center gap-1.5 rounded-lg border border-[#175CD3] bg-[#175CD3] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[#1849A9] shadow-sm transition-all active:scale-95"
          >
            <Rocket size={14} />
            <span>Create Sprint</span>
          </button>
        </div>
      </div>

      {isOpen && (
        <div>
<div className="flex flex-col gap-[5px]">
            {tasks.map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', String(task.id))}
                className="rounded-lg overflow-hidden border border-[#EAECF0]"
              >
                <TaskRow
                  task={{ ...task, status: task.status ?? 'TODO', labels: labelCache[task.id] ?? task.labels ?? [] }}
                  teamMembers={teamMembers}
                  loadingMembers={loadingMembers}
                  canDelete={canDeleteTask}
                  showCheckbox={false}
                  onStatusChange={(id, status) => onStatusChange(id, status)}
                  onStoryPointsChange={onStoryPointsChange}
                  onRenameTask={handleRenameTask}
                  onAssignTask={handleAssignTask}
                  onDeleteTask={(id) => setTaskToDeleteId(id)}
                  onOpenTask={(id) => setSelectedTaskId(id)}
                  projectLabels={projectLabels}
                  onAddLabel={handleAddLabel}
                  onRemoveLabel={handleRemoveLabel}
                  onCreateLabel={onCreateLabel}
                />
              </div>
            ))}
          </div>


           {/* ── Inline Create Task ── */}
          {showCreateTaskBox && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTaskTitle.trim()) { setShowCreateTaskBox(false); setNewTaskTitle(''); return; }
                void onCreateTask({ title: newTaskTitle.trim(), storyPoint: 0, priority: 'MEDIUM' });
                setNewTaskTitle('');
                setShowCreateTaskBox(false);
              }}
              className="mt-2 flex items-center gap-3 rounded-lg border-2 border-[#175CD3] bg-white px-3 py-1.5 transition-all duration-200"
            >
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setShowCreateTaskBox(false); setNewTaskTitle(''); }
                }}
                placeholder="Task name"
                autoFocus
                className="flex-1 min-w-0 bg-transparent text-[12px] font-medium text-[#101828] outline-none placeholder-[#98A2B3]"
              />
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="flex h-7 w-7 items-center justify-center shrink-0 rounded-md bg-[#175CD3] text-white hover:bg-[#1849A9] disabled:opacity-50 transition-colors duration-150"
                title="Create Task"
              >
                <CornerDownLeft size={14} />
              </button>
            </form>
          )}

           {/* ── Create Task Modal (header New Task button) ── */}
          <CreateTaskModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onCreateTask={onCreateTask}
            projectId={parseInt(projectId, 10)}
          />

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
        </div>
      )}

    {selectedTaskId !== null && (
      <TaskCardModal
        taskId={selectedTaskId}
        onClose={(wasModified) => {
          setSelectedTaskId(null);
          if (wasModified) {
            window.dispatchEvent(new CustomEvent('planora:task-updated'));
          }
        }}
      />
    )}
    </div>
  );
}

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

  const iconColor =
    variant === 'danger' ? 'bg-red-50 text-red-600' :
      variant === 'warning' ? 'bg-amber-50 text-amber-600' :
        'bg-emerald-50 text-emerald-600';

  const confirmBtnColor =
    variant === 'danger' ? 'bg-[#D92D20] hover:bg-[#B42318]' :
      variant === 'warning' ? 'bg-amber-600 hover:bg-amber-700' :
        'bg-emerald-600 hover:bg-emerald-700';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="mb-4 flex flex-col items-center text-center">
          <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${iconColor}`}>
            <Trash2 size={28} />
          </div>
          <h3 className="text-xl font-bold text-[#101828]">{title}</h3>
          <p className="mt-2 text-sm text-[#667085]">{message}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-sm font-bold text-[#344054] hover:bg-[#F9FAFB] transition-all disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all shadow-sm disabled:opacity-50 ${confirmBtnColor}`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}