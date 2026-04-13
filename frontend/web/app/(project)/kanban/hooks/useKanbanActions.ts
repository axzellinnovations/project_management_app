'use client';

import { useState, useCallback } from 'react';
import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Task, KanbanColumnConfig } from '../types';
import {
  updateTaskStatus,
  deleteTask,
  createTask,
  updateTask,
  reorderKanbanColumns,
} from '../api';
import { type CreateTaskData } from '@/components/shared/CreateTaskModal';

export function useKanbanActions(
  projectId: string | null,
  tasks: Task[],
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>,
  columnConfigs: KanbanColumnConfig[],
  setColumnConfigs: React.Dispatch<React.SetStateAction<KanbanColumnConfig[]>>
) {
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColumnStatus, setSelectedColumnStatus] = useState<string>('TODO');
  const [completeSuccess, setCompleteSuccess] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [selectedTaskIdForModal, setSelectedTaskIdForModal] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Task drag-and-drop
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = Number(active.id);
    const overId = String(over.id);

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const validStatuses = columnConfigs.map(c => c.status);

    // over.id could be a column status string or another card's numeric ID
    let newStatus: string;
    if (validStatuses.includes(overId)) {
      newStatus = overId;
    } else {
      // dropped onto another card — move to that card's column
      const overTask = tasks.find(t => t.id === Number(overId));
      if (!overTask) return;
      newStatus = overTask.status;
    }

    if (task.status === newStatus) return;

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    setUpdatingTaskId(taskId);

    try {
      await updateTaskStatus(taskId, newStatus, task.title);
    } catch (err) {
      console.error('Error updating task status:', err);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
    } finally {
      setUpdatingTaskId(null);
    }
  }, [tasks, columnConfigs, setTasks]);

  // Column reorder
  const handleColumnDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = columnConfigs.findIndex(c => c.status === active.id);
    const newIndex = columnConfigs.findIndex(c => c.status === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(columnConfigs, oldIndex, newIndex);
    setColumnConfigs(newOrder);

    try {
      await reorderKanbanColumns(newOrder.map((col, i) => ({ id: col.id, position: i })));
    } catch (err) {
      console.error('Error reordering columns:', err);
      setColumnConfigs(columnConfigs);
    }
  }, [columnConfigs, setColumnConfigs]);

  // Open create modal (used by mobile FAB)
  const handleOpenCreateModal = useCallback((status: string) => {
    setSelectedColumnStatus(status);
    setIsCreateModalOpen(true);
  }, []);

  // Create task via modal (takes full CreateTaskData)
  const handleCreateTask = useCallback(async (data: CreateTaskData) => {
    if (!projectId || !data.title.trim()) return;
    try {
      const newTask = await createTask({
        projectId: Number(projectId),
        title: data.title.trim(),
        status: selectedColumnStatus,
        priority: data.priority,
      } as Partial<Task> & { projectId: number; title: string; status: string });
      // Deduplicate: WebSocket may have already added this task
      setTasks(prev => prev.some(t => t.id === newTask.id) ? prev : [...prev, newTask]);
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error('Error creating task:', err);
    }
  }, [projectId, selectedColumnStatus, setTasks]);

  // Task CRUD
  const handleAddTask = useCallback(async (title: string, status: string) => {
    if (!projectId || !title.trim()) return;
    try {
      const newTask = await createTask({
        projectId: Number(projectId),
        title: title.trim(),
        status,
      } as Partial<Task> & { projectId: number; title: string; status: string });
      // Deduplicate: WebSocket may have already added this task
      setTasks(prev => prev.some(t => t.id === newTask.id) ? prev : [...prev, newTask]);
    } catch (err) {
      console.error('Error creating task:', err);
    }
  }, [projectId, setTasks]);

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  }, []);

  const handleUpdateTask = useCallback(async (taskId: number, updates: Partial<Task>) => {
    setIsUpdatingTask(true);
    try {
      const updated = await updateTask(taskId, updates);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updated } : t));
      setIsEditModalOpen(false);
      setEditingTask(null);
    } catch (err) {
      console.error('Error updating task:', err);
    } finally {
      setIsUpdatingTask(false);
    }
  }, [setTasks]);

  // Inline update — used by KanbanCard's inline edit mode (no modal)
  const handleInlineUpdate = useCallback(async (taskId: number, updates: Partial<Task>) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    try {
      await updateTask(taskId, updates);
    } catch (err) {
      console.error('Error inline updating task:', err);
      // revert on error — reload from server would be better but this is faster
    }
  }, [setTasks]);

  const handleDeleteTask = useCallback(async (taskId: number) => {
    // Optimistic removal
    const previousTasks = tasks;
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await deleteTask(taskId);
    } catch (err: unknown) {
      console.error('Error deleting task:', err);
      // Revert on failure
      setTasks(previousTasks);
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403 || status === 400) {
        setToastMessage('⚠️ Delete failed: Only project owners/admins can delete tasks.');
      } else {
        setToastMessage('⚠️ Failed to delete task. Please try again.');
      }
      setTimeout(() => setToastMessage(null), 4000);
    }
  }, [tasks, setTasks]);

  // Archive board
  const handleCompleteBoard = useCallback(async () => {
    const nonDone = tasks.filter(t => t.status !== 'DONE');
    if (nonDone.length === 0) {
      setToastMessage('All tasks are already done!');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    setCompleteSuccess(false);
    try {
      await Promise.all(nonDone.map(t => updateTaskStatus(t.id, 'DONE', t.title)));
      setTasks(prev => prev.map(t => ({ ...t, status: 'DONE' })));
      setCompleteSuccess(true);
      setToastMessage(`Archived ${nonDone.length} task${nonDone.length !== 1 ? 's' : ''} to Done.`);
      setTimeout(() => {
        setCompleteSuccess(false);
        setToastMessage(null);
      }, 4000);
    } catch (err) {
      console.error('Error archiving board:', err);
      setToastMessage('Failed to archive board. Please try again.');
      setTimeout(() => setToastMessage(null), 3000);
    }
  }, [tasks, setTasks]);

  // Column management
  const handleColumnRenamed = useCallback((columnId: number, newName: string) => {
    setColumnConfigs(prev => prev.map(c => c.id === columnId ? { ...c, title: newName } : c));
  }, [setColumnConfigs]);

  const handleColumnSettingsChanged = useCallback(
    (columnId: number, settings: { color?: string; wipLimit?: number }) => {
      setColumnConfigs(prev => prev.map(c =>
        c.id === columnId
          ? {
              ...c,
              ...(settings.color !== undefined ? { color: settings.color } : {}),
              ...(settings.wipLimit !== undefined ? { wipLimit: settings.wipLimit } : {}),
            }
          : c
      ));
    },
    [setColumnConfigs]
  );

  const handleDeleteColumn = useCallback((columnId: number) => {
    setColumnConfigs(prev => prev.filter(c => c.id !== columnId));
  }, [setColumnConfigs]);

  return {
    updatingTaskId,
    isCreateModalOpen,
    setIsCreateModalOpen,
    selectedColumnStatus,
    completeSuccess,
    toastMessage,
    isEditModalOpen,
    setIsEditModalOpen,
    editingTask,
    setEditingTask,
    isUpdatingTask,
    selectedTaskIdForModal,
    setSelectedTaskIdForModal,
    handleDragEnd,
    handleColumnDragEnd,
    handleAddTask,
    handleCreateTask,
    handleOpenCreateModal,
    handleEditTask,
    handleUpdateTask,
    handleInlineUpdate,
    handleDeleteTask,
    handleCompleteBoard,
    handleColumnRenamed,
    handleColumnSettingsChanged,
    handleDeleteColumn,
  };
}
