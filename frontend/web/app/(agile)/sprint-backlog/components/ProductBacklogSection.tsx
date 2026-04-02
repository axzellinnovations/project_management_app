'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  UserPlus,
} from 'lucide-react';
import type { TaskItem } from '../page';
import api from '@/lib/axios';
import AssigneeAvatar from './AssigneeAvatar';

interface TeamMemberInfo {
  id: number;
  user: { userId: number; fullName: string; username: string; profilePicUrl?: string | null };
}

interface ProductBacklogSectionProps {
  tasks: TaskItem[];
  projectId: string;
  onToggleTask: (id: number) => void;
  onStoryPointsChange: (id: number, points: number) => void;
  onCreateTask: (title: string) => void;
  onCreateSprint: (name: string) => void;
  onDropTask: (taskId: number) => void;
  onAssignTask: (taskId: number, assigneeName: string) => void;
  onStatusChange: (taskId: number, status: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-[#F2F4F7] text-[#344054]',
  IN_PROGRESS: 'bg-[#EFF8FF] text-[#175CD3]',
  DONE: 'bg-[#ECFDF3] text-[#027A48]',
};

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

export default function ProductBacklogSection({
  tasks,
  projectId,
  onToggleTask,
  onStoryPointsChange,
  onCreateTask,
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
  const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const assignMenuRef = useRef<HTMLDivElement | null>(null);

  const getMemberDisplayName = (member: TeamMemberInfo) => member.user.fullName || member.user.username;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assignMenuRef.current && !assignMenuRef.current.contains(event.target as Node)) {
        setAssignMenuTaskId(null);
      }
      setStatusMenuTaskId(prev => prev !== null ? null : prev);
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
        onAssignTask(taskId, getMemberDisplayName(member));
      }
    } catch {
      alert('Failed to assign task.');
    } finally {
      setAssignMenuTaskId(null);
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
              Backlog
            </span>
            <span className="text-[14px] text-[#667085]">
              ({tasks.length} work items)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="rounded-full bg-[#F2F4F7] px-2.5 py-[2px] text-[11px] font-semibold text-[#344054]" title="Total">
              {totals.total}
            </div>
            <div className="rounded-full bg-[#EFF8FF] px-2.5 py-[2px] text-[11px] font-semibold text-[#175CD3]" title="In Progress">
              {totals.middle}
            </div>
            <div className="rounded-full bg-[#ECFDF3] px-2.5 py-[2px] text-[11px] font-semibold text-[#027A48]" title="Done">
              {totals.done}
            </div>
          </div>

          <button
            onClick={() => setShowCreateSprintBox(true)}
            className="rounded-lg border border-[#175CD3] bg-[#175CD3] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1849A9] transition-colors duration-150"
          >
            Create Sprint
          </button>

          
        </div>
      </div>

      {isOpen && (
        <div>
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', String(task.id))}
                className="group relative flex items-center gap-4 rounded-lg border border-[#E4E7EC] bg-white px-4 py-3 cursor-grab hover:border-[#175CD3]/30 hover:shadow-md transition-all duration-200 ease-in-out"
              >
                {/* Selection checkbox */}
                <button
                  type="button"
                  onClick={() => onToggleTask(task.id)}
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border-2 transition-colors duration-150 ${
                    task.selected
                      ? 'border-[#175CD3] bg-[#175CD3]'
                      : 'border-[#175CD3] bg-[#EFF8FF]'
                  }`}
                >
                  {task.selected && <Check size={14} className="text-white" />}
                </button>

                {/* Task number */}
                <span className="text-[13px] font-semibold text-[#667085] tabular-nums min-w-[24px]">
                  {task.taskNo}
                </span>

                {/* Task title */}
                <span className="flex-1 min-w-0 truncate text-[14px] font-medium text-[#101828]">
                  {task.title}
                </span>

                {/* Story points */}
                <input
                  type="number"
                  min="0"
                  value={task.storyPoints}
                  onChange={(e) =>
                    onStoryPointsChange(task.id, Number(e.target.value))
                  }
                  className="w-12 flex-shrink-0 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] px-1 py-1.5 text-center text-[13px] font-bold text-[#101828] outline-none focus:border-[#175CD3] focus:ring-2 focus:ring-[#175CD3]/20 transition-all duration-150"
                />

                <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setStatusMenuTaskId(statusMenuTaskId === task.id ? null : task.id)}
                    className={`flex w-[110px] items-center justify-between gap-1.5 rounded-lg border border-[#EAECF0] px-3 py-1.5 text-[12px] font-semibold transition-all duration-200 hover:border-[#175CD3]/30 hover:shadow-sm ${STATUS_COLORS[task.status || 'TODO']}`}
                  >
                    <span>{STATUS_LABELS[task.status || 'TODO']}</span>
                    <ChevronDown size={12} className="opacity-50" />
                  </button>

                  {statusMenuTaskId === task.id && (
                    <div className="absolute left-0 top-9 z-50 w-36 overflow-hidden rounded-lg border border-[#E4E7EC] bg-white shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <button
                          key={value}
                          onClick={() => {
                            onStatusChange(task.id, value);
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

                {/* Action icons - appears on hover */}
                <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                   {/* Rename/Edit (Placeholder for now) */}
                   <button
                    type="button"
                    title="Rename"
                    className="rounded-md p-1.5 text-[#667085] hover:text-[#175CD3] hover:bg-[#EFF8FF] transition-all duration-150"
                  >
                    <Pencil size={15} />
                  </button>

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
                          <div className="max-h-48 overflow-y-auto font-sans">
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
                </div>

                {/* Assignee badge - Always visible at end of row */}
                <div 
                  className="flex-shrink-0 flex items-center justify-center min-w-[32px]"
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
            ))}
          </div>

          {showCreateSprintBox && (
            <div className="mt-4 rounded-lg border border-[#D0D5DD] bg-white p-4">
              <h3 className="mb-3 text-[15px] font-semibold text-[#101828]">
                Create Sprint
              </h3>

              <input
                type="text"
                value={newSprintName}
                onChange={(e) => setNewSprintName(e.target.value)}
                placeholder="Enter sprint name"
                className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm text-[#101828] outline-none"
              />

              <p className="mt-2 text-[12px] text-[#667085]">
                Selected tasks will move into the new sprint.
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleCreateSprint}
                  className="rounded-md bg-[#175CD3] px-4 py-2 text-sm font-medium text-white hover:bg-[#1849A9] disabled:opacity-50"
                  disabled={!newSprintName.trim()}
                >
                  Create Sprint
                </button>

                <button
                  onClick={() => {
                    setShowCreateSprintBox(false);
                    setNewSprintName('');
                  }}
                  className="rounded-md border border-[#D0D5DD] bg-white px-4 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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
              <h3 className="mb-3 text-[15px] font-semibold text-[#101828]">
                Create Task
              </h3>

              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="Enter task name"
                className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm text-[#101828] outline-none"
              />

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleCreateTask}
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
  );
}