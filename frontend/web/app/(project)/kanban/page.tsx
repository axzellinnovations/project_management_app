'use client';

import React, { useCallback, useState } from 'react';
import { DragEndEvent } from '@dnd-kit/core';
import { useSearchParams } from 'next/navigation';
import DragDropProvider from './components/DragDropProvider';
import KanbanColumn from './components/KanbanColumn';
import SortableColumn from './components/SortableColumn';
import KanbanFilterBar from './components/KanbanFilterBar';
import MobileColumnSwitcher from './components/MobileColumnSwitcher';
import CreateTaskModal from './components/CreateTaskModal';
import { AlertCircle, Loader, CheckCircle2, Plus, LayoutGrid, X } from 'lucide-react';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import { useKanbanBoard } from './useKanbanBoard';

export default function KanbanPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  const {
    tasks, loading, error, columns, columnConfigs,
    searchTerm, setSearchTerm,
    filterPriority, setFilterPriority,
    filterAssignee, setFilterAssignee,
    filterLabel, setFilterLabel,
    clearFilters, hasActiveFilters,
    teamMembers, labels, kanbanId,
    isCreateModalOpen, setIsCreateModalOpen,
    selectedColumnStatus,
    completeSuccess, toastMessage,
    selectedTaskIdForModal, setSelectedTaskIdForModal,
    updatingTaskId, usersMap, activeMobileColumn, setActiveMobileColumn,
    handleDragEnd, handleColumnDragEnd, handleDeleteTask,
    handleAddTask, handleCreateTask, handleOpenCreateModal,
    handleEditTask, handleInlineUpdate, handleCompleteBoard,
    handleColumnRenamed, handleColumnSettingsChanged, handleDeleteColumn,
    handleAddColumn, handleCreateLabel,
  } = useKanbanBoard(projectId);

  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  const handleAnyDragEnd = useCallback((event: DragEndEvent) => {
    if (!isNaN(Number(event.active.id))) {
      handleDragEnd(event);
    } else {
      handleColumnDragEnd(event);
    }
  }, [handleDragEnd, handleColumnDragEnd]);

  if (!projectId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Missing Project ID</h1>
          <p className="text-gray-600">
            Please provide a project ID in the URL: <code className="bg-gray-100 px-2 py-1 rounded">/kanban?projectId=1</code>
          </p>
        </div>
      </div>
    );
  }

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'DONE').length;
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-[#F0F2F5] overflow-hidden">
      {/* Premium Header */}
      <div className="bg-white border-b border-gray-200/80 px-4 md:px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <LayoutGrid size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-bold text-gray-900 tracking-tight">Board</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-gray-500">{totalTasks} tasks</span>
                {totalTasks > 0 && (
                  <>
                    <span className="text-gray-300">·</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1 rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                      </div>
                      <span className="text-[11px] text-gray-500 font-medium">{progressPercent}%</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="hidden sm:flex items-center bg-gray-100 rounded-lg px-3 py-1.5 border border-transparent focus-within:border-blue-300 focus-within:bg-white transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent border-0 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none ml-2 w-40 md:w-52"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-gray-600">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Complete Board */}
            <button
              onClick={handleCompleteBoard}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors"
            >
              <CheckCircle2 size={14} />
              Complete All
            </button>
          </div>
        </div>

        {/* Mobile search */}
        <div className="sm:hidden mt-2">
          <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 border border-transparent focus-within:border-blue-300 focus-within:bg-white transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-0 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none ml-2 flex-1"
            />
          </div>
        </div>

        {/* Filter Bar */}
        <KanbanFilterBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterPriority={filterPriority}
          setFilterPriority={setFilterPriority}
          filterAssignee={filterAssignee}
          setFilterAssignee={setFilterAssignee}
          filterLabel={filterLabel}
          setFilterLabel={setFilterLabel}
          clearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          teamMembers={teamMembers}
          labels={labels}
        />
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`mx-4 md:mx-6 mt-3 flex items-center gap-3 px-4 py-2.5 border rounded-lg transition-all animate-in slide-in-from-top-2 duration-300 ${
          completeSuccess ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm font-medium">{toastMessage}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 md:mx-6 mt-3 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Error</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Mobile Column Switcher */}
      <div className="px-3 pt-3">
        <MobileColumnSwitcher
          columnConfigs={columnConfigs}
          columns={columns}
          activeMobileColumn={activeMobileColumn}
          setActiveMobileColumn={setActiveMobileColumn}
        />
      </div>

      {/* Board Content */}
      <div className="flex-1 overflow-hidden px-3 md:px-5 py-3">
        {loading ? (
          <div className="flex items-center justify-center h-80">
            <div className="text-center">
              <Loader className="w-7 h-7 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading board...</p>
            </div>
          </div>
        ) : (
          <DragDropProvider tasks={tasks} onDragEnd={handleAnyDragEnd}>
            {/* Desktop: all columns side-by-side */}
            <SortableContext items={(columnConfigs || []).filter(c => c && c.status).map((c) => c.status)} strategy={horizontalListSortingStrategy}>
              <div className="hidden md:flex gap-3 overflow-x-auto h-full pb-3 items-start"
                   style={{ scrollbarWidth: 'thin' }}>
                {columns.filter(c => c && c.status).map((column) => {
                  const cfg = columnConfigs.find(c => c.status === column.status);
                  return (
                    <SortableColumn key={column.status} column={column} width="320px">
                      <KanbanColumn
                        column={column}
                        columnId={cfg?.id}
                        color={cfg?.color}
                        wipLimit={cfg?.wipLimit}
                        onDeleteTask={handleDeleteTask}
                        onCreateTask={handleAddTask}
                        onEditTask={handleEditTask}
                        onOpenTask={setSelectedTaskIdForModal}
                        onInlineUpdate={handleInlineUpdate}
                        usersMap={usersMap}
                        labels={labels}
                        onCreateLabel={handleCreateLabel}
                        onColumnRenamed={handleColumnRenamed}
                        onColumnSettingsChanged={handleColumnSettingsChanged}
                        onDeleteColumn={handleDeleteColumn}
                      />
                    </SortableColumn>
                  );
                })}

                {/* Add Column button — ClickUp style */}
                {kanbanId && (
                  <div className="flex-shrink-0 self-start" style={{ width: '280px' }}>
                    {showAddColumn ? (
                      <div className="rounded-xl bg-[#F8F9FB] border border-gray-200/60 p-3">
                        <input
                          type="text"
                          value={newColumnName}
                          onChange={e => setNewColumnName(e.target.value)}
                          onKeyDown={async e => {
                            if (e.key === 'Enter' && newColumnName.trim()) {
                              await handleAddColumn(newColumnName.trim());
                              setNewColumnName('');
                              setShowAddColumn(false);
                            } else if (e.key === 'Escape') {
                              setNewColumnName('');
                              setShowAddColumn(false);
                            }
                          }}
                          placeholder="Column name (e.g. Blocked)..."
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-2"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={async () => { if (newColumnName.trim()) { await handleAddColumn(newColumnName.trim()); setNewColumnName(''); setShowAddColumn(false); } }}
                            disabled={!newColumnName.trim()}
                            className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
                          >
                            Add Column
                          </button>
                          <button onClick={() => { setNewColumnName(''); setShowAddColumn(false); }}
                            className="flex-1 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddColumn(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-all text-sm font-medium"
                      >
                        <Plus size={16} />
                        Add Column
                      </button>
                    )}
                  </div>
                )}
              </div>
            </SortableContext>

            {/* Mobile: single active column */}
            <div className="md:hidden h-[calc(100vh-280px)] overflow-y-auto">
              {columns
                .filter(col => col.status === activeMobileColumn)
                .map(column => {
                  const cfg = columnConfigs.find(c => c.status === column.status);
                  return (
                    <KanbanColumn
                      key={column.status}
                      column={column}
                      columnId={cfg?.id}
                      color={cfg?.color}
                      wipLimit={cfg?.wipLimit}
                      onDeleteTask={handleDeleteTask}
                      onCreateTask={handleAddTask}
                      onEditTask={handleEditTask}
                      onOpenTask={setSelectedTaskIdForModal}
                      onInlineUpdate={handleInlineUpdate}
                      usersMap={usersMap}
                      labels={labels}
                      onCreateLabel={handleCreateLabel}
                      onColumnRenamed={handleColumnRenamed}
                      onColumnSettingsChanged={handleColumnSettingsChanged}
                      onDeleteColumn={handleDeleteColumn}
                    />
                  );
                })}
            </div>

            {updatingTaskId && (
              <div className="fixed bottom-20 right-4 md:bottom-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <Loader className="w-3.5 h-3.5 animate-spin" />
                <span className="text-sm">Updating...</span>
              </div>
            )}
          </DragDropProvider>
        )}
      </div>

      {/* Floating Action Button — Quick Create (mobile) */}
      <button
        onClick={() => handleOpenCreateModal(activeMobileColumn || columnConfigs[0]?.status || 'TODO')}
        className="md:hidden fixed bottom-20 right-4 z-[105] w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center hover:shadow-2xl active:scale-95 transition-all"
        aria-label="Quick create task"
      >
        <Plus size={24} />
      </button>

      {/* Modals */}
      {projectId && (
        <CreateTaskModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreateTask={async (taskData) => {
            await handleCreateTask({
              title: taskData.title ?? '',
              priority: taskData.priority ?? 'MEDIUM',
              labelIds: taskData.labelId ? [taskData.labelId] : [],
              storyPoint: typeof taskData.storyPoint === 'number' ? taskData.storyPoint : 0,
            });
          }}
          columnStatus={selectedColumnStatus}
          projectId={parseInt(projectId as string)}
          loading={false}
        />
      )}



      {selectedTaskIdForModal !== null && (
        <TaskCardModal
          taskId={selectedTaskIdForModal}
          onClose={() => setSelectedTaskIdForModal(null)}
        />
      )}
    </div>
  );
}
