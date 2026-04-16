'use client';

import { useState, useMemo, useCallback } from 'react';
import { Task, KanbanColumn as KanbanColumnType, KanbanColumnConfig, DateFilter } from '../types';

export function useKanbanFilters(
  tasks: Task[],
  columnConfigs: KanbanColumnConfig[]
) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [filterLabel, setFilterLabel] = useState<number | null>(null);
  const [filterDateRange, setFilterDateRange] = useState<DateFilter>({ startDate: null, endDate: null });

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(lower));
    }

    if (filterPriority.length > 0) {
      result = result.filter(t => t.priority && filterPriority.includes(t.priority));
    }

    if (filterAssignee) {
      result = result.filter(t => t.assigneeName === filterAssignee);
    }

    if (filterLabel !== null) {
      result = result.filter(t =>
        t.labelId === filterLabel || t.labels?.some(l => l.id === filterLabel)
      );
    }

    if (filterDateRange.startDate || filterDateRange.endDate) {
      result = result.filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        if (filterDateRange.startDate && due < filterDateRange.startDate) return false;
        if (filterDateRange.endDate && due > filterDateRange.endDate) return false;
        return true;
      });
    }

    return result;
  }, [tasks, searchTerm, filterPriority, filterAssignee, filterLabel, filterDateRange]);

  const columns = useMemo<KanbanColumnType[]>(() => {
    return columnConfigs.map(cfg => {
      // Deduplicate: ensure no two tasks share the same id within a column
      const columnTasks = filteredTasks.filter(t => t.status === cfg.status);
      const seen = new Set<number>();
      const uniqueTasks = columnTasks.filter(t => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
      return {
        status: cfg.status,
        title: cfg.title,
        tasks: uniqueTasks,
      };
    });
  }, [columnConfigs, filteredTasks]);

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    filterPriority.length > 0 ||
    filterAssignee !== '' ||
    filterLabel !== null ||
    filterDateRange.startDate !== null ||
    filterDateRange.endDate !== null;

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterPriority([]);
    setFilterAssignee('');
    setFilterLabel(null);
    setFilterDateRange({ startDate: null, endDate: null });
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    filterPriority,
    setFilterPriority,
    filterAssignee,
    setFilterAssignee,
    filterLabel,
    setFilterLabel,
    filterDateRange,
    setFilterDateRange,
    clearFilters,
    hasActiveFilters,
    filteredTasks,
    columns,
  };
}
