'use client';

import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, CornerDownLeft, GripVertical } from 'lucide-react';
import { useTouchDragSort } from './useTouchDragSort';
import TaskRow from './TaskRow';
import type { SprintItem, TaskItem } from '@/types';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import SprintReportModal from './SprintReportModal';

// ── Extracted sub-components ─────────────────────────────────────────────────
import ConfirmModal from './backlog-card/ConfirmModal';
import EditSprintModal from './backlog-card/EditSprintModal';
import StartSprintModal from './backlog-card/StartSprintModal';
import SprintHeader from './backlog-card/SprintHeader';
import SprintGoalEditor from './backlog-card/SprintGoalEditor';
import CompleteSprintModal from './CompleteSprintModal';
import { useBacklogCardHandlers } from './backlog-card/useBacklogCardHandlers';
import type { AvailableDestSprint } from './backlog-card/useBacklogCardHandlers';

// ── Props ────────────────────────────────────────────────────────────────────

interface BacklogCardProps {
  sprint: SprintItem;
  projectId: string;
  projectKey?: string;
  currentUserRole?: string | null;
  availableSprintsForMove?: AvailableDestSprint[];
  onDropTask: (taskId: number, sprintId: number, targetIndex?: number) => void;
  onCreateTask: (title: string, sprintId: number) => void;
  onDeleteTask: (taskId: number, sprintId: number) => void;
  onToggleTask: (taskId: number) => void;
  onSprintDeleted: (sprintId: number, tasks: TaskItem[]) => void;
  onSprintUpdated: (sprintId: number, updates: Partial<SprintItem>) => void;
  onStatusChange?: (taskId: number, status: string) => void;
  onStoryPointsChange?: (taskId: number, points: number) => void;
  onAssignTask?: (taskId: number, name: string, photo: string | null, assignees?: TaskItem['assignees']) => void;
  onAssignMultiple?: (taskId: number, userIds: number[], assignees?: TaskItem['assignees']) => Promise<void> | void;
  onRenameTask?: (taskId: number, title: string) => void;
  onDueDateChange?: (taskId: number, dueDate: string) => Promise<void>;
  projectLabels?: Array<{ id: number; name: string; color?: string }>;
  onCreateLabel?: (name: string) => Promise<{ id: number; name: string; color?: string }>;
  onUpdateLabel?: (id: number, name: string, color: string) => Promise<{ id: number; name: string; color?: string }>;
  onDeleteLabel?: (id: number) => Promise<boolean>;
  extraStatuses?: Array<{ value: string; label: string }>;
  existingSprintNames?: string[];
}

type SprintStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

import { motion, AnimatePresence } from 'framer-motion';

// ── Component ────────────────────────────────────────────────────────────────

function BacklogCard({ sprint, projectId, projectKey, currentUserRole, availableSprintsForMove = [], onDropTask, onCreateTask, onDeleteTask, onToggleTask, onSprintDeleted, onSprintUpdated, onStatusChange, onStoryPointsChange, onAssignTask, onAssignMultiple, onRenameTask, onDueDateChange, projectLabels = [], onCreateLabel, onUpdateLabel, onDeleteLabel, extraStatuses = [], existingSprintNames = [] }: BacklogCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showCreateTaskBox, setShowCreateTaskBox] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskNameLength, setNewTaskNameLength] = useState(0);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [isDragOverCard, setIsDragOverCard] = useState(false);
  const dragEnterCounterRef = useRef(0);
  const createTaskRef = useRef<HTMLFormElement | null>(null);
  const taskListRef = useRef<HTMLDivElement>(null);

  const canDeleteSprint = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';
  const canDeleteTask = currentUserRole !== 'VIEWER';

  // ── All state & handlers from extracted hook ───────────────────────────────
  const handlers = useBacklogCardHandlers({
    sprint,
    projectId,
    availableSprintsForMove,
    onSprintDeleted,
    onSprintUpdated,
    onStatusChange,
    onStoryPointsChange,
    onAssignTask,
    onAssignMultiple,
    onRenameTask,
    onDueDateChange,
    projectLabels,
    existingSprintNames,
  });

  const totals = useMemo(() => {
    return handlers.localTasks.reduce(
      (acc, task) => {
        if (task.status === 'TODO') acc.todo += task.storyPoints;
        if (task.status === 'IN_PROGRESS') acc.inprogress += task.storyPoints;
        if (task.status === 'DONE') acc.done += task.storyPoints;
        return acc;
      },
      { todo: 0, inprogress: 0, done: 0 }
    );
  }, [handlers.localTasks]);

  // ── Touch drag-and-drop ────────────────────────────────────────────────────

  const { activeDragId, touchDropIndex, ghost, draggingTask, getTouchProps } = useTouchDragSort({
    tasks: handlers.localTasks,
    containerRef: taskListRef,
    onDrop: (draggedId, targetIndex) => onDropTask(draggedId, sprint.id, targetIndex),
  });

  const effectiveDropIndex = activeDragId !== null ? touchDropIndex : dropIndex;

  // ── HTML5 Drag & Drop (desktop) ────────────────────────────────────────────

  const handleCardDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragEnterCounterRef.current++;
    setIsDragOverCard(true);
  };

  const handleCardDragLeave = () => {
    dragEnterCounterRef.current--;
    if (dragEnterCounterRef.current <= 0) {
      dragEnterCounterRef.current = 0;
      setIsDragOverCard(false);
      setDropIndex(null);
    }
  };

  const handleCardDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCardDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragEnterCounterRef.current = 0;
    setIsDragOverCard(false);
    setDropIndex(null);
    const taskId = Number(e.dataTransfer.getData('text/plain'));
    if (!taskId) return;
    onDropTask(taskId, sprint.id);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDropIndex(null);
    const taskId = Number(event.dataTransfer.getData('text/plain'));
    if (!taskId) return;
    onDropTask(taskId, sprint.id);
  };

  const handleRowDrop = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    setDropIndex(null);
    const taskId = Number(event.dataTransfer.getData('text/plain'));
    if (!taskId) return;
    onDropTask(taskId, sprint.id, index);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
    <div
      className={`rounded-xl border bg-cu-bg-secondary p-5 shadow-cu-sm transition-colors ${
        isDragOverCard ? 'border-cu-primary bg-cu-primary/5' : 'border-cu-border'
      }`}
      onDragEnter={handleCardDragEnter}
      onDragLeave={handleCardDragLeave}
      onDragOver={handleCardDragOver}
      onDrop={handleCardDrop}
    >
      {/* Sprint Header */}
      <SprintHeader
        sprintName={sprint.name}
        sprintStatus={sprint.status}
        sprintEndDate={sprint.endDate}
        isOpen={isOpen}
        totals={totals}
        canDeleteSprint={canDeleteSprint}
        onToggleOpen={() => setIsOpen(!isOpen)}
        onEditSprint={() => handlers.setShowEditSprintModal(true)}
        onStartSprint={() => {
          handlers.setShowStartSprintModal(true);
        }}
        onCompleteSprint={handlers.openCompleteSprintModal}
        onDeleteSprint={() => handlers.setConfirmDeleteSprint(true)}
        onViewReport={() => handlers.setShowReportModal(true)}
        onNameSave={handlers.handleNameSave}
        existingSprintNames={existingSprintNames}
        editingSprintLoading={handlers.editingSprintLoading}
      />

      {/* Sprint Goal */}
      {isOpen && (
        <SprintGoalEditor
          goalText={handlers.goalText}
          editingGoal={handlers.editingGoal}
          savingGoal={handlers.savingGoal}
          onGoalTextChange={handlers.setGoalText}
          onStartEditing={() => handlers.setEditingGoal(true)}
          onSave={handlers.saveGoal}
          onCancel={() => { handlers.setEditingGoal(false); handlers.setGoalText(sprint.goal ?? ''); }}
        />
      )}

      {/* Collapsed drop zone indicator */}
      {!isOpen && isDragOverCard && (
        <div className="mt-3 rounded-lg border-2 border-dashed border-cu-primary bg-cu-primary/5 px-4 py-6 text-center text-[13px] font-medium text-cu-primary">
          Drop here to add to {sprint.name}
        </div>
      )}

      {/* Task List */}
      {isOpen && (
        <div ref={taskListRef} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropIndex(handlers.localTasks.length); }} onDrop={handleDrop}>
          <motion.div layout className="flex flex-col gap-[5px]">
            <AnimatePresence initial={false}>
              {handlers.localTasks.length > 0 ? (
                handlers.localTasks.map((task, index) => (
                  <React.Fragment key={task.id}>
                    {effectiveDropIndex === index && (
                      <motion.div
                        layout
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 44, opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="rounded-lg border-2 border-dashed border-cu-primary bg-cu-primary/5"
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
                          setIsDragOverCard(false);
                          dragEnterCounterRef.current = 0;
                        }}
                        onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDropIndex(index);
                        }}
                        onDrop={(e: React.DragEvent<HTMLDivElement>) => handleRowDrop(e, index)}
                      >
                        <TaskRow
                          task={task}
                          teamMembers={handlers.teamMembers}
                          loadingMembers={handlers.loadingMembers}
                          canDelete={canDeleteTask}
                          showCheckbox
                          onToggle={onToggleTask}
                          onStatusChange={(id, status) => handlers.handleStatusChange(id, status as SprintStatus)}
                          onStoryPointsChange={handlers.handleStoryPointChange}
                          onRenameTask={handlers.handleRenameTask}
                          onAssignTask={handlers.handleAssignTask}
                          onAssignMultiple={handlers.handleAssignMultiple}
                          onDueDateChange={handlers.handleDueDateChange}
                        onDeleteTask={(id) => handlers.setTaskToDeleteId(id)}
                        onOpenTask={(id) => handlers.setSelectedTaskId(id)}
                        projectLabels={projectLabels}
                        onAddLabel={handlers.handleAddLabel}
                        onRemoveLabel={handlers.handleRemoveLabel}
                        onCreateLabel={onCreateLabel}
                        onUpdateLabel={onUpdateLabel}
                        onDeleteLabel={onDeleteLabel}
                        extraStatuses={extraStatuses}
                        onMoveUp={() => onDropTask(task.id, sprint.id, Math.max(0, index - 1))}
                        onMoveDown={() => onDropTask(task.id, sprint.id, Math.min(handlers.localTasks.length, index + 2))}
                        projectKey={projectKey}
                      />
                    </div>
                  </motion.div>
                </React.Fragment>
              ))
              ) : (
                <motion.div 
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-lg border-2 border-dashed border-cu-border bg-cu-bg-secondary px-4 py-10 text-center text-[13px] text-cu-text-secondary"
                >
                  Drag tasks here from Product Backlog
                </motion.div>
              )}
            </AnimatePresence>
            {effectiveDropIndex === handlers.localTasks.length && handlers.localTasks.length > 0 && (
              <motion.div
                layout
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 44, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="rounded-lg border-2 border-dashed border-cu-primary bg-cu-primary/5"
              />
            )}
          </motion.div>

          {/* Touch drag ghost — floats under the finger */}
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

          {/* Create Task Inline */}
          {!showCreateTaskBox ? (
            <div className="mt-2 flex justify-start">
              <button
                onClick={() => setShowCreateTaskBox(true)}
                className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-cu-border bg-cu-bg px-2.5 py-1.5 text-[12px] font-medium text-cu-text-primary shadow-cu-sm hover:bg-cu-hover transition-colors duration-150"
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
                setNewTaskNameLength(0);
                setShowCreateTaskBox(false);
              }}
              className="mt-2 group relative flex items-center gap-3 rounded-lg border-2 border-cu-primary bg-cu-bg px-3 py-1.5 transition-all duration-200"
            >
              <div className="h-5 w-5 flex-shrink-0 rounded border-2 border-cu-border opacity-50" />
              <ChevronDown size={16} className="text-cu-text-tertiary opacity-50" />

              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  maxLength={255}
                  value={newTaskName}
                  onChange={(e) => {
                    setNewTaskName(e.target.value);
                    setNewTaskNameLength(e.target.value.length);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowCreateTaskBox(false);
                      setNewTaskName('');
                      setNewTaskNameLength(0);
                    }
                  }}
                  placeholder="Task name"
                  autoFocus
                  className="w-full bg-transparent text-[12px] font-medium text-cu-text-primary outline-none placeholder:text-cu-text-tertiary"
                />
                {newTaskNameLength > 200 && (
                  <p className="text-xs text-amber-500 mt-1">
                    {255 - newTaskNameLength} characters remaining
                  </p>
                )}
              </div>
              
              <button
                type="submit"
                disabled={!newTaskName.trim()}
                className="flex h-11 w-11 items-center justify-center shrink-0 rounded-md bg-cu-primary text-white hover:bg-cu-primary-hover disabled:opacity-50 transition-colors duration-150"
                title="Create Task"
              >
                <CornerDownLeft size={14} />
              </button>
            </form>
          )}
        </div>
      )}
    </div>

    {/* ── Task Card Modal ── */}
    {handlers.selectedTaskId !== null && (
      <TaskCardModal
        taskId={handlers.selectedTaskId}
        onClose={(wasModified) => {
          handlers.setSelectedTaskId(null);
          if (wasModified) {
            window.dispatchEvent(new CustomEvent('planora:task-updated'));
          }
        }}
      />
    )}

    {/* ── Task Delete Confirmation ── */}
    <ConfirmModal
      open={handlers.taskToDeleteId !== null}
      onCancel={() => handlers.setTaskToDeleteId(null)}
      onConfirm={() => {
        if (handlers.taskToDeleteId) {
          handlers.handleDeleteTask(handlers.taskToDeleteId);
          onDeleteTask(handlers.taskToDeleteId, sprint.id);
          handlers.setTaskToDeleteId(null);
        }
      }}
      title="Delete Task"
      message="Are you sure you want to delete this task? This action cannot be undone."
      confirmLabel="Delete"
      loading={false}
      variant="danger"
    />

    {/* ── Start Sprint Modal ── */}
    <StartSprintModal
      open={handlers.showStartSprintModal}
      sprintName={sprint.name}
      loading={handlers.startingSprintLoading}
      error={handlers.startSprintError}
      onStart={handlers.confirmStartSprint}
      onCancel={() => handlers.setShowStartSprintModal(false)}
    />

    {/* ── Edit Sprint Modal ── */}
    <EditSprintModal
      open={handlers.showEditSprintModal}
      sprintName={sprint.name}
      loading={handlers.editingSprintLoading}
      error={handlers.editSprintError}
      onConfirm={handlers.confirmEditSprint}
      onCancel={() => { handlers.setShowEditSprintModal(false); handlers.setEditSprintError(''); }}
    />

    {/* ── Delete Sprint Confirmation ── */}
    <ConfirmModal
      open={handlers.confirmDeleteSprint}
      variant="danger"
      title="Delete Sprint"
      message={`Are you sure you want to delete "${sprint.name}"? This action cannot be undone. All tasks will be moved back to the backlog.`}
      confirmLabel="Delete Sprint"
      loading={handlers.deletingSprintLoading}
      onConfirm={handlers.doDeleteSprint}
      onCancel={() => handlers.setConfirmDeleteSprint(false)}
    />

    {/* ── Complete Sprint Modal ── */}
    <CompleteSprintModal
      open={handlers.confirmCompleteSprint}
      sprintName={sprint.name}
      incompleteCount={handlers.incompleteTaskCount}
      availableSprints={handlers.availableSprintsForMove}
      destination={handlers.completeDestination}
      onSelectDestination={handlers.setCompleteDestination}
      onComplete={handlers.doCompleteSprint}
      onCancel={() => handlers.setConfirmCompleteSprint(false)}
      isLoading={handlers.completingSprintLoading}
    />

    {/* ── Sprint Report Modal ── */}
    <SprintReportModal
      sprint={sprint}
      isOpen={handlers.showReportModal}
      onClose={() => handlers.setShowReportModal(false)}
    />
  </>
  );
}

export default React.memo(BacklogCard);
