'use client';

import React, { Suspense, useCallback, useState } from 'react';
import { DragEndEvent } from '@dnd-kit/core';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import DragDropProvider from './components/DragDropProvider';
import KanbanColumn from './components/KanbanColumn';
import SortableColumn from './components/SortableColumn';
import KanbanFilterBar from './components/KanbanFilterBar';
import CreateTaskModal from './components/CreateTaskModal';
import { AlertCircle, Loader, CheckCircle2, Plus, LayoutGrid, X, Trash2 } from 'lucide-react';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import EmptyState from '@/components/shared/EmptyState';
import { useKanbanBoard } from './useKanbanBoard';
import { RouteLoadingState } from '@/components/shared/RouteBoundaryState';
import OverlayPortal from '@/components/ui/OverlayPortal';

function KanbanPageContent() {
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
    updatingTaskId, usersMap, activeMobileColumn,
    handleDragEnd, handleColumnDragEnd, handleDeleteTask,
    handleAddTask, handleCreateTask, handleOpenCreateModal,
    handleInlineUpdate, handleCompleteBoard,
    handleAssigneeChange,
    handleColumnRenamed, handleColumnSettingsChanged, handleDeleteColumn,
    handleAddColumn, handleCreateLabel, handleUpdateLabel, handleDeleteLabel, forceRefresh,
  } = useKanbanBoard(projectId);

  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [taskPendingDelete, setTaskPendingDelete] = useState<typeof tasks[number] | null>(null);

  const handleAnyDragEnd = useCallback((event: DragEndEvent) => {
    if (!isNaN(Number(event.active.id))) {
      handleDragEnd(event);
    } else {
      handleColumnDragEnd(event);
    }
  }, [handleDragEnd, handleColumnDragEnd]);

  if (!projectId) {
    return (
      <div className="min-h-screen bg-cu-bg">
        <EmptyState
          icon={<LayoutGrid size={24} />}
          title="Select a project to view its board"
          subtitle="Choose a project from your dashboard to get back to planning and tracking work."
          action={(
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-cu-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cu-primary-hover"
            >
              Go to Dashboard
            </Link>
          )}
          className="min-h-[60vh]"
        />
      </div>
    );
  }

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'DONE').length;
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(21,93,252,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.12),transparent_28%)]">
      {/* Premium Header */}
      <div className="border-b border-cu-border bg-[linear-gradient(135deg,rgba(21,93,252,0.12),rgba(99,102,241,0.08)_45%,rgba(34,197,94,0.1))] px-4 md:px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <LayoutGrid size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-bold text-cu-text-primary tracking-tight">Board</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-cu-text-tertiary">{totalTasks} tasks</span>
                {totalTasks > 0 && (
                  <>
                    <span className="text-cu-text-muted">&middot;</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1 rounded-full bg-cu-bg-tertiary overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                      </div>
                      <span className="text-[11px] text-cu-text-tertiary font-medium">{progressPercent}%</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="hidden sm:flex items-center rounded-lg bg-cu-bg/80 px-3 py-1.5 border border-cu-border focus-within:border-[var(--cu-focus-border)] focus-within:bg-cu-bg transition-all shadow-sm">
              <svg className="text-cu-text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent border-0 text-sm text-cu-text-primary placeholder:text-cu-text-muted focus:outline-none ml-2 w-40 md:w-52"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-cu-text-muted hover:text-cu-text-secondary">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Complete Board */}
            <button
              onClick={() => setShowCompleteConfirm(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 text-emerald-500 border border-emerald-500/30 rounded-lg text-xs font-medium hover:from-emerald-500/20 hover:to-cyan-500/20 transition-colors"
            >
              <CheckCircle2 size={14} />
              Complete All
            </button>
          </div>
        </div>

        {/* Mobile search */}
        <div className="sm:hidden mt-2">
          <div className="flex items-center rounded-lg bg-cu-bg/80 px-3 py-2 border border-cu-border focus-within:border-[var(--cu-focus-border)] focus-within:bg-cu-bg transition-all shadow-sm">
            <svg className="text-cu-text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-0 text-sm text-cu-text-primary placeholder:text-cu-text-muted focus:outline-none ml-2 flex-1"
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
          completeSuccess ? 'bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 border-emerald-500/30 text-emerald-500' : 'bg-gradient-to-r from-cu-primary/15 to-violet-500/10 border-cu-primary/30 text-cu-primary'
        }`}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm font-medium">{toastMessage}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 md:mx-6 mt-3 flex items-start justify-between gap-3 p-4 bg-red-500/10 border border-red-500/25 rounded-lg text-red-500 flex-wrap">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Error</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void forceRefresh()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-white/80 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Mobile Column Switcher - removed for native scroll */}

      {/* Board Content */}
      <div className="flex-1 overflow-hidden px-3 md:px-5 py-3">
        {loading ? (
          <div className="flex items-center justify-center h-80">
            <div className="text-center">
              <Loader className="w-7 h-7 text-cu-primary animate-spin mx-auto mb-2" />
              <p className="text-sm text-cu-text-tertiary">Loading board...</p>
            </div>
          </div>
        ) : (
          <DragDropProvider tasks={tasks} onDragEnd={handleAnyDragEnd}>
            {/* Unified Desktop & Mobile side-by-side columns */}
            <SortableContext items={(columnConfigs || []).filter(c => c && c.status).map((c) => c.status)} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-4 sm:gap-3 overflow-x-auto snap-x snap-mandatory h-full pb-3 items-start px-2 sm:px-0"
                   style={{ scrollbarWidth: 'thin' }}>
                {columns.filter(c => c && c.status).map((column) => {
                  const cfg = columnConfigs.find(c => c.status === column.status);
                  return (
                    <SortableColumn key={column.status} column={column}>
                      <KanbanColumn
                        column={column}
                        columnId={cfg?.id}
                        color={cfg?.color}
                        wipLimit={cfg?.wipLimit}
                        updatingTaskId={updatingTaskId}
                        onDeleteTask={(taskId) => {
                          const task = tasks.find(item => item.id === taskId);
                          if (task) setTaskPendingDelete(task);
                        }}
                        onCreateTask={handleAddTask}
                        onOpenTask={setSelectedTaskIdForModal}
                        onInlineUpdate={handleInlineUpdate}
                        onAssigneeChange={handleAssigneeChange}
                        teamMembers={teamMembers}
                        usersMap={usersMap}
                        labels={labels}
                        onCreateLabel={handleCreateLabel}
                        onUpdateLabel={handleUpdateLabel}
                        onDeleteLabel={handleDeleteLabel}
                        onColumnRenamed={handleColumnRenamed}
                        onColumnSettingsChanged={handleColumnSettingsChanged}
                        onDeleteColumn={handleDeleteColumn}
                      />
                    </SortableColumn>
                  );
                })}

                {/* Add Column button: ClickUp style */}
                {kanbanId && (
                  <div className="flex-shrink-0 self-start snap-center md:snap-none" style={{ width: '280px' }}>
                    {showAddColumn ? (
                      <div className="rounded-xl bg-gradient-to-br from-cu-primary/10 via-violet-500/5 to-emerald-500/10 border border-cu-primary/20 p-3 shadow-cu-sm">
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
                          className="w-full px-3 py-2 border border-cu-border bg-cu-bg text-cu-text-primary placeholder:text-cu-text-muted rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cu-primary/40 mb-2"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={async () => { if (newColumnName.trim()) { await handleAddColumn(newColumnName.trim()); setNewColumnName(''); setShowAddColumn(false); } }}
                            disabled={!newColumnName.trim()}
                            className="flex-1 py-1.5 bg-cu-primary text-white rounded-lg text-xs font-medium hover:bg-cu-primary-hover disabled:opacity-40 transition-colors"
                          >
                            Add Column
                          </button>
                          <button onClick={() => { setNewColumnName(''); setShowAddColumn(false); }}
                            className="flex-1 py-1.5 border border-cu-border text-cu-text-secondary rounded-lg text-xs hover:bg-cu-hover transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddColumn(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-cu-primary/35 bg-gradient-to-br from-cu-primary/5 to-emerald-500/5 text-cu-primary hover:border-cu-primary hover:bg-cu-primary/10 transition-all text-sm font-medium"
                      >
                        <Plus size={16} />
                        Add Column
                      </button>
                    )}
                  </div>
                )}
              </div>
            </SortableContext>



            {updatingTaskId && (
              <div className="fixed bottom-20 right-4 md:bottom-4 bg-gradient-to-r from-cu-primary to-indigo-600 text-white border border-white/10 px-4 py-2 rounded-lg shadow-cu-xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <Loader className="w-3.5 h-3.5 animate-spin" />
                <span className="text-sm">Updating...</span>
              </div>
            )}
          </DragDropProvider>
        )}
      </div>

      {/* Complete All Tasks Confirmation Dialog */}
      {showCompleteConfirm && (
        <OverlayPortal>
          <div className="fixed inset-0 z-[var(--cu-z-modal)] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-cu-bg rounded-2xl shadow-cu-xl border border-cu-border p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-cu-text-primary">Complete All Tasks</h3>
                  <p className="text-[13px] text-cu-text-secondary">Mark every task as Done?</p>
                </div>
              </div>
              <p className="text-[14px] text-cu-text-secondary mb-5 leading-relaxed">
                This will mark all remaining tasks as <span className="font-bold text-emerald-600">Done</span>. This action is definitive but allows you to clear your board quickly.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCompleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-cu-border rounded-xl text-[14px] font-semibold text-cu-text-secondary hover:bg-cu-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowCompleteConfirm(false);
                    await handleCompleteBoard();
                  }}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[14px] font-bold transition-colors shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </OverlayPortal>
      )}

      {/* Delete Task Confirmation Dialog */}
      {taskPendingDelete && (
        <OverlayPortal>
          <div className="fixed inset-0 z-[var(--cu-z-modal)] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="delete-task-title">
            <div className="w-full max-w-md rounded-2xl border border-cu-border bg-cu-bg p-5 shadow-cu-xl animate-in fade-in zoom-in-95 duration-200">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cu-danger/10 text-cu-danger">
                  <Trash2 size={20} />
                </div>
                <div className="min-w-0">
                  <h3 id="delete-task-title" className="text-[16px] font-bold text-cu-text-primary">Delete task?</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-cu-text-secondary">
                    This will permanently delete{' '}
                    <span className="font-semibold text-cu-text-primary break-words">
                      {taskPendingDelete.title}
                    </span>
                    .
                  </p>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 min-[420px]:flex-row min-[420px]:justify-end">
                <button
                  type="button"
                  onClick={() => setTaskPendingDelete(null)}
                  className="rounded-xl border border-cu-border px-4 py-2.5 text-[14px] font-semibold text-cu-text-secondary transition-colors hover:bg-cu-hover"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const taskId = taskPendingDelete.id;
                    setTaskPendingDelete(null);
                    await handleDeleteTask(taskId);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cu-danger px-4 py-2.5 text-[14px] font-bold text-white shadow-lg shadow-red-600/20 transition-colors hover:opacity-90"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </OverlayPortal>
      )}

      {/* Floating Action Button: Quick Create (mobile) */}
      <button
        onClick={() => handleOpenCreateModal(activeMobileColumn || columnConfigs[0]?.status || 'TODO')}
        className="md:hidden fixed bottom-20 right-4 z-[105] w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full shadow-cu-lg flex items-center justify-center hover:shadow-cu-xl active:scale-95 transition-all"
        aria-label="Quick create task"
      >
        <Plus size={24} />
      </button>

      {/* Modals */}
      {projectId && (
        <CreateTaskModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreateTask={handleCreateTask}
          columnStatus={selectedColumnStatus}
          projectId={parseInt(projectId as string)}
          loading={false}
        />
      )}



      {selectedTaskIdForModal !== null && (
        <TaskCardModal
          taskId={selectedTaskIdForModal}
          onClose={() => {
            setSelectedTaskIdForModal(null);
            // Board updates from modal edits arrive via the planora:task-updated
            // custom event dispatched by TaskCardModal and handled in useKanbanData.
            // No full board refresh needed here.
          }}
        />
      )}
    </div>
  );
}

export default function KanbanPage() {
  return (
    <Suspense fallback={<RouteLoadingState title="Loading board" subtitle="Preparing kanban columns and tasks." variant="board" />}>
      <KanbanPageContent />
    </Suspense>
  );
}
