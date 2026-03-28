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
  onDeleteSprint: (sprintId: number) => void;
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
  status: SprintStatus;
  startDate: string;
  endDate: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  subtasks: string;
}

export default function BacklogCard({ sprint, projectId, onDropTask, onCreateTask, onDeleteTask, onDeleteSprint }: BacklogCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showSprintMenu, setShowSprintMenu] = useState(false);
  const [showCreateTaskBox, setShowCreateTaskBox] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [openTaskMenuId, setOpenTaskMenuId] = useState<number | null>(null);
  const [renamingTaskId, setRenamingTaskId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [assignMenuTaskId, setAssignMenuTaskId] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const sprintMenuRef = useRef<HTMLDivElement | null>(null);
  const taskMenuRef = useRef<HTMLDivElement | null>(null);
  const assignMenuRef = useRef<HTMLDivElement | null>(null);
  const dateInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  const [localTasks, setLocalTasks] = useState<LocalSprintTask[]>([]);

  const assigneeAvatarMap = useMemo(() => {
    const avatarMap = new Map<string, string | null>();

    teamMembers.forEach((member) => {
      const keys = [member.user.fullName, member.user.username]
        .map((value) => value?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value));

      keys.forEach((key) => avatarMap.set(key, member.user.profilePicUrl ?? null));
    });

    return avatarMap;
  }, [teamMembers]);

  const getAssigneeProfilePic = (assigneeName?: string) => {
    const normalizedName = assigneeName?.trim().toLowerCase();
    if (!normalizedName || normalizedName === 'unassigned') return null;
    return assigneeAvatarMap.get(normalizedName) ?? null;
  };

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
        taskMenuRef.current &&
        !taskMenuRef.current.contains(event.target as Node)
      ) {
        setOpenTaskMenuId(null);
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

  const handleCompleteSprint = () => {
    alert(`Complete ${sprint.name}`);
    setShowSprintMenu(false);
  };

  const handleDeleteSprint = () => {
    onDeleteSprint(sprint.id);
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

          <button
            onClick={handleCompleteSprint}
            className="rounded-lg border border-[#175CD3] bg-[#175CD3] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1849A9] transition-colors duration-150"
          >
            Complete Sprint
          </button>

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

              <button
                onClick={handleCompleteSprint}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] text-[#101828] hover:bg-[#F9FAFB]"
              >
                <Check size={18} />
                <span>Complete Sprint</span>
              </button>

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
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task.id, e.target.value as SprintStatus)}
                      className={`appearance-none rounded-full border px-3 py-1 pr-7 text-[12px] font-semibold outline-none cursor-pointer transition-colors duration-150 ${STATUS_COLORS[task.status]}`}
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current opacity-60" />
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
                        className="rounded-md p-1 hover:bg-[#EFF8FF] transition-all duration-150"
                      >
                        <AssigneeAvatar
                          name={task.assigneeName}
                          profilePicUrl={getAssigneeProfilePic(task.assigneeName)}
                          size={22}
                          fallbackClassName="bg-[#F2F4F7]"
                        />
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

                  {/* Assignee badge - always visible */}
                  <div className="flex-shrink-0 flex items-center gap-1.5 rounded-full bg-[#F2F4F7] px-2 py-1 text-[11px] font-medium text-[#475467]">
                    <AssigneeAvatar
                      name={task.assigneeName}
                      profilePicUrl={getAssigneeProfilePic(task.assigneeName)}
                      size={16}
                      fallbackClassName="bg-transparent"
                    />
                    <span className="max-w-[80px] truncate">{task.assigneeName || 'Unassigned'}</span>
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
  </>
  );
}