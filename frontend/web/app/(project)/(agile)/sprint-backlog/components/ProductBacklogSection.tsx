'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  GripVertical,
  Rocket,
} from 'lucide-react';
import { useTouchDragSort } from './useTouchDragSort';
import CreateTaskModal, { type CreateTaskData } from '@/components/shared/CreateTaskModal';
import type { TaskItem } from '@/types';
import { tasksApi, projectsApi } from '@/services/api-contract';
import { toast } from '@/components/ui';
import TaskRow from './TaskRow';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import ConfirmModal from './backlog-card/ConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';

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
  onCreateTask: (data: CreateTaskData) => Promise<void> | void;
  onDeleteTask?: (id: number) => void;
  onCreateSprint: () => void;
  onDropTask: (taskId: number, targetIndex?: number) => void;
  onAssignTask: (taskId: number, assigneeName: string, assigneePhotoUrl: string | null, assignees?: TaskItem['assignees']) => void;
  onAssignMultiple?: (taskId: number, userIds: number[], assignees?: TaskItem['assignees']) => Promise<void> | void;
  onStatusChange: (taskId: number, status: string) => void;
  onDueDateChange?: (taskId: number, dueDate: string) => Promise<void>;
  onRenameTask?: (taskId: number, title: string) => void;
  externalShowCreateModal?: boolean;
  onCloseCreateModal?: () => void;
  projectLabels?: Array<{ id: number; name: string; color?: string }>;
  onCreateLabel?: (name: string) => Promise<{ id: number; name: string; color?: string }>;
  onUpdateLabel?: (id: number, name: string, color: string) => Promise<{ id: number; name: string; color?: string }>;
  onDeleteLabel?: (id: number) => Promise<boolean>;
}



export default function ProductBacklogSection({
  tasks,
  projectId,
  projectKey,
  sprintCount: _sprintCount,
  currentUserRole,
  onToggleTask: _onToggleTask,
  onStoryPointsChange,
  onCreateTask,
  onDeleteTask,
  onCreateSprint,
  onDropTask,
  onAssignTask,
  onAssignMultiple,
  onStatusChange,
  onDueDateChange,
  onRenameTask,
  externalShowCreateModal,
  onCloseCreateModal,
  projectLabels = [],
  onCreateLabel,
  onUpdateLabel,
  onDeleteLabel,
}: ProductBacklogSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showCreateModalInternal, setShowCreateModalInternal] = useState(false);
  const taskListRef = useRef<HTMLDivElement>(null);

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
      queueMicrotask(() => setIsOpen(true));
    }
  }, [externalShowCreateModal]);

  const [taskToDeleteId, setTaskToDeleteId] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const memberRequestRef = useRef(0);
  const [labelCache, setLabelCache] = useState<Record<number, Array<{ id: number; name: string; color?: string }>>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showCreateTaskBox, setShowCreateTaskBox] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTitleLength, setNewTaskTitleLength] = useState(0);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [isDragOverSection, setIsDragOverSection] = useState(false);
  const dragEnterCounterRef = useRef(0);

  const { activeDragId, touchDropIndex, ghost, draggingTask, getTouchProps } = useTouchDragSort({
    tasks,
    containerRef: taskListRef,
    onDrop: (draggedId, targetIndex) => onDropTask(draggedId, targetIndex),
  });

  const effectiveDropIndex = activeDragId !== null ? touchDropIndex : dropIndex;

  const canDeleteTask = currentUserRole !== 'VIEWER';

  const getMemberDisplayName = (member: TeamMemberInfo) => member.user.fullName || member.user.username;

  const fetchTeamMembers = useCallback(async (showError = true) => {
    const requestId = ++memberRequestRef.current;
    try {
      setLoadingMembers(true);
      const project = await projectsApi.get(projectId);
      const teamId = project.teamId;
      if (teamId) {
        const data = await projectsApi.getTeamMembers(teamId);
        if (requestId !== memberRequestRef.current) return;
        setTeamMembers(Array.isArray(data) ? (data as TeamMemberInfo[]) : []);
      }
    } catch {
      if (showError && requestId === memberRequestRef.current) {
        toast('Failed to load team members.', 'error');
      }
    } finally {
      if (requestId === memberRequestRef.current) setLoadingMembers(false);
    }
  }, [projectId]);

  useEffect(() => {
    queueMicrotask(() => void fetchTeamMembers(false));
    return () => { memberRequestRef.current += 1; };
  }, [fetchTeamMembers]);

  const handleAssignTask = async (taskId: number, userId: number) => {
    try {
      await tasksApi.assignTaskSingle(taskId, userId);
      const member = teamMembers.find((m) => m.user.userId === userId);
      const name = member ? getMemberDisplayName(member) : 'Unassigned';
      const photo = member?.user?.profilePicUrl || null;
      const newAssignees = member ? [{
        id: member.user.userId,
        userId: member.user.userId,
        memberId: member.id,
        name,
        avatar: photo || undefined,
        photoUrl: photo,
        profilePicUrl: photo,
      }] : [];
      onAssignTask(taskId, name, photo, newAssignees);
    } catch {
      toast('Failed to assign task.', 'error');
    }
  };

  const handleAssignMultiple = async (taskId: number, userIds: number[]) => {
    const assignedMembers = teamMembers.filter((m) => userIds.includes(m.user.userId));
    const first = assignedMembers[0];
    const newAssignees = assignedMembers.map((m) => ({
      id: m.user.userId,
      userId: m.user.userId,
      memberId: m.id,
      name: getMemberDisplayName(m),
      avatar: m.user.profilePicUrl || undefined,
      photoUrl: m.user.profilePicUrl || null,
      profilePicUrl: m.user.profilePicUrl || null,
    }));

    if (onAssignMultiple) {
      await onAssignMultiple(taskId, userIds, newAssignees);
      return;
    }
    try {
      await tasksApi.assignTaskMultiple(taskId, { assigneeIds: userIds });
      onAssignTask(
        taskId,
        first ? getMemberDisplayName(first) : 'Unassigned',
        first?.user?.profilePicUrl || null,
        newAssignees
      );
    } catch {
      toast('Failed to assign task.', 'error');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (onDeleteTask) onDeleteTask(taskId);
    try {
      await tasksApi.delete(taskId);
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
        await tasksApi.update(taskId, { title: trimmed });
      } catch {
        // silent
      }
    }
  };

  const handleAddLabel = async (taskId: number, labelId: number) => {
    try {
      await tasksApi.addLabel(taskId, labelId);
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
      await tasksApi.removeLabel(taskId, labelId);
      setLabelCache((prev) => {
        const existing = prev[taskId] ?? tasks.find((t) => t.id === taskId)?.labels ?? [];
        return { ...prev, [taskId]: existing.filter((l) => l.id !== labelId) };
      });
    } catch {
      // silent
    }
  };

  const handleSectionDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragEnterCounterRef.current++;
    setIsDragOverSection(true);
  };

  const handleSectionDragLeave = () => {
    dragEnterCounterRef.current--;
    if (dragEnterCounterRef.current <= 0) {
      dragEnterCounterRef.current = 0;
      setIsDragOverSection(false);
      setDropIndex(null);
    }
  };

  const handleSectionDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSectionDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragEnterCounterRef.current = 0;
    setIsDragOverSection(false);
    setDropIndex(null);
    const taskId = Number(e.dataTransfer.getData('text/plain'));
    if (taskId) {
      onDropTask(taskId);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropIndex(null);
    const taskId = Number(e.dataTransfer.getData('text/plain'));
    if (taskId) {
      onDropTask(taskId);
    }
  };

  const handleDropAtIndex = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDropIndex(null);
    const taskId = Number(e.dataTransfer.getData('text/plain'));
    if (taskId) {
      onDropTask(taskId, index);
    }
  };

  const totals = useMemo(() => {
    const total = tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW').length;
    const done = tasks.filter(t => t.status === 'DONE').length;
    return { total, inProgress, done, count: tasks.length };
  }, [tasks]);

  return (
    <div
      className={`rounded-xl border bg-cu-bg-secondary p-4 sm:p-5 shadow-cu-sm transition-colors ${
        isDragOverSection ? 'border-cu-primary bg-cu-primary/5' : 'border-cu-border'
      }`}
      onDragEnter={handleSectionDragEnter}
      onDragLeave={handleSectionDragLeave}
      onDragOver={handleSectionDragOver}
      onDrop={handleSectionDrop}
    >
<div className="mb-3 flex min-h-10 flex-wrap items-center justify-between border-b border-cu-border pb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex-shrink-0 text-cu-text-secondary hover:text-cu-text-primary hover:bg-cu-hover p-0.5 rounded transition-colors"
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <span className="text-[14px] font-bold text-cu-text-primary truncate">Backlog</span>
          <span className="flex-shrink-0 rounded-full bg-cu-bg-tertiary px-2 py-0.5 text-[12px] font-bold text-cu-text-secondary">
            {totals.count}
          </span>
          {totals.total > 0 && (
            <span className="flex-shrink-0 rounded-full border border-cu-border bg-cu-bg px-2 py-0.5 text-[12px] font-semibold text-cu-text-primary hidden sm:inline">
              {totals.total} pts
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setIsOpen(true); setShowCreateTaskBox(true); }}
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-cu-border bg-cu-bg px-3 py-1.5 text-[12px] font-bold text-cu-text-primary hover:bg-cu-hover shadow-cu-sm transition-all active:scale-95"
          >
            <span className="text-[14px] leading-none">+</span>
            <span>Task</span>
          </button>
          <button
            onClick={() => onCreateSprint()}
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-cu-primary bg-cu-primary px-3 py-1.5 text-[12px] font-bold text-white hover:bg-cu-primary-hover shadow-cu-sm transition-all active:scale-95"
          >
            <Rocket size={14} />
            <span>Create Sprint</span>
          </button>
        </div>
      </div>

      {/* Collapsed drop zone indicator */}
      {!isOpen && isDragOverSection && (
        <div className="mt-3 rounded-lg border-2 border-dashed border-cu-primary bg-cu-primary/5 px-4 py-6 text-center text-[13px] font-medium text-cu-primary">
          Drop here to add to Backlog
        </div>
      )}

      {isOpen && (
        <div>
          <motion.div ref={taskListRef} layout className="flex flex-col gap-[5px]" onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropIndex(tasks.length); }} onDrop={handleDrop}>
            <AnimatePresence initial={false}>
              {tasks.map((task, index) => (
                <div key={task.id}>
                  {effectiveDropIndex === index && (
                    <motion.div
                      layout
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 44, opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="rounded-lg border-2 border-dashed border-cu-primary bg-cu-primary/5 mb-[5px]"
                    />
                  )}
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30, mass: 1 }}
                    className="rounded-lg overflow-hidden border border-cu-border"
                    style={{ opacity: activeDragId === task.id ? 0.25 : 1 }}
                  >
                    <div
                      data-task-row
                      draggable
                      {...getTouchProps(task.id)}
                      onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
                        e.dataTransfer.setData('text/plain', String(task.id));
                        (e.target as HTMLElement).style.opacity = '0.5';
                      }}
                      onDragEnd={(e: React.DragEvent<HTMLDivElement>) => {
                        (e.target as HTMLElement).style.opacity = '1';
                        setDropIndex(null);
                        setIsDragOverSection(false);
                        dragEnterCounterRef.current = 0;
                      }}
                      onDragOver={(e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setDropIndex(index); }}
                      onDrop={(e: React.DragEvent<HTMLDivElement>) => handleDropAtIndex(e, index)}
                    >
                      <TaskRow
                        task={{ ...task, status: task.status ?? 'TODO', labels: labelCache[task.id] ?? task.labels ?? [] }}
                        teamMembers={teamMembers}
                        loadingMembers={loadingMembers}
                        canDelete={canDeleteTask}
                        showCheckbox={false}
                        hideStatus={true}
                        onStatusChange={(id, status) => onStatusChange(id, status)}
                        onStoryPointsChange={onStoryPointsChange}
                        onRenameTask={handleRenameTask}
                        onAssignTask={handleAssignTask}
                        onAssignMultiple={handleAssignMultiple}
                        onDueDateChange={(taskId, dueDate) => { void onDueDateChange?.(taskId, dueDate); }}
                        onDeleteTask={(id) => setTaskToDeleteId(id)}
                        onOpenTask={(id) => setSelectedTaskId(id)}
                      projectLabels={projectLabels}
                      onAddLabel={handleAddLabel}
                      onRemoveLabel={handleRemoveLabel}
                      onCreateLabel={onCreateLabel}
                      onUpdateLabel={onUpdateLabel}
                      onDeleteLabel={onDeleteLabel}
                      onMoveUp={() => onDropTask(task.id, Math.max(0, index - 1))}
                      onMoveDown={() => onDropTask(task.id, Math.min(tasks.length, index + 2))}
                      projectKey={projectKey}
                    />
                  </div>
                </motion.div>
                </div>
              ))}
            </AnimatePresence>
            {effectiveDropIndex === tasks.length && tasks.length > 0 && (
              <motion.div
                layout
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 44, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="rounded-lg border-2 border-dashed border-cu-primary bg-cu-primary/5"
              />
            )}
          </motion.div>

          {/* Touch drag ghost */}
          {ghost && draggingTask && typeof document !== 'undefined' && createPortal(
            <div
              style={{ position: 'fixed', top: ghost.y, left: ghost.x, width: ghost.width, pointerEvents: 'none', zIndex: 'var(--cu-z-modal-popover)' }}
              className="flex items-center gap-2 rounded-2xl border border-[#D0D5DD] bg-white px-3 py-2.5 shadow-2xl opacity-95"
            >
              <GripVertical size={14} className="flex-shrink-0 text-[#98A2B3]" />
              <span className="flex-1 min-w-0 truncate text-[14px] font-bold text-[#101828]">{draggingTask.title}</span>
            </div>,
            document.body
          )}


           {/* ── Inline Create Task ── */}
          {showCreateTaskBox && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTaskTitle.trim()) { setShowCreateTaskBox(false); setNewTaskTitle(''); setNewTaskTitleLength(0); return; }
                void onCreateTask({ title: newTaskTitle.trim(), storyPoint: 0, priority: 'MEDIUM' });
                setNewTaskTitle('');
                setNewTaskTitleLength(0);
                setShowCreateTaskBox(false);
              }}
              className="mt-2 flex items-center gap-3 rounded-lg border-2 border-cu-primary bg-cu-bg px-3 py-1.5 transition-all duration-200"
            >
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  maxLength={255}
                  value={newTaskTitle}
                  onChange={(e) => {
                    setNewTaskTitle(e.target.value);
                    setNewTaskTitleLength(e.target.value.length);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setShowCreateTaskBox(false); setNewTaskTitle(''); setNewTaskTitleLength(0); }
                  }}
                  placeholder="Task name"
                  autoFocus
                  className="w-full bg-transparent text-[12px] font-medium text-cu-text-primary outline-none placeholder:text-cu-text-tertiary"
                />
                {newTaskTitleLength > 200 && (
                  <p className="text-xs text-amber-500 mt-1">
                    {255 - newTaskTitleLength} characters remaining
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="flex h-11 w-11 items-center justify-center shrink-0 rounded-md bg-cu-primary text-white hover:bg-cu-primary-hover disabled:opacity-50 transition-colors duration-150"
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

// ConfirmModal imported from shared module
