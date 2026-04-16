'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { SprintBoardFilters, Sprintboard, SprintboardTask } from '../types';

export interface MoveSnapshot {
  taskId: number;
  fromStatus: string;
  toStatus: string;
  movedAt: number;
}

const DEFAULT_FILTERS: SprintBoardFilters = {
  search: '',
  priority: 'ALL',
  assignee: 'ALL',
  status: 'ALL',
  swimlane: 'none',
  showOnlyMine: false,
};

export function useSprintBoardStore() {
  const [board, setBoard] = useState<Sprintboard | null>(null);
  const [filters, setFilters] = useState<SprintBoardFilters>(DEFAULT_FILTERS);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const [lastMove, setLastMove] = useState<MoveSnapshot | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hydrate = useCallback((nextBoard: Sprintboard | null) => {
    setBoard(nextBoard);
    setSelectedTaskIds(new Set());
  }, []);

  const updateFilters = useCallback((patch: Partial<SprintBoardFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleColumnCollapsed = useCallback((status: string) => {
    setCollapsedColumns((prev) => ({ ...prev, [status]: !prev[status] }));
  }, []);

  const clearSelection = useCallback(() => setSelectedTaskIds(new Set()), []);

  const toggleTaskSelected = useCallback((taskId: number, force?: boolean) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      const shouldSelect = force ?? !next.has(taskId);
      if (shouldSelect) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  }, []);

  const selectTasksInStatus = useCallback((status: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      const tasks = board?.columns.find((column) => column.columnStatus === status)?.tasks ?? [];
      tasks.forEach((task) => next.add(task.taskId));
      return next;
    });
  }, [board]);

  const applyOptimisticMove = useCallback((taskId: number, nextStatus: string) => {
    let moved = false;
    let previousStatus = '';
    setBoard((prev) => {
      if (!prev) return prev;
      let taskToMove: SprintboardTask | null = null;
      const updatedColumns = prev.columns.map((column) => {
        const hit = column.tasks.find((task) => task.taskId === taskId);
        if (hit) {
          moved = true;
          previousStatus = column.columnStatus;
          taskToMove = { ...hit, status: nextStatus };
          return { ...column, tasks: column.tasks.filter((task) => task.taskId !== taskId) };
        }
        return column;
      }).map((column) => {
        if (column.columnStatus !== nextStatus || !taskToMove) return column;
        return { ...column, tasks: [...column.tasks, taskToMove] };
      });
      return { ...prev, columns: updatedColumns };
    });

    if (moved && previousStatus !== nextStatus) {
      setLastMove({ taskId, fromStatus: previousStatus, toStatus: nextStatus, movedAt: Date.now() });
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
      undoTimerRef.current = setTimeout(() => setLastMove(null), 6000);
    }
  }, []);

  const rollbackMove = useCallback(() => {
    if (!lastMove) return null;
    applyOptimisticMove(lastMove.taskId, lastMove.fromStatus);
    const snapshot = lastMove;
    setLastMove(null);
    return snapshot;
  }, [applyOptimisticMove, lastMove]);

  const filteredColumns = useMemo(() => {
    if (!board) return [];
    const search = filters.search.trim().toLowerCase();
    return board.columns.map((column) => {
      const tasks = column.tasks.filter((task) => {
        if (filters.status !== 'ALL' && task.status !== filters.status) return false;
        if (filters.priority !== 'ALL' && (task.priority ?? '').toUpperCase() !== filters.priority) return false;
        if (filters.assignee !== 'ALL' && (task.assigneeName ?? 'Unassigned') !== filters.assignee) return false;
        if (!search) return true;
        return (
          task.title.toLowerCase().includes(search) ||
          (task.assigneeName ?? '').toLowerCase().includes(search) ||
          (task.label?.name ?? '').toLowerCase().includes(search)
        );
      });
      return { ...column, tasks };
    });
  }, [board, filters]);

  const swimlanes = useMemo(() => {
    if (filters.swimlane === 'none') return null;
    const laneKey = filters.swimlane;
    const laneMap = new Map<string, typeof filteredColumns>();
    const seedColumns = filteredColumns.map((column) => ({ ...column, tasks: [] as SprintboardTask[] }));
    filteredColumns.forEach((column) => {
      column.tasks.forEach((task) => {
        const key = laneKey === 'assignee' ? (task.assigneeName || 'Unassigned') : (task.priority || 'MEDIUM');
        if (!laneMap.has(key)) {
          laneMap.set(key, seedColumns.map((seed) => ({ ...seed, tasks: [] })));
        }
        const laneColumns = laneMap.get(key)!;
        const target = laneColumns.find((entry) => entry.columnStatus === column.columnStatus);
        if (target) target.tasks.push(task);
      });
    });
    return Array.from(laneMap.entries()).map(([key, columns]) => ({ key, columns }));
  }, [filteredColumns, filters.swimlane]);

  const metrics = useMemo(() => {
    const allTasks = (board?.columns ?? []).flatMap((column) => column.tasks);
    const done = allTasks.filter((task) => task.status === 'DONE');
    const totalStoryPoints = allTasks.reduce((sum, task) => sum + (task.storyPoint ?? 0), 0);
    const doneStoryPoints = done.reduce((sum, task) => sum + (task.storyPoint ?? 0), 0);
    const overdue = allTasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE').length;
    return {
      totalTasks: allTasks.length,
      doneTasks: done.length,
      totalStoryPoints,
      doneStoryPoints,
      overdueTasks: overdue,
      selectedCount: selectedTaskIds.size,
    };
  }, [board, selectedTaskIds.size]);

  return {
    board,
    setBoard,
    hydrate,
    filters,
    updateFilters,
    filteredColumns,
    swimlanes,
    collapsedColumns,
    toggleColumnCollapsed,
    selectedTaskIds,
    toggleTaskSelected,
    selectTasksInStatus,
    clearSelection,
    applyOptimisticMove,
    rollbackMove,
    lastMove,
    setLastMove,
    metrics,
  };
}
