'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Check,
  Trash2,
  UserPlus,
  Rocket,
  X,
  Clock,
} from 'lucide-react';
import type { SprintItem } from '../page';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import api from '@/lib/axios';
import AssigneeAvatar from './AssigneeAvatar';

interface TeamMemberInfo {
  id: number;
  user: { userId: number; fullName: string; username: string; profilePicUrl?: string | null };
}

interface BacklogCardProps {
  sprint: SprintItem;
  projectId: string;
  onDropTask: (taskId: number, sprintId: number) => void;
  onCreateTask: (title: string, sprintId: number) => void;
  onDeleteTask: (taskId: number, sprintId: number) => void;
}

type SprintStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

const STATUS_LABELS: Record<SprintStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

const STATUS_COLORS: Record<SprintStatus, string> = {
  TODO: 'bg-[#F2F4F7] text-[#344054] border-[#D0D5DD]',
  IN_PROGRESS: 'bg-[#EFF8FF] text-[#175CD3] border-[#B2DDFF]',
  IN_REVIEW: 'bg-[#FFFAEB] text-[#B54708] border-[#FEDF89]',
  DONE: 'bg-[#ECFDF3] text-[#027A48] border-[#A6F4C5]',
};

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
  endDate: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  subtasks: string;
}

const DURATION_PRESETS = [
  { label: '1 Week', days: 7 },
  { label: '2 Weeks', days: 14 },
  { label: '3 Weeks', days: 21 },
  { label: '1 Month', days: 30 },
];

export default function BacklogCard({ sprint, projectId, onDropTask, onCreateTask, onDeleteTask }: BacklogCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showSprintMenu, setShowSprintMenu] = useState(false);
  const [showCreateTaskBox, setShowCreateTaskBox] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [renamingTaskId, setRenamingTaskId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [assignMenuTaskId, setAssignMenuTaskId] = useState<number | null>(null);
  const [statusMenuTaskId, setStatusMenuTaskId] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Start Sprint Modal state
  const [showStartSprintModal, setShowStartSprintModal] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(14);
  const [customDuration, setCustomDuration] = useState<string>('');
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [startingSprintLoading, setStartingSprintLoading] = useState(false);
  const [startSprintError, setStartSprintError] = useState<string>('');

  const sprintMenuRef = useRef<HTMLDivElement | null>(null);
  const assignMenuRef = useRef<HTMLDivElement | null>(null);
  const dateInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

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
          startDate: existing?.startDate ?? task.startDate ?? '',  
          endDate: existing?.endDate ?? task.dueDate ?? '',   
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
        assignMenuRef.current &&
        !assignMenuRef.current.contains(event.target as Node)
      ) {
        setAssignMenuTaskId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
      alert('Failed to update task.');
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
    const previousDate = localTasks.find((task) => task.id === taskId)?.endDate ?? '';

    updateTask(taskId, { endDate: normalizedDate });

    try {
      const response = await api.put(`/api/tasks/${taskId}`, {
        dueDate: normalizedDate || null,
      });

      const serverDueDate = response?.data?.dueDate
        ? String(response.data.dueDate).slice(0, 10)
        : '';

      updateTask(taskId, { endDate: serverDueDate });
    } catch {
      updateTask(taskId, { endDate: previousDate });
      alert('Failed to update due date.');
    }
  };

  const formatDate = (value: string) => {
    if (!value) return 'Set Date';

    const date = new Date(value);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleEditSprint = () => {
    alert(`Edit ${sprint.name}`);
    setShowSprintMenu(false);
  };

  const handleCompleteSprint = async () => {
    if (window.confirm(`Are you sure you want to complete ${sprint.name}?`)) {
      try {
        await api.put(`/api/sprints/${sprint.id}`, { status: 'COMPLETED' });
        window.location.reload();
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        alert(error.response?.data?.message || 'Failed to complete sprint.');
      }
    }
    setShowSprintMenu(false);
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
    if (window.confirm(`Are you sure you want to delete ${sprint.name}?`)) {
       // Logic for delete sprint
       api.delete(`/api/sprints/${sprint.id}`).then(() => window.location.reload());
    }
    setShowSprintMenu(false);
  };

  const handleRenameTask = async (taskId: number) => {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    try {
      await api.put(`/api/tasks/${taskId}`, { title: trimmed });
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, title: trimmed } : t))
      );
    } catch {
      alert('Failed to rename task.');
    } finally {
      setRenamingTaskId(null);
      setRenameValue('');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      await api.delete(`/api/tasks/${taskId}`);
      setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
      onDeleteTask(taskId, sprint.id);
    } catch {
      alert('Failed to delete task.');
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
        setLocalTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, assigneeName: getMemberDisplayName(member) }
              : t
          )
        );
      }
    } catch {
      alert('Failed to assign task.');
    } finally {
      setAssignMenuTaskId(null);
    }
  };

  return (
    <>
    <div className="rounded-xl border border-[#E4E7EC] bg-[#F8F9FB] p-5 shadow-sm">
      {/* Sprint Header */}
      <div className="mb-4 flex items-center justify-between border-b border-[#EAECF0] pb-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded border border-[#98A2B3] bg-transparent" />

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-[#344054]"
          >
            {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[16px] font-semibold text-[#101828]">
              {sprint.name}
            </span>
            <span className="text-[14px] text-[#667085]">
              ({localTasks.length} work items)
            </span>
          </div>
        </div>

        <div className="relative flex items-center gap-3" ref={sprintMenuRef}>
          <div className="flex items-center gap-1.5">
            <div className="rounded-full bg-[#F2F4F7] px-2.5 py-[2px] text-[11px] font-semibold text-[#344054]" title="To Do">
              {totals.todo}
            </div>
            <div className="rounded-full bg-[#EFF8FF] px-2.5 py-[2px] text-[11px] font-semibold text-[#175CD3]" title="In Progress">
              {totals.inprogress}
            </div>
            <div className="rounded-full bg-[#ECFDF3] px-2.5 py-[2px] text-[11px] font-semibold text-[#027A48]" title="Done">
              {totals.done}
            </div>
          </div>

          {sprint.status === 'NOT_STARTED' ? (
            <button
              onClick={handleStartSprint}
              className="rounded-lg border border-[#175CD3] bg-[#175CD3] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1849A9] transition-colors duration-150"
            >
              Start Sprint
            </button>
          ) : sprint.status === 'ACTIVE' ? (
            <button
              onClick={handleCompleteSprint}
              className="rounded-lg border border-[#175CD3] bg-[#175CD3] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1849A9] transition-colors duration-150"
            >
              Complete Sprint
            </button>
          ) : (
            <span className="rounded-lg border border-[#EAECF0] bg-[#F2F4F7] px-4 py-1.5 text-[13px] font-semibold text-[#667085]">
              Completed
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowSprintMenu((prev) => !prev)}
            className="text-[#344054]"
          >
            <MoreHorizontal size={20} />
          </button>

          {showSprintMenu && (
            <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-[#D0D5DD] bg-white shadow-xl">
              <button
                onClick={handleEditSprint}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] text-[#101828] hover:bg-[#F9FAFB]"
              >
                <Pencil size={18} />
                <span>Edit Sprint</span>
              </button>

              {sprint.status === 'NOT_STARTED' && (
                <button
                  onClick={handleStartSprint}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] text-[#101828] hover:bg-[#F9FAFB]"
                >
                  <Check size={18} className="text-[#027A48]" />
                  <span>Start Sprint</span>
                </button>
              )}

              {sprint.status === 'ACTIVE' && (
                <button
                  onClick={handleCompleteSprint}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] text-[#101828] hover:bg-[#F9FAFB]"
                >
                  <Check size={18} />
                  <span>Complete Sprint</span>
                </button>
              )}

              <div className="border-t border-[#EAECF0]" />

              <button
                onClick={handleDeleteSprint}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] text-[#F04438] hover:bg-[#FEF3F2]"
              >
                <Trash2 size={18} />
                <span>Delete Sprint</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {isOpen && (
        <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
          <div className="space-y-2">
            {localTasks.length > 0 ? (
              localTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(task.id));
                  }}
                  onClick={() => setSelectedTaskId(task.id)}
                  className="group relative flex items-center gap-4 rounded-lg border border-[#E4E7EC] bg-white px-4 py-3 cursor-grab hover:border-[#175CD3]/30 hover:shadow-md transition-all duration-200 ease-in-out"
                >
                  {/* Task type indicator */}
                  <div className="h-6 w-6 flex-shrink-0 rounded border-2 border-[#175CD3] bg-[#EFF8FF] transition-colors duration-150" />

                  {/* Task number */}
                  <span className="text-[13px] font-semibold text-[#667085] tabular-nums min-w-[24px]">
                    {task.taskNo}
                  </span>

                  {/* Task title / rename input */}
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
                      className="flex-1 min-w-0 rounded-md border border-[#175CD3] bg-white px-2 py-1 text-[14px] font-medium text-[#101828] outline-none ring-2 ring-[#175CD3]/20 transition-all duration-150"
                    />
                  ) : (
                    <span className="flex-1 min-w-0 truncate text-[14px] font-medium text-[#101828]">
                      {task.title}
                    </span>
                  )}

                  {/* Status dropdown */}
                  <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setStatusMenuTaskId(statusMenuTaskId === task.id ? null : task.id)}
                      className={`flex w-[110px] items-center justify-between gap-1.5 rounded-lg border border-[#EAECF0] px-3 py-1.5 text-[12px] font-semibold transition-all duration-200 hover:border-[#175CD3]/30 hover:shadow-sm ${STATUS_COLORS[task.status]}`}
                    >
                      <span>{STATUS_LABELS[task.status]}</span>
                      <ChevronDown size={12} className="opacity-50" />
                    </button>

                    {statusMenuTaskId === task.id && (
                      <div className="absolute left-0 top-9 z-50 w-36 overflow-hidden rounded-lg border border-[#E4E7EC] bg-white shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <button
                            key={value}
                            onClick={() => {
                              handleStatusChange(task.id, value as SprintStatus);
                              setStatusMenuTaskId(null);
                            }}
                            className={`flex w-full items-center px-3 py-2 text-left text-[12px] font-medium transition-colors duration-100 hover:bg-[#F9FAFB] ${
                              task.status === value ? 'text-[#175CD3] bg-[#EFF8FF]' : 'text-[#344054]'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Due date */}
                  <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => {
                        const input = dateInputRefs.current.get(task.id);
                        if (input) {
                          input.showPicker();
                        }
                      }}
                      className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] px-2.5 py-1.5 text-[12px] font-medium cursor-pointer whitespace-nowrap hover:border-[#98A2B3] transition-colors duration-150"
                    >
                      <CalendarDays size={14} className="text-[#667085]" />
                      <span className={task.endDate ? 'text-[#344054]' : 'text-[#98A2B3]'}>
                        {formatDate(task.endDate)}
                      </span>
                    </button>
                    <input
                      ref={(el) => {
                        if (el) dateInputRefs.current.set(task.id, el);
                      }}
                      type="date"
                      value={task.endDate}
                      onChange={(e) => handleDueDateChange(task.id, e.target.value)}
                      className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
                    />
                  </div>

                  {/* Story points */}
                  <input
                    type="number"
                    min="0"
                    value={task.storyPoints}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleStoryPointChange(task.id, Number(e.target.value))}
                    className="w-12 flex-shrink-0 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] px-1 py-1.5 text-center text-[13px] font-bold text-[#101828] outline-none focus:border-[#175CD3] focus:ring-2 focus:ring-[#175CD3]/20 transition-all duration-150"
                  />

                  {/* Action icons */}
                  <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" onClick={(e) => e.stopPropagation()}>
                    {/* Rename */}
                    <button
                      type="button"
                      title="Rename"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameValue(task.title);
                        setRenamingTaskId(task.id);
                      }}
                      className="rounded-md p-1.5 text-[#667085] hover:text-[#175CD3] hover:bg-[#EFF8FF] transition-all duration-150"
                    >
                      <Pencil size={15} />
                    </button>

                    {/* Assign */}
                    <div className="relative">
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
                        className="rounded-md p-1.5 text-[#667085] hover:text-[#175CD3] hover:bg-[#EFF8FF] transition-all duration-150"
                      >
                        <UserPlus size={16} />
                      </button>

                      {assignMenuTaskId === task.id && (
                        <div ref={assignMenuRef} className="absolute right-0 top-9 z-50 w-52 overflow-hidden rounded-lg border border-[#E4E7EC] bg-white shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="px-3 py-2 text-[11px] font-semibold text-[#667085] uppercase tracking-wider border-b border-[#F2F4F7]">
                            Assign To
                          </div>
                          {loadingMembers ? (
                            <div className="px-3 py-3 text-[13px] text-[#667085]">Loading...</div>
                          ) : teamMembers.length > 0 ? (
                            <div className="max-h-48 overflow-y-auto">
                              {teamMembers.map((member) => (
                                <button
                                  key={member.user.userId}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAssignTask(task.id, member.user.userId);
                                  }}
                                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-[#344054] hover:bg-[#F9FAFB] transition-colors duration-100"
                                >
                                  <AssigneeAvatar
                                    name={getMemberDisplayName(member)}
                                    profilePicUrl={member.user.profilePicUrl}
                                    size={18}
                                  />
                                  <span className="truncate">{getMemberDisplayName(member)}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="px-3 py-3 text-[13px] text-[#667085]">No members found</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Delete */}
                    <button
                      type="button"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTask(task.id);
                      }}
                      className="rounded-md p-1.5 text-[#D92D20] hover:text-[#B42318] hover:bg-[#FEF3F2] transition-all duration-150"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Assignee badge - photo only with hover name */}
                  <div 
                    className="flex-shrink-0 flex items-center justify-center"
                    title={task.assigneeName || 'Unassigned'}
                  >
                    {task.assigneeName && task.assigneeName !== 'Unassigned' ? (
                      <AssigneeAvatar
                        name={task.assigneeName}
                        profilePicUrl={task.assigneePhotoUrl}
                        size={24}
                        className="border border-white ring-2 ring-[#F2F4F7]"
                      />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F9FAFB] border border-dashed border-[#EAECF0]" title="Unassigned">
                        <span className="text-[10px] text-[#98A2B3]">?</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border-2 border-dashed border-[#D0D5DD] bg-[#F9FAFB] px-4 py-10 text-center text-[13px] text-[#667085]">
                Drag tasks here from Product Backlog
              </div>
            )}
          </div>

          {!showCreateTaskBox ? (
            <button
              onClick={() => setShowCreateTaskBox(true)}
              className="mt-3 flex items-center gap-2 text-[16px] font-medium text-[#667085] hover:text-[#344054]"
            >
              <span className="text-[28px] leading-none">+</span>
              <span>Create</span>
            </button>
          ) : (
            <div className="mt-4 rounded-lg border border-[#D0D5DD] bg-white p-4">
              <h3 className="mb-3 text-[15px] font-semibold text-[#101828]">Create Task</h3>
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (!newTaskName.trim()) return;
                    onCreateTask(newTaskName.trim(), sprint.id);
                    setNewTaskName('');
                    setShowCreateTaskBox(false);
                  }
                }}
                placeholder="Enter task name"
                autoFocus
                className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm text-[#101828] outline-none"
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!newTaskName.trim()) return;
                    onCreateTask(newTaskName.trim(), sprint.id);
                    setNewTaskName('');
                    setShowCreateTaskBox(false);
                  }}
                  className="rounded-md bg-[#175CD3] px-4 py-2 text-sm font-medium text-white hover:bg-[#1849A9]"
                >
                  Create Task
                </button>
                <button
                  onClick={() => {
                    setShowCreateTaskBox(false);
                    setNewTaskName('');
                  }}
                  className="rounded-md border border-[#D0D5DD] bg-white px-4 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
                >
                  Cancel
                </button>
              </div>
            </div>
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
  </>
  );
}