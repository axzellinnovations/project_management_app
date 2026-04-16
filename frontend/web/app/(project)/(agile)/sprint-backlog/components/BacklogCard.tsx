'use client';

import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown, CornerDownLeft } from 'lucide-react';
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
import { useBacklogCardHandlers, type LocalSprintTask } from './backlog-card/useBacklogCardHandlers';

// ── Props ────────────────────────────────────────────────────────────────────

interface BacklogCardProps {
  sprint: SprintItem;
  projectId: string;
  projectKey?: string;
  currentUserRole?: string | null;
  onDropTask: (taskId: number, sprintId: number, targetIndex?: number) => void;
  onCreateTask: (title: string, sprintId: number) => void;
  onDeleteTask: (taskId: number, sprintId: number) => void;
  onToggleTask: (taskId: number) => void;
  onSprintDeleted: (sprintId: number, tasks: TaskItem[]) => void;
  onStatusChange?: (taskId: number, status: string) => void;
  onStoryPointsChange?: (taskId: number, points: number) => void;
  onAssignTask?: (taskId: number, name: string, photo: string | null) => void;
  onRenameTask?: (taskId: number, title: string) => void;
  onDueDateChange?: (taskId: number, dueDate: string) => Promise<void>;
  projectLabels?: Array<{ id: number; name: string; color?: string }>;
  onCreateLabel?: (name: string) => Promise<{ id: number; name: string; color?: string }>;
  extraStatuses?: Array<{ value: string; label: string }>;
}

type SprintStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

import { motion, AnimatePresence } from 'framer-motion';

// ── Component ────────────────────────────────────────────────────────────────

function BacklogCard({ sprint, projectId, projectKey, currentUserRole, onDropTask, onCreateTask, onDeleteTask, onToggleTask, onSprintDeleted, onStatusChange, onStoryPointsChange, onAssignTask, onRenameTask, onDueDateChange, projectLabels = [], onCreateLabel, extraStatuses = [] }: BacklogCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showCreateTaskBox, setShowCreateTaskBox] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const createTaskRef = useRef<HTMLFormElement | null>(null);

  const canDeleteSprint = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';
  const canDeleteTask = currentUserRole !== 'VIEWER';

  // ── All state & handlers from extracted hook ───────────────────────────────
  const handlers = useBacklogCardHandlers({
    sprint,
    projectId,
    onSprintDeleted,
    onStatusChange,
    onStoryPointsChange,
    onAssignTask,
    onRenameTask,
    onDueDateChange,
    projectLabels,
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

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
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
    <div className="rounded-xl border border-[#E4E7EC] bg-[#F8F9FB] p-5 shadow-sm">
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
        onCompleteSprint={() => handlers.setConfirmCompleteSprint(true)}
        onDeleteSprint={() => handlers.setConfirmDeleteSprint(true)}
        onViewReport={() => handlers.setShowReportModal(true)}
        onNameSave={handlers.handleNameSave}
        editingSprintLoading={handlers.editingSprintLoading}
      />

      {/* Sprint Goal */}
      {isOpen && (
        <SprintGoalEditor
          goalText={handlers.goalText}
          editingGoal={handlers.editingGoal}
          savingGoal={handlers.savingGoal}
          sprintGoal={sprint.goal ?? ''}
          onGoalTextChange={handlers.setGoalText}
          onStartEditing={() => handlers.setEditingGoal(true)}
          onSave={handlers.saveGoal}
          onCancel={() => { handlers.setEditingGoal(false); handlers.setGoalText(sprint.goal ?? ''); }}
        />
      )}

      {/* Task List */}
      {isOpen && (
        <div onDragOver={(e) => { e.preventDefault(); setDropIndex(handlers.localTasks.length); }} onDrop={handleDrop}>
          <motion.div layout className="flex flex-col gap-[5px]">
            <AnimatePresence initial={false}>
              {handlers.localTasks.length > 0 ? (
                handlers.localTasks.map((task, index) => (
                  <React.Fragment key={task.id}>
                    {dropIndex === index && (
                      <motion.div
                        layout
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 44, opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="rounded-lg border-2 border-dashed border-[#155DFC] bg-[#155DFC]/5"
                      />
                    )}
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30, mass: 1 }}
                      draggable
                      onDragStart={(e: any) => {
                        e.dataTransfer.setData('text/plain', String(task.id));
                        (e.target as HTMLElement).style.opacity = '0.5';
                      }}
                      onDragEnd={(e: any) => {
                        (e.target as HTMLElement).style.opacity = '1';
                        setDropIndex(null);
                      }}
                      onDragOver={(e: any) => { 
                        e.preventDefault(); 
                        setDropIndex(index); 
                      }}
                      onDrop={(e: any) => handleRowDrop(e, index)}
                      className="rounded-lg overflow-hidden border border-[#EAECF0]"
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
                        onDueDateChange={handlers.handleDueDateChange}
                        onDeleteTask={(id) => handlers.setTaskToDeleteId(id)}
                        onOpenTask={(id) => handlers.setSelectedTaskId(id)}
                        projectLabels={projectLabels}
                        onAddLabel={handlers.handleAddLabel}
                        onRemoveLabel={handlers.handleRemoveLabel}
                        onCreateLabel={onCreateLabel}
                        extraStatuses={extraStatuses}
                        onMoveUp={() => onDropTask(task.id, sprint.id, Math.max(0, index - 1))}
                        onMoveDown={() => onDropTask(task.id, sprint.id, Math.min(handlers.localTasks.length, index + 2))}
                        projectKey={projectKey}
                      />
                    </motion.div>
                  </React.Fragment>
                ))
              ) : (
                <motion.div 
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-lg border-2 border-dashed border-[#D0D5DD] bg-[#F9FAFB] px-4 py-10 text-center text-[13px] text-[#667085]"
                >
                  Drag tasks here from Product Backlog
                </motion.div>
              )}
            </AnimatePresence>
            {dropIndex === handlers.localTasks.length && handlers.localTasks.length > 0 && (
              <motion.div
                layout
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 44, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="rounded-lg border-2 border-dashed border-[#155DFC] bg-[#155DFC]/5"
              />
            )}
          </motion.div>

          {/* Create Task Inline */}
          {!showCreateTaskBox ? (
            <div className="mt-2 flex justify-start">
              <button
                onClick={() => setShowCreateTaskBox(true)}
                className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#344054] shadow-sm hover:bg-[#F9FAFB] transition-colors duration-150"
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
                className="flex-1 min-w-0 bg-transparent text-[12px] font-medium text-[#101828] outline-none placeholder-[#98A2B3]"
              />
              
              <button
                type="submit"
                disabled={!newTaskName.trim()}
                className="flex h-11 w-11 items-center justify-center shrink-0 rounded-md bg-[#175CD3] text-white hover:bg-[#1849A9] disabled:opacity-50 transition-colors duration-150"
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
      onConfirm={handlers.confirmEditSprint}
      onCancel={() => handlers.setShowEditSprintModal(false)}
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

    {/* ── Complete Sprint Confirmation ── */}
    <ConfirmModal
      open={handlers.confirmCompleteSprint}
      variant="success"
      title="Complete Sprint"
      message={`Mark "${sprint.name}" as completed?`}
      confirmLabel="Complete Sprint"
      loading={handlers.completingSprintLoading}
      onConfirm={handlers.doCompleteSprint}
      onCancel={() => handlers.setConfirmCompleteSprint(false)}
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
