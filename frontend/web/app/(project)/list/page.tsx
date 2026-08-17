'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, ChevronLeft, ChevronRight, ListChecks, Plus, RefreshCw, Search } from 'lucide-react';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import CreateTaskModal from '@/components/shared/CreateTaskModal';
import EmptyState from '@/components/shared/EmptyState';
import TaskTableHeader from './components/TaskTableHeader';
import TaskRow from './components/TaskRow';
import { useListTasks } from './hooks/useListTasks';
import ListFilterBar, { type ListFilters } from './components/ListFilterBar';
import ListBulkActionBar from './components/ListBulkActionBar';
import { useProjectStatuses } from '@/hooks/useProjectStatuses';
import { RouteLoadingState } from '@/components/shared/RouteBoundaryState';
import { stripQueryParam } from '@/lib/url';
import { buildGroupedTasks, normalizeStatus, type ListGroupBy } from './lib/list-config';

// ── Main Page ─────────────────────────────────────────────────────────────

const TASKS_PER_PAGE = 12;

function ListPageContent() {
  const searchParams = useSearchParams();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  // Initialise from URL so no setState call is needed inside an effect
  const [showCreateModal, setShowCreateModal] = useState(
    () => searchParams.get('action') === 'add-task',
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [groupBy, setGroupBy] = useState<ListGroupBy>('none');
  const [filters, setFilters] = useState<ListFilters>({
    search: '',
    statuses: [],
    priorities: [],
    assignee: '',
  });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const {
    projectId,
    loading,
    error,
    sortedTasks,
    handleStatusChange,
    handleDelete,
    handleAddTask,
    loadTasks,
    loadSingleTask,
    canModifyTasks,
    handleBulkStatusChange,
    handleBulkDelete,
    members,
    labels,
    milestones,
    handleDueDateChange,
    handleAssigneesChange,
    handleToggleTaskLabel,
    handleCreateLabel,
    handleUpdateLabel,
    handleDeleteLabel,
    handleMilestoneChange,
    handlePriorityChange,
  } = useListTasks();
  const { statuses: projectStatuses } = useProjectStatuses(projectId ? Number(projectId) : undefined);

  const allAssigneeNames = useMemo(() => {
    const set = new Set<string>();
    sortedTasks.forEach((task) => {
      if (task.assignees && task.assignees.length > 0) {
        task.assignees.forEach((person) => {
          if (person.name && person.name !== 'Unassigned') set.add(person.name);
        });
      } else if (task.assigneeName && task.assigneeName !== 'Unassigned') {
        set.add(task.assigneeName);
      }
    });
    return Array.from(set).sort();
  }, [sortedTasks]);

  const filteredTasks = useMemo(() => (
    sortedTasks.filter((task) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const inTitle = task.title.toLowerCase().includes(q);
        const inAssignee =
          (task.assigneeName ?? '').toLowerCase().includes(q) ||
          (task.assignees ?? []).some((person) => person.name.toLowerCase().includes(q));
        if (!inTitle && !inAssignee) return false;
      }
      if (filters.statuses.length > 0 && !filters.statuses.includes(normalizeStatus(task.status))) return false;
      if (filters.priorities.length > 0 && !filters.priorities.includes((task.priority ?? '').toUpperCase())) return false;
      if (filters.assignee) {
        const hasAssignee =
          task.assigneeName === filters.assignee ||
          (task.assignees ?? []).some((person) => person.name === filters.assignee);
        if (!hasAssignee) return false;
      }
      return true;
    })
  ), [sortedTasks, filters]);

  const groupedEntries = useMemo(() => buildGroupedTasks(filteredTasks, groupBy), [filteredTasks, groupBy]);

  const flatGroupedTasks = useMemo(
    () => groupedEntries.flatMap((entry) => entry.items),
    [groupedEntries]
  );

  const totalPages = Math.max(1, Math.ceil(flatGroupedTasks.length / TASKS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedTasks = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * TASKS_PER_PAGE;
    return flatGroupedTasks.slice(startIndex, startIndex + TASKS_PER_PAGE);
  }, [safeCurrentPage, flatGroupedTasks]);

  const paginatedTaskIds = useMemo(
    () => new Set(paginatedTasks.map((task) => task.id)),
    [paginatedTasks],
  );

  const paginatedGroupedEntries = useMemo(() => {
    return groupedEntries
      .map((entry) => {
        const visibleItems = entry.items.filter((task) => paginatedTaskIds.has(task.id));
        return { ...entry, items: visibleItems };
      })
      .filter((entry) => entry.items.length > 0);
  }, [groupedEntries, paginatedTaskIds]);

  // Clean ?action= query param from URL on mount — no setState here
  useEffect(() => {
    stripQueryParam('action');
  }, []);

  const selectedCount = selectedIds.size;

  const toggleSelect = (taskId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const visible = paginatedTasks.map((task) => task.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allVisibleSelected = visible.every((id) => next.has(id));
      if (allVisibleSelected) visible.forEach((id) => next.delete(id));
      else visible.forEach((id) => next.add(id));
      return next;
    });
  };

  const allVisibleSelected = paginatedTasks.length > 0 && paginatedTasks.every((task) => selectedIds.has(task.id));

  // ── No project selected ──
  if (!projectId) {
    return (
      <div className="min-h-screen bg-cu-bg-secondary">
        <EmptyState
          icon={<ListChecks size={24} />}
          title="Select a project to view its tasks"
          subtitle="Choose a project from your dashboard to see its task list and continue working."
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

  return (
    <div className="flex min-h-full flex-1 flex-col bg-cu-bg-secondary">
      <div className="mx-auto w-full max-w-[1400px] animate-fade-in overflow-x-hidden px-3 py-4 sm:px-6 lg:px-8 lg:py-6">

        <div className="mb-4 rounded-cu-lg border border-cu-border bg-cu-bg px-3 py-4 shadow-cu-sm sm:px-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-[20px] font-extrabold tracking-tight text-cu-text-primary sm:text-2xl">Task List</h1>
              <p className="mt-0.5 text-[12px] font-medium text-cu-text-secondary sm:text-[13px]">
                {filteredTasks.length} visible of {sortedTasks.length} task{sortedTasks.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[380px]:flex-row min-[380px]:items-center sm:gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!canModifyTasks}
              title={!canModifyTasks ? 'Viewers cannot create tasks' : 'Create task'}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-cu-md bg-cu-primary px-3 text-[12px] font-bold text-white shadow-cu-sm transition-colors hover:bg-cu-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-cu-primary sm:px-4"
            >
              <Plus size={14} />
              <span>Create Task</span>
            </button>
            </div>
          </div>
        </div>

        <ListFilterBar
          filters={filters}
          onChange={(next) => {
            setFilters(next);
            setCurrentPage(1);
          }}
          assigneeNames={allAssigneeNames}
          groupBy={groupBy}
          onGroupByChange={(next) => {
            setGroupBy(next);
            setCurrentPage(1);
          }}
        />

        {/* Error */}
        {error && (
          <div className="flex items-start justify-between gap-3 p-4 bg-red-50 dark:bg-cu-danger-light border border-red-200 dark:border-cu-danger/30 rounded-xl text-red-700 dark:text-cu-danger mb-4 flex-wrap">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Error loading tasks</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadTasks()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-[60px] rounded-cu-md md:h-[48px]" />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-cu-lg border border-cu-border bg-cu-bg shadow-cu-sm">
            <TaskTableHeader
              allVisibleSelected={allVisibleSelected}
              toggleSelectAllVisible={toggleSelectAllVisible}
            />
            {flatGroupedTasks.length === 0 ? (
              <EmptyState
                icon={<Search size={24} />}
                title={filters.search ? 'No tasks match your search' : 'No tasks yet'}
                subtitle={filters.search ? 'Try a different search term or clear the filters.' : 'Create a task to get started.'}
                action={
                  !filters.search ? (
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-cu-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-cu-primary-hover transition-colors shadow-md shadow-cu-primary/10 cursor-pointer"
                    >
                      <Plus size={14} />
                      Create Task
                    </button>
                  ) : null
                }
              />
            ) : (
              <div>
                {paginatedGroupedEntries.map((entry) => (
                  <section key={entry.key} aria-label={entry.label}>
                    {groupBy !== 'none' && (
                      <div className="flex items-center justify-between gap-3 border-y border-cu-border bg-cu-bg-secondary/80 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-cu-text-secondary first:border-t-0 sm:px-4">
                        <span className="truncate">{entry.label}</span>
                        <span className="shrink-0 rounded-full bg-cu-bg px-2 py-0.5 text-[10px] text-cu-text-tertiary">
                          {entry.items.length}
                        </span>
                      </div>
                    )}
                    <div className="space-y-1.5 bg-cu-bg-secondary p-2 md:space-y-0 md:bg-cu-bg md:p-0">
                      {entry.items.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          members={members}
                          availableLabels={labels}
                          onCreateLabel={handleCreateLabel}
                          onUpdateLabel={handleUpdateLabel}
                          onDeleteLabel={handleDeleteLabel}
                          milestones={milestones}
                          onDueDateChange={handleDueDateChange}
                          onAssigneesChange={handleAssigneesChange}
                          onToggleLabel={handleToggleTaskLabel}
                          onMilestoneChange={handleMilestoneChange}
                          selected={selectedIds.has(task.id)}
                          onToggleSelect={toggleSelect}
                          onOpenModal={setSelectedTaskId}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDelete}
                          canModifyTasks={canModifyTasks}
                          projectStatuses={projectStatuses}
                          onPriorityChange={handlePriorityChange}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && flatGroupedTasks.length > TASKS_PER_PAGE && (
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 pb-24 sm:flex sm:flex-wrap sm:justify-center sm:pb-2">
            <button
              onClick={() => setCurrentPage(Math.max(safeCurrentPage - 1, 1))}
              disabled={safeCurrentPage === 1}
              className="inline-flex min-h-10 items-center justify-center gap-1 rounded-cu-md border border-cu-border bg-cu-bg px-3 text-[13px] font-semibold text-cu-text-primary transition-colors hover:bg-cu-hover disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9"
            >
              <ChevronLeft size={14} />
              Prev
            </button>

            <span className="rounded-cu-md border border-cu-border bg-cu-bg px-3 py-2 text-center text-[12px] font-bold text-cu-text-secondary sm:hidden">
              {safeCurrentPage} / {totalPages}
            </span>

            {Array.from({ length: totalPages }, (_, index) => {
              const pageNumber = index + 1;
              const isActive = pageNumber === safeCurrentPage;

              return (
                <button
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`hidden h-9 min-w-9 rounded-cu-md border px-3 text-[13px] font-bold transition-colors sm:inline-flex sm:items-center sm:justify-center ${
                    isActive
                      ? 'bg-cu-primary text-white border-cu-primary'
                      : 'bg-cu-bg text-cu-text-primary border-cu-border hover:bg-cu-hover'
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(Math.min(safeCurrentPage + 1, totalPages))}
              disabled={safeCurrentPage === totalPages}
              className="inline-flex min-h-10 items-center justify-center gap-1 rounded-cu-md border border-cu-border bg-cu-bg px-3 text-[13px] font-semibold text-cu-text-primary transition-colors hover:bg-cu-hover disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      <ListBulkActionBar
        selectedCount={selectedCount}
        onStatusChange={(status) => {
          void handleBulkStatusChange(Array.from(selectedIds), status);
          setSelectedIds(new Set());
        }}
        onDelete={() => {
          void handleBulkDelete(Array.from(selectedIds));
          setSelectedIds(new Set());
        }}
        onClear={() => setSelectedIds(new Set())}
        canModifyTasks={canModifyTasks}
      />

      {/* Modals */}
      {selectedTaskId !== null && (
        <TaskCardModal
          taskId={selectedTaskId}
          onClose={(wasModified) => { setSelectedTaskId(null); if (wasModified) void loadSingleTask(selectedTaskId); }}
        />
      )}

      {showCreateModal && projectId && (
        <CreateTaskModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreateTask={handleAddTask}
          projectId={projectId}
        />
      )}
    </div>
  );
}

export default function ListPage() {
  return (
    <Suspense fallback={<RouteLoadingState title="Loading task list" subtitle="Preparing list data and filters." variant="table" />}>
      <ListPageContent />
    </Suspense>
  );
}
