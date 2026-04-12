'use client';

import { useKanbanData } from './hooks/useKanbanData';
import { useKanbanFilters } from './hooks/useKanbanFilters';
import { useKanbanActions } from './hooks/useKanbanActions';
import { createKanbanColumn, createProjectLabel } from './api';
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
    data.setColumnConfigs
  );

  // Add a new column (= new status) to the kanban board
  const handleAddColumn = async (name: string) => {
    if (!data.kanbanId || !name.trim()) return;
    try {
      const position = data.columnConfigs.length;
      const newCol: KanbanColumnConfig = await createKanbanColumn(data.kanbanId, name.trim(), position);
      data.setColumnConfigs((prev: KanbanColumnConfig[]) => [...prev, newCol]);
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
    handleEditTask: actions.handleEditTask,
    handleUpdateTask: actions.handleUpdateTask,
    handleInlineUpdate: actions.handleInlineUpdate,
    handleDeleteTask: actions.handleDeleteTask,
    handleCompleteBoard: actions.handleCompleteBoard,
    handleColumnRenamed: actions.handleColumnRenamed,
    handleColumnSettingsChanged: actions.handleColumnSettingsChanged,
    handleDeleteColumn: actions.handleDeleteColumn,
    handleAddColumn,
    handleCreateLabel,
  };
}
