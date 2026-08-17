'use client';

import { useKanbanData } from './hooks/useKanbanData';
import { useKanbanFilters } from './hooks/useKanbanFilters';
import { useKanbanActions } from './hooks/useKanbanActions';
import { createKanbanColumn, createProjectLabel, updateProjectLabel, deleteProjectLabel } from './api';
import { Label, KanbanColumnConfig } from './types';

export { DEFAULT_COLUMN_CONFIGS } from './hooks/useKanbanData';

export function useKanbanBoard(projectId: string | null) {
  const data = useKanbanData(projectId);
  const filters = useKanbanFilters(data.tasks, data.columnConfigs);
  const actions = useKanbanActions(
    projectId,
    data.tasks,
    data.setTasks,
    data.columnConfigs,
    data.setColumnConfigs,
    data.forceRefresh,
    // Local task mutation helpers — passed so actions can update state
    // surgically without triggering a full board reload.
    data.upsertTask,
    data.patchTask,
    data.removeTask,
    data.syncCache,
    data.syncColumnCache,
    data.teamMembers,
  );

  // Add a new column (= new status) to the kanban board
  const handleAddColumn = async (name: string) => {
    if (!data.kanbanId || !name.trim()) return;
    try {
      const position = data.columnConfigs.length;
      const newCol: KanbanColumnConfig = await createKanbanColumn(data.kanbanId, name.trim(), position);
      data.setColumnConfigs((prev: KanbanColumnConfig[]) => {
        const next = [...prev, newCol];
        data.syncColumnCache(next);
        return next;
      });
    } catch (err) {
      console.error('Error creating column:', err);
    }
  };

  // Create a new label for the project
  const handleCreateLabel = async (name: string, color: string) => {
    if (!projectId || !name.trim()) return null;
    try {
      const label = await createProjectLabel(Number(projectId), name.trim(), color);
      data.setLabels((prev: Label[]) => [...prev, label]);
      return label;
    } catch (err) {
      console.error('Error creating label:', err);
      return null;
    }
  };

  // Update an existing label
  const handleUpdateLabel = async (id: number, name: string, color: string) => {
    if (!name.trim()) return null;
    try {
      const updated = await updateProjectLabel(id, name.trim(), color);
      data.setLabels((prev: Label[]) =>
        prev.map((l) => (l.id === id ? updated : l))
      );
      data.setTasks((prev) =>
        prev.map((t) => {
          const hasLabel = t.labels?.some((l) => l.id === id) || t.labelId === id;
          if (!hasLabel) return t;
          return {
            ...t,
            labels: t.labels?.map((l) => (l.id === id ? updated : l)),
          };
        })
      );
      return updated;
    } catch (err) {
      console.error('Error updating label:', err);
      return null;
    }
  };

  // Delete an existing label
  const handleDeleteLabel = async (id: number) => {
    try {
      await deleteProjectLabel(id);
      data.setLabels((prev: Label[]) => prev.filter((l) => l.id !== id));
      data.setTasks((prev) =>
        prev.map((t) => {
          const hasLabel = t.labels?.some((l) => l.id === id) || t.labelId === id;
          if (!hasLabel) return t;
          return {
            ...t,
            labelId: t.labelId === id ? undefined : t.labelId,
            labels: t.labels?.filter((l) => l.id !== id),
          };
        })
      );
      return true;
    } catch (err) {
      console.error('Error deleting label:', err);
      return false;
    }
  };

  return {
    // Data
    tasks: data.tasks,
    filteredTasks: filters.filteredTasks,
    columns: filters.columns,
    columnConfigs: data.columnConfigs,
    setColumnConfigs: data.setColumnConfigs,
    loading: data.loading,
    error: data.error,
    usersMap: data.usersMap,
    teamMembers: data.teamMembers,
    labels: data.labels,
    kanbanId: data.kanbanId,

    // Filter state + setters
    searchTerm: filters.searchTerm,
    setSearchTerm: filters.setSearchTerm,
    filterPriority: filters.filterPriority,
    setFilterPriority: filters.setFilterPriority,
    filterAssignee: filters.filterAssignee,
    setFilterAssignee: filters.setFilterAssignee,
    filterLabel: filters.filterLabel,
    setFilterLabel: filters.setFilterLabel,
    filterDateRange: filters.filterDateRange,
    setFilterDateRange: filters.setFilterDateRange,
    clearFilters: filters.clearFilters,
    hasActiveFilters: filters.hasActiveFilters,

    // Modal / action state
    isCreateModalOpen: actions.isCreateModalOpen,
    setIsCreateModalOpen: actions.setIsCreateModalOpen,
    selectedColumnStatus: actions.selectedColumnStatus,
    selectedTaskIdForModal: actions.selectedTaskIdForModal,
    setSelectedTaskIdForModal: actions.setSelectedTaskIdForModal,
    updatingTaskId: actions.updatingTaskId,
    completeSuccess: actions.completeSuccess,
    toastMessage: actions.toastMessage,

    // Mobile
    activeMobileColumn: data.activeMobileColumn,
    setActiveMobileColumn: data.setActiveMobileColumn,

    // Handlers
    handleDragEnd: actions.handleDragEnd,
    handleColumnDragEnd: actions.handleColumnDragEnd,
    handleAddTask: actions.handleAddTask,
    handleCreateTask: actions.handleCreateTask,
    handleOpenCreateModal: actions.handleOpenCreateModal,
    handleInlineUpdate: actions.handleInlineUpdate,
    handleAssigneeChange: actions.handleAssigneeChange,
    handleDeleteTask: actions.handleDeleteTask,
    handleCompleteBoard: actions.handleCompleteBoard,
    handleColumnRenamed: actions.handleColumnRenamed,
    handleColumnSettingsChanged: actions.handleColumnSettingsChanged,
    handleDeleteColumn: actions.handleDeleteColumn,
    handleAddColumn,
    handleCreateLabel,
    handleUpdateLabel,
    handleDeleteLabel,
    forceRefresh: data.forceRefresh,
  };
}
