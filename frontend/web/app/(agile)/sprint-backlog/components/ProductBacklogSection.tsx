'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  UserPlus,
  Rocket,
  CornerDownLeft,
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
  onToggleTask: (id: number) => void;
  onStoryPointsChange: (id: number, points: number) => void;
  onCreateTask: (title: string) => void;
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
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

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
            <span className="text-[13px] text-[#667085] bg-white px-2 py-0.5 rounded-full border border-[#EAECF0]">
              {tasks.length} items
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
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg border border-[#175CD3] bg-[#175CD3] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#1849A9] shadow-sm transform active:scale-95 transition-all duration-150"
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
                className="group relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-xl border border-[#E4E7EC] bg-white px-3.5 py-3 sm:px-4 sm:py-3.5 cursor-pointer hover:border-[#175CD3]/30 hover:shadow-lg transition-all duration-200 ease-in-out"
              >
                {/* Selection & Title Row */}
                <div className="flex items-center gap-3 min-w-0 w-full sm:flex-1">
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
                  <span className="text-[12px] font-bold text-[#98A2B3] tabular-nums min-w-[28px]">
                    #{task.taskNo}
                  </span>

                  {/* Task title */}
                  <span className="flex-1 min-w-0 truncate text-[14px] font-semibold text-[#101828]">
                    {task.title}
                  </span>
                </div>

                {/* Metadata & Actions Row */}
                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto border-t border-[#F2F4F7] pt-2 sm:border-0 sm:pt-0">
                  <div className="flex items-center gap-2">
                    {/* Status menu */}
                    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setStatusMenuTaskId(statusMenuTaskId === task.id ? null : task.id)}
                        className={`flex w-[100px] sm:w-[110px] items-center justify-between gap-1.5 rounded-lg border border-[#EAECF0] px-2.5 py-1.5 text-[11px] font-bold transition-all duration-200 hover:border-[#175CD3]/30 hover:shadow-sm ${STATUS_COLORS[task.status || 'TODO']}`}
                      >
                        <span className="truncate">{STATUS_LABELS[task.status || 'TODO']}</span>
                        <ChevronDown size={11} className="opacity-50" />
                      </button>

                      {statusMenuTaskId === task.id && (
                        <div ref={statusMenuRef} className="absolute left-0 sm:right-0 sm:left-auto top-9 z-50 w-36 overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <button
                              key={value}
                              onClick={() => {
                                onStatusChange(task.id, value);
                                setStatusMenuTaskId(null);
                              }}
                              className={`flex w-full items-center px-4 py-2.5 text-left text-[12px] font-bold transition-colors duration-100 hover:bg-[#F9FAFB] ${
                                task.status === value ? 'text-[#175CD3] bg-[#EFF8FF]' : 'text-[#344054]'
                              }`}
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
                  </div>

                  {/* Actions & Assignee */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        type="button"
                        title="Rename"
                        className="rounded-lg p-1.5 text-[#667085] hover:text-[#175CD3] hover:bg-[#EFF8FF] transition-all duration-150"
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
                          className="rounded-lg transition-all duration-150 p-0.5 hover:bg-[#F2F4F7]"
                        >
                          {task.assigneeName && task.assigneeName !== 'Unassigned' ? (
                            <AssigneeAvatar
                              name={task.assigneeName}
                              profilePicUrl={task.assigneePhotoUrl}
                              size={24}
                            />
                          ) : (
                            <div className="rounded-lg p-1.5 text-[#667085] hover:text-[#175CD3] hover:bg-[#EFF8FF]">
                               <UserPlus size={16} />
                            </div>
                          )}
                        </button>

                        {assignMenuTaskId === task.id && (
                          <div ref={assignMenuRef} className="absolute right-0 top-10 z-50 w-52 overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="px-4 py-2.5 text-[10px] font-bold text-[#667085] uppercase tracking-wider border-b border-[#F2F4F7]">
                              Assign To
                            </div>
                            {loadingMembers ? (
                              <div className="px-4 py-3 text-[12px] text-[#667085] font-medium">Loading members...</div>
                            ) : teamMembers.length > 0 ? (
                              <div className="max-h-56 overflow-y-auto">
                                {teamMembers.map((member) => (
                                  <button
                                    key={member.user.userId}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAssignTask(task.id, member.user.userId);
                                    }}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] font-bold text-[#344054] hover:bg-[#F9FAFB] transition-colors duration-100"
                                  >
                                    <AssigneeAvatar
                                      name={getMemberDisplayName(member)}
                                      profilePicUrl={member.user.profilePicUrl}
                                      size={20}
                                    />
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

                    {/* Final Assignee badge */}
                    <div 
                      className="flex-shrink-0 flex items-center justify-center min-w-[32px] ml-1"
                      title={task.assigneeName || 'Unassigned'}
                    >
                      {task.assigneeName && task.assigneeName !== 'Unassigned' ? (
                        <div className="relative group/avatar">
                          <AssigneeAvatar
                            name={task.assigneeName}
                            profilePicUrl={task.assigneePhotoUrl}
                            size={26}
                            className="border border-white ring-2 ring-[#F2F4F7] shadow-sm"
                          />
                        </div>
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F9FAFB] border-2 border-dashed border-[#EAECF0] transition-colors duration-200 hover:border-[#175CD3]/40" title="Unassigned">
                          <span className="text-[10px] font-bold text-[#98A2B3]">?</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {showCreateSprintBox && (
            <form 
              ref={createSprintRef}
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateSprint();
              }}
              className="mt-2 group relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-xl border-2 border-[#175CD3] bg-white px-4 py-3 sm:py-2 transition-all duration-200 shadow-md"
            >
              <div className="flex items-center gap-3 flex-1">
                <Rocket size={18} className="text-[#98A2B3] opacity-60 flex-shrink-0" />
                <input
                  type="text"
                  value={newSprintName}
                  onChange={(e) => setNewSprintName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setShowCreateSprintBox(false); setNewSprintName(''); }
                  }}
                  placeholder="What is the sprint goal / name?"
                  autoFocus
                  className="flex-1 min-w-0 bg-transparent text-[14px] font-bold text-[#101828] outline-none placeholder-[#98A2B3]"
                />
              </div>

              <button
                type="submit"
                disabled={!newSprintName.trim()}
                className="flex items-center justify-center gap-1.5 flex-shrink-0 rounded-lg bg-[#175CD3] px-4 py-2 text-sm font-bold text-white hover:bg-[#1849A9] disabled:opacity-50 transition-all duration-150 shadow-sm"
              >
                Create Sprint
                <CornerDownLeft size={16} />
              </button>
            </form>
          )}

          {!showCreateTaskBox ? (
            <div className="mt-3 flex justify-start gap-3">
              <button
                onClick={openCreateTaskBox}
                className="flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-4 py-2 text-[13px] font-bold text-[#344054] shadow-sm hover:bg-[#F9FAFB] transform active:scale-95 transition-all duration-150"
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
                handleCreateTask();
              }}
              className="mt-2 group relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-xl border-2 border-[#175CD3] bg-white px-4 py-3 sm:py-2 transition-all duration-200 shadow-md"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="h-5 w-5 flex-shrink-0 rounded border-2 border-[#D0D5DD] opacity-50" />
                <ChevronDown size={18} className="text-[#98A2B3] opacity-60" />
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setShowCreateTaskBox(false); setNewTaskName(''); }
                  }}
                  placeholder="Task name"
                  autoFocus
                  className="flex-1 min-w-0 bg-transparent text-[14px] font-bold text-[#101828] outline-none placeholder-[#98A2B3]"
                />
              </div>

              <button
                type="submit"
                disabled={!newTaskName.trim()}
                className="flex items-center justify-center gap-1.5 flex-shrink-0 rounded-lg bg-[#175CD3] px-4 py-2 text-sm font-bold text-white hover:bg-[#1849A9] disabled:opacity-50 transition-all duration-150 shadow-sm"
              >
                Create Task
                <CornerDownLeft size={16} />
              </button>
            </form>
          )}
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