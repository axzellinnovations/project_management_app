import { useCallback, useState } from 'react';
import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { AxiosError } from 'axios';
import axios from '@/lib/axios';
import { toast } from '@/components/ui';
import { buildSessionCacheKey, removeSessionCache } from '@/lib/session-cache';
import {
  bulkDeleteTasks,
  bulkUpdateTaskStatus,
  completeSprint,
  moveTaskToColumn,
  reorderSprintColumns,
  patchTaskDueDate,
  assignTaskSingle,
  assignTaskMultiple,
} from '../api';
import type { SprintboardTask, SprintboardFullResponse, Sprintboard } from '../types';
import type { SprintTeamMemberOption } from '../api';

// ── Types ────────────────────────────────────────────────────────────────────

type SprintSummary = { id: number; status: string; sprintName?: string };

interface UseSprintBoardActionsArgs {
  projectIdStr: string | null;
  allBoards: SprintboardFullResponse[];
  setAllBoards: React.Dispatch<React.SetStateAction<SprintboardFullResponse[]>>;
  selectedIdx: number;
  activeSprint: SprintSummary | null;
  sprintboard: SprintboardFullResponse | null;
  board: Sprintboard | null;
  teamMembers: SprintTeamMemberOption[];
  forceRefresh: () => void;
  applyOptimisticMove: (taskId: number, toStatus: string) => void;
  rollbackMove: () => { taskId: number; fromStatus: string; toStatus: string } | null;
  selectedTaskIds: Set<number>;
  clearSelection: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSprintBoardActions({
  projectIdStr,
  setAllBoards,
  selectedIdx,
  activeSprint,
  sprintboard,
  board,
  teamMembers,
  forceRefresh,
  applyOptimisticMove,
  rollbackMove,
  selectedTaskIds,
  clearSelection,
}: UseSprintBoardActionsArgs) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [sprintIdToComplete, setSprintIdToComplete] = useState<number | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const [isBulkApplying, setIsBulkApplying] = useState(false);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !board || !sprintboard) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId.startsWith('column-') && overId.startsWith('column-')) {
      const activeColumnId = Number(activeId.replace('column-', ''));
      const overColumnId = Number(overId.replace('column-', ''));
      const fromIndex = board.columns.findIndex((column) => column.id === activeColumnId);
      const toIndex = board.columns.findIndex((column) => column.id === overColumnId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
      setAllBoards((prev) => prev.map((entry, idx) => idx !== selectedIdx ? entry : { ...entry, columns: arrayMove(entry.columns, fromIndex, toIndex) }));
      try {
        const reordered = arrayMove(board.columns, fromIndex, toIndex);
        await reorderSprintColumns(sprintboard.id, reordered.map((column, index) => ({ id: column.id, position: index })));
      } catch {
        toast('Failed to reorder columns, refreshing board', 'error');
        forceRefresh();
      }
      return;
    }
    const taskId = parseInt(String(active.id), 10);
    const newStatus = String(over.id);
    const sourceColumn = board.columns.find((column) => column.tasks.some((task) => task.taskId === taskId));
    if (!sourceColumn || sourceColumn.columnStatus === newStatus) return;
    applyOptimisticMove(taskId, newStatus);
    setAllBoards((prev) => prev.map((entry, idx) => {
      if (idx !== selectedIdx) return entry;
      const taskToMove = entry.columns.flatMap((column) => column.tasks).find((task) => task.taskId === taskId);
      if (!taskToMove) return entry;
      return {
        ...entry,
        columns: entry.columns.map((column) => {
          if (column.columnStatus === sourceColumn.columnStatus) return { ...column, tasks: column.tasks.filter((task) => task.taskId !== taskId) };
          if (column.columnStatus === newStatus) return { ...column, tasks: [...column.tasks, { ...taskToMove, status: newStatus }] };
          return column;
        }),
      };
    }));
    try {
      await moveTaskToColumn(taskId, sprintboard.id, newStatus);
      const cacheKey = buildSessionCacheKey('sprint-board-v2', [projectIdStr]);
      if (cacheKey) removeSessionCache(cacheKey);
      window.dispatchEvent(new CustomEvent('planora:task-updated'));
    } catch { forceRefresh(); }
  };

  const handleInlineCreateTask = useCallback(async (title: string, status: string) => {
    if (!projectIdStr || !activeSprint) return;
    try {
      const res = await axios.post('/api/tasks', { title, status, projectId: parseInt(projectIdStr, 10), sprintId: activeSprint.id, storyPoint: 0, priority: 'MEDIUM' });
      const newTask: SprintboardTask = {
        taskId: res.data.id, projectTaskNumber: res.data.projectTaskNumber ?? res.data.id,
        title: res.data.title, storyPoint: res.data.storyPoint ?? 0, status,
        priority: res.data.priority ?? 'MEDIUM', assigneeName: res.data.assigneeName,
        assigneePhotoUrl: res.data.assigneePhotoUrl ?? null, updatedAt: res.data.updatedAt,
        attachmentCount: 0, commentCount: 0,
      };
      setAllBoards((prev) => prev.map((entry, idx) => idx === selectedIdx
        ? { ...entry, columns: entry.columns.map((col) => col.columnStatus === status ? { ...col, tasks: [...col.tasks, newTask] } : col) }
        : entry));
      forceRefresh();
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast(axiosErr?.response?.data?.message || 'Failed to create task.', 'error');
    }
  }, [projectIdStr, activeSprint, selectedIdx, forceRefresh, setAllBoards]);

  const handleInlineDueDateChange = useCallback(async (taskId: number, dueDate: string | null) => {
    try {
      await patchTaskDueDate(taskId, dueDate);
      setAllBoards((prev) => prev.map((entry, idx) => idx !== selectedIdx ? entry : {
        ...entry, columns: entry.columns.map((column) => ({ ...column, tasks: column.tasks.map((task) => task.taskId === taskId ? { ...task, dueDate: dueDate ?? undefined } : task) })),
      }));
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast(axiosErr?.response?.data?.message || 'Failed to update due date.', 'error');
      forceRefresh();
    }
  }, [selectedIdx, forceRefresh, setAllBoards]);

  const handleInlineAssignSingle = useCallback(async (taskId: number, userId: number) => {
    try {
      await assignTaskSingle(taskId, userId);
      const selected = teamMembers.find((member) => member.userId === userId || member.id === userId);
      setAllBoards((prev) => prev.map((entry, idx) => idx !== selectedIdx ? entry : {
        ...entry, columns: entry.columns.map((column) => ({ ...column, tasks: column.tasks.map((task) => task.taskId === taskId ? { ...task, assigneeName: selected?.name, assigneePhotoUrl: selected?.photoUrl ?? undefined } : task) })),
      }));
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast(axiosErr?.response?.data?.message || 'Failed to update assignee.', 'error');
      forceRefresh();
    }
  }, [selectedIdx, teamMembers, forceRefresh, setAllBoards]);

  const handleInlineAssignMultiple = useCallback(async (taskId: number, assigneeIds: number[]) => {
    try {
      await assignTaskMultiple(taskId, assigneeIds);
      const selected = teamMembers.find((member) => assigneeIds.includes(member.userId));
      setAllBoards((prev) => prev.map((entry, idx) => idx !== selectedIdx ? entry : {
        ...entry, columns: entry.columns.map((column) => ({ ...column, tasks: column.tasks.map((task) => task.taskId === taskId ? { ...task, assigneeName: selected?.name, assigneePhotoUrl: selected?.photoUrl ?? undefined } : task) })),
      }));
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast(axiosErr?.response?.data?.message || 'Failed to update assignees.', 'error');
      forceRefresh();
    }
  }, [selectedIdx, teamMembers, forceRefresh, setAllBoards]);

  const handleCompleteSprint = async () => {
    if (!sprintIdToComplete) return;
    setIsUpdating(true);
    try {
      await completeSprint(sprintIdToComplete);
      setShowCompleteConfirm(false);
      setSuccessMsg('Sprint completed successfully!');
      setTimeout(() => setSuccessMsg(''), 1800);
      forceRefresh();
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast(axiosErr?.response?.data?.message || 'Failed to complete sprint.', 'error');
    } finally { setIsUpdating(false); }
  };

  const finalizeAddColumn = async (name: string, status: string) => {
    if (!sprintboard) return;
    setIsCreatingColumn(true);
    try {
      const { addColumn } = await import('../api');
      await addColumn(sprintboard.id, name, status);
      setSuccessMsg(`Column "${name}" added`);
      setTimeout(() => setSuccessMsg(''), 1500);
      setIsAddingColumn(false);
      setNewColumnName('');
      forceRefresh();
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast(axiosErr?.response?.data?.message || 'Failed to add column.', 'error');
    } finally { setIsCreatingColumn(false); }
  };

  const handleUndoMove = async () => {
    const snapshot = rollbackMove();
    if (!snapshot || !sprintboard) return;
    try { await moveTaskToColumn(snapshot.taskId, sprintboard.id, snapshot.fromStatus); forceRefresh(); }
    catch { toast('Failed to undo move', 'error'); forceRefresh(); }
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedTaskIds.size === 0) return;
    setIsBulkApplying(true);
    try { await bulkUpdateTaskStatus(Array.from(selectedTaskIds), status); clearSelection(); forceRefresh(); }
    catch { toast('Bulk status update failed', 'error'); }
    finally { setIsBulkApplying(false); }
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.size === 0) return;
    setIsBulkApplying(true);
    try { await bulkDeleteTasks(Array.from(selectedTaskIds)); clearSelection(); forceRefresh(); }
    catch { toast('Bulk delete failed', 'error'); }
    finally { setIsBulkApplying(false); }
  };

  return {
    isUpdating, successMsg,
    showCompleteConfirm, setShowCompleteConfirm,
    sprintIdToComplete, setSprintIdToComplete,
    isAddingColumn, setIsAddingColumn,
    newColumnName, setNewColumnName,
    isCreatingColumn, isBulkApplying,
    handleDragEnd,
    handleInlineCreateTask,
    handleInlineDueDateChange,
    handleInlineAssignSingle,
    handleInlineAssignMultiple,
    handleCompleteSprint,
    finalizeAddColumn,
    handleUndoMove,
    handleBulkStatus,
    handleBulkDelete,
  };
}
