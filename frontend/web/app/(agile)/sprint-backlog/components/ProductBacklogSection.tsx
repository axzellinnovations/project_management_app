'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  UserPlus,
  Rocket,
} from 'lucide-react';
import type { TaskItem } from '../page';
import api from '@/lib/axios';
import AssigneeAvatar from './AssigneeAvatar';
import TaskCardModal from '@/app/taskcard/TaskCardModal';

interface TeamMemberInfo {
  id: number;
  user: { userId: number; fullName: string; username: string; profilePicUrl?: string | null };
}

interface ProductBacklogSectionProps {
  tasks: TaskItem[];
  projectId: string;
  currentUserRole?: string | null;
  onToggleTask: (id: number) => void;
  onStoryPointsChange: (id: number, points: number) => void;
  onCreateTask: (title: string) => void;
  onDeleteTask?: (id: number) => void;
  onCreateSprint: (name: string) => void;
  onDropTask: (taskId: number) => void;
  onAssignTask: (taskId: number, assigneeName: string, assigneePhotoUrl: string | null) => void;
  onStatusChange: (taskId: number, status: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-[#F2F4F7] text-[#344054]',
  IN_PROGRESS: 'bg-[#EFF8FF] text-[#175CD3]',
  IN_REVIEW: 'bg-[#FFFAEB] text-[#B54708]',
  DONE: 'bg-[#ECFDF3] text-[#027A48]',
};

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

export default function ProductBacklogSection({
  tasks,
  projectId,
  currentUserRole,
  onToggleTask,
  onStoryPointsChange,
  onCreateTask,
  onDeleteTask,
  onCreateSprint,
  onDropTask,
  onAssignTask,
  onStatusChange,
}: ProductBacklogSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showCreateTaskBox, setShowCreateTaskBox] = useState(false);
  const [showCreateSprintBox, setShowCreateSprintBox] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newSprintName, setNewSprintName] = useState('');
  const [assignMenuTaskId, setAssignMenuTaskId] = useState<number | null>(null);
  const [statusMenuTaskId, setStatusMenuTaskId] = useState<number | null>(null);
  const [renamingTaskId, setRenamingTaskId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [taskToDeleteId, setTaskToDeleteId] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const canDeleteTask = currentUserRole !== 'VIEWER';

  const assignMenuRef = useRef<HTMLDivElement | null>(null);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);
  const createTaskRef = useRef<HTMLFormElement | null>(null);
  const createSprintRef = useRef<HTMLFormElement | null>(null);

  const getMemberDisplayName = (member: TeamMemberInfo) => member.user.fullName || member.user.username;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assignMenuRef.current && !assignMenuRef.current.contains(event.target as Node)) {
        setAssignMenuTaskId(null);
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setStatusMenuTaskId(null);
      }
      if (createTaskRef.current && !createTaskRef.current.contains(event.target as Node)) {
        setShowCreateTaskBox(false);
        setNewTaskName('');
      }
      if (createSprintRef.current && !createSprintRef.current.contains(event.target as Node)) {
        setShowCreateSprintBox(false);
        setNewSprintName('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        alert('Failed to load team members.');
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
      alert('Failed to assign task.');
    } finally {
      setAssignMenuTaskId(null);
    }
  };

  const handleRenameTask = async (taskId: number) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingTaskId(null);
      return;
    }
    try {
      await api.put(`/api/tasks/${taskId}`, { title: trimmed });
    } catch {
      // silent
    } finally {
      setRenamingTaskId(null);
      setRenameValue('');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      await api.delete(`/api/tasks/${taskId}`);
      if (onDeleteTask) onDeleteTask(taskId);
    } catch {
      // silent
    }
  };

  const totals = useMemo(() => {
    const total = tasks.reduce((sum, task) => sum + task.storyPoints, 0);
    return {
      total,
      middle: 0,
      done: 0,
    };
  }, [tasks]);

  const handleCreateTask = () => {
    onCreateTask(newTaskName);
    setNewTaskName('');
    setShowCreateTaskBox(false);
  };

  const handleCreateSprint = () => {
    if (!newSprintName.trim()) return;

    onCreateSprint(newSprintName);
    setNewSprintName('');
    setShowCreateSprintBox(false);
  };

  const openCreateTaskBox = () => {
    setShowCreateSprintBox(false);
    setNewSprintName('');
    setShowCreateTaskBox(true);
  };

  const openCreateSprintBox = () => {
    setShowCreateTaskBox(false);
    setNewTaskName('');
    setShowCreateSprintBox(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = Number(e.dataTransfer.getData('text/plain'));
    if (taskId) {
      onDropTask(taskId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="rounded-xl border border-[#E4E7EC] bg-[#F8F9FB] p-5 shadow-sm"
    >
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
              Backlog
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white border border-[#EAECF0] px-2 py-1 rounded-full shadow-sm">
            <div className="rounded-full bg-[#F2F4F7] px-2 py-[2px] text-[10px] font-bold text-[#344054]" title="Total">
              {totals.total} pts
            </div>
            <div className="rounded-full bg-[#EFF8FF] px-2 py-[2px] text-[10px] font-bold text-[#175CD3]" title="In Progress">
              {totals.middle}
            </div>
            <div className="rounded-full bg-[#ECFDF3] px-2 py-[2px] text-[10px] font-bold text-[#027A48]" title="Done">
              {totals.done}
            </div>
          </div>

          <button
            onClick={openCreateSprintBox}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg border border-[#175CD3] bg-[#175CD3] px-2.5 py-2 text-[13px] font-bold text-white hover:bg-[#1849A9] shadow-sm transform active:scale-95 transition-all duration-150"
          >
            <Rocket size={14} />
            Create Sprint
          </button>
        </div>
      </div>

      {isOpen && (
        <div>
          <div className="space-y-2.5">
            {tasks.map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', String(task.id))}
                onClick={() => setSelectedTaskId(task.id)}
                className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-xl border border-[#E4E7EC] bg-white px-3.5 py-3 sm:px-4 sm:py-3.5 cursor-pointer hover:border-[#175CD3]/30 hover:shadow-lg transition-all duration-200 ease-in-out ${
                  assignMenuTaskId === task.id || statusMenuTaskId === task.id ? '!overflow-visible z-50' : ''
                }`}
              >
                {/* Selection & Title Row */}
                <div className="flex items-center gap-3 min-w-0 w-full sm:flex-1 no-scrollbar" onClick={(e) => e.stopPropagation()}>
                  {/* Selection checkbox */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleTask(task.id); }}
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-200 ${
                      task.selected
                        ? 'border-[#175CD3] bg-[#175CD3] shadow-sm'
                        : 'border-[#D0D5DD] bg-white hover:border-[#175CD3]'
                    }`}
                  >
                    {task.selected && <Check size={14} className="text-white" />}
                  </button>

                  {/* Task number */}
                  <span className="text-[12px] font-bold text-[#98A2B3] tabular-nums min-w-[28px] shrink-0">
                    #{task.taskNo}
                  </span>

                  {/* Task title / Rename Input */}
                  {renamingTaskId === task.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameTask(task.id);
                        if (e.key === 'Escape') { setRenamingTaskId(null); setRenameValue(''); }
                      }}
                      onBlur={() => handleRenameTask(task.id)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="flex-1 min-w-0 border-b-2 border-[#175CD3] bg-transparent text-[13px] font-bold text-[#101828] outline-none"
                    />
                  ) : (
                    <span className="flex-1 min-w-0 truncate text-[14px] font-semibold text-[#101828]">
                      {task.title}
                    </span>
                  )}
                </div>

                {/* Metadata & Actions Row */}
                <div className="flex items-center gap-3 py-0.5">
                  {/* Status menu */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setStatusMenuTaskId(statusMenuTaskId === task.id ? null : task.id); }}
                      className={`flex h-7 min-w-[80px] items-center justify-between gap-1 rounded-lg border border-[#EAECF0] px-2 text-[10px] font-bold transition-all duration-200 ${STATUS_COLORS[task.status || 'TODO']}`}
                    >
                      <span className="truncate uppercase">{STATUS_LABELS[task.status || 'TODO']}</span>
                      <ChevronDown size={10} className="shrink-0 opacity-50" />
                    </button>
                    {statusMenuTaskId === task.id && (
                      <div ref={statusMenuRef} className="absolute right-0 top-8 z-50 w-32 overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-xl">
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <button
                            key={value}
                            onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, value); setStatusMenuTaskId(null); }}
                            className="w-full px-3 py-2 text-left text-[11px] font-bold hover:bg-[#F9FAFB]"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Story points */}
                  <input
                    type="number"
                    min="0"
                    value={task.storyPoints}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      onStoryPointsChange(task.id, Number(e.target.value))
                    }
                    className="w-10 sm:w-12 flex-shrink-0 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] px-1 py-1.5 text-center text-[12px] font-bold text-[#101828] outline-none focus:border-[#175CD3] focus:ring-2 focus:ring-[#175CD3]/20 transition-all duration-150"
                  />

                  {/* Rename - Pencil only */}
                  <button
                    type="button"
                    title="Rename"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenameValue(task.title);
                      setRenamingTaskId(task.id);
                    }}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-[#667085] hover:text-[#175CD3] transition-colors"
                  >
                    <Pencil size={13} />
                  </button>

                  <div className="relative shrink-0">
                    <button
                      type="button"
                      title={task.assigneeName || 'Assign To'}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (assignMenuTaskId === task.id) {
                          setAssignMenuTaskId(null);
                        } else {
                          setAssignMenuTaskId(task.id);
                          if (teamMembers.length === 0) {
                            void fetchTeamMembers();
                          }
                        }
                      }}
                      className="h-7 w-7 flex-shrink-0 flex items-center justify-center transition-all duration-150"
                    >
                      {task.assigneeName && task.assigneeName !== 'Unassigned' ? (
                        <AssigneeAvatar
                          name={task.assigneeName}
                          profilePicUrl={task.assigneePhotoUrl}
                          size={22}
                        />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-dashed border-[#EAECF0]">
                          <UserPlus size={12} className="text-[#667085]" />
                        </div>
                      )}
                    </button>

                    {/* Assign menu */}
                    {assignMenuTaskId === task.id && (
                      <div ref={assignMenuRef} className="absolute right-0 top-8 z-50 w-52 overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-xl">
                        <div className="px-4 py-2.5 text-[10px] font-bold text-[#667085] uppercase tracking-wider border-b border-[#F2F4F7] bg-[#F9FAFB]">
                          Assign To
                        </div>
                        {loadingMembers ? (
                          <div className="px-4 py-3 text-[12px] text-[#667085] font-medium">Loading members...</div>
                        ) : teamMembers.length > 0 ? (
                          <div className="max-h-56 overflow-y-auto index-scrollable pb-1">
                            {teamMembers.map((member) => (
                              <button
                                key={member.user.userId}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAssignTask(task.id, member.user.userId);
                                }}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-[12px] font-bold text-[#344054] hover:bg-[#F9FAFB] transition-colors duration-100"
                              >
                                <AssigneeAvatar name={getMemberDisplayName(member)} profilePicUrl={member.user.profilePicUrl} size={20} />
                                <span className="truncate">{getMemberDisplayName(member)}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="px-4 py-3 text-[12px] text-[#667085] font-medium">No members found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fixed Actions (Delete) */}
                <div className="flex shrink-0 items-center pl-2 border-l border-[#F2F4F7]" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => { e.stopPropagation(); canDeleteTask && setTaskToDeleteId(task.id); }}
                    disabled={!canDeleteTask}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center transition-colors duration-150 ${
                      canDeleteTask 
                      ? 'text-[#667085] hover:text-[#D92D20]' 
                      : 'text-[#D0D5DD] cursor-not-allowed'
                    }`}
                    title={!canDeleteTask ? "Viewers cannot delete tasks" : "Delete Task"}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

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
          onClose={() => setSelectedTaskId(null)}
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