'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Plus, Search } from 'lucide-react';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import CreateTaskModal from '@/components/shared/CreateTaskModal';
import TaskTableHeader from './components/TaskTableHeader';
import TaskRow from './components/TaskRow';
import { useListTasks } from './hooks/useListTasks';
import ListFilterBar, { type ListFilters } from './components/ListFilterBar';
import ListBulkActionBar from './components/ListBulkActionBar';

// ── Main Page ─────────────────────────────────────────────────────────────

const TASKS_PER_PAGE = 12;

export default function ListPage() {
  const searchParams = useSearchParams();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  // Initialise from URL so no setState call is needed inside an effect
  const [showCreateModal, setShowCreateModal] = useState(
    () => searchParams.get('action') === 'add-task',
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [groupBy, setGroupBy] = useState<'none' | 'status' | 'priority' | 'assignee'>('none');
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
    handleBulkStatusChange,
    handleBulkDelete,
    members,
    labels,
    milestones,
    handleDueDateChange,
    handleAssigneesChange,
    handleToggleTaskLabel,
    handleMilestoneChange,
  } = useListTasks();

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
      if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) return false;
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

  const groupedEntries = useMemo(() => {
    if (groupBy === 'none') return [{ label: 'All Tasks', items: filteredTasks }];
    const groups = new Map<string, typeof filteredTasks>();
    filteredTasks.forEach((task) => {
      const key =
        groupBy === 'status'
          ? (task.status || 'TODO').replace(/_/g, ' ')
          : groupBy === 'priority'
            ? (task.priority || 'LOW')
            : ((task.assignees && task.assignees.length > 0 ? task.assignees.map((person) => person.name).join(', ') : task.assigneeName) || 'Unassigned');
      const arr = groups.get(key) ?? [];
      arr.push(task);
      groups.set(key, arr);
    });
    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  }, [filteredTasks, groupBy]);

  const flatGroupedTasks = useMemo(
    () => groupedEntries.flatMap((entry) => entry.items),
    [groupedEntries]
  );

  const totalPages = Math.max(1, Math.ceil(flatGroupedTasks.length / TASKS_PER_PAGE));
  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * TASKS_PER_PAGE;
    return flatGroupedTasks.slice(startIndex, startIndex + TASKS_PER_PAGE);
  }, [currentPage, flatGroupedTasks]);

  // Clean ?action= query param from URL on mount — no setState here
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('action')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  useEffect(() => {
    setCurrentPage(1); // eslint-disable-line react-hooks/set-state-in-effect
  }, [filters, groupBy, projectId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [currentPage, totalPages]);

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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800">Missing Project ID</h1>
          <p className="text-gray-500 text-sm mt-2">Add <code className="bg-gray-100 px-1 rounded">?projectId=...</code> to the URL.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-gray-50 overflow-y-auto">
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto w-full">

        {/* Header */}
        <div className="sticky-section-header glass-panel border border-[#E4E7EC] rounded-2xl px-4 sm:px-6 py-4 mb-4 flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-[20px] sm:text-2xl font-bold text-[#101828]">Task List</h1>
            <p className="text-[12px] sm:text-[13px] text-[#6A7282] mt-0.5">
              {filteredTasks.length} visible of {sortedTasks.length} task{sortedTasks.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-2 bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 shadow-sm">
              <Search size={14} className="text-[#9CA3AF] shrink-0" />
              <input
                type="text"
                placeholder="Search tasks…"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="text-[13px] text-[#101828] bg-transparent focus:outline-none placeholder:text-[#9CA3AF] w-44"
              />
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#155DFC] text-white text-[13px] font-medium rounded-lg hover:bg-[#0042A8] transition-colors shrink-0"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Create Task</span>
            </button>
          </div>
        </div>

        <ListFilterBar
          filters={filters}
          onChange={setFilters}
          assigneeNames={allAssigneeNames}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
        />

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 mb-4">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Error loading tasks</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-[42px] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
            <div className="hidden md:flex items-center px-4 py-2 border-b border-[#EAECF0] bg-[#FCFCFD]">
              <label className="inline-flex items-center gap-2 text-[12px] text-[#667085] font-medium">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  className="h-4 w-4 rounded border-[#D0D5DD] text-[#155DFC] focus:ring-[#155DFC]/20 cursor-pointer"
                />
                Select visible
              </label>
            </div>
            <TaskTableHeader />
            {flatGroupedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search size={32} className="text-[#D1D5DB] mb-3" />
                <p className="text-[14px] font-medium text-[#374151]">
                  {filters.search ? 'No tasks match your search' : 'No tasks yet'}
                </p>
                <p className="text-[12px] text-[#9CA3AF] mt-1">
                  {filters.search ? 'Try a different search term' : 'Create a task to get started'}
                </p>
              </div>
            ) : (
              paginatedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  members={members}
                  availableLabels={labels}
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
                />
              ))
            )}
          </div>
        )}

        {!loading && sortedTasks.length > TASKS_PER_PAGE && (
          <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#344054] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#F9FAFB]"
            >
              Prev
            </button>

            {Array.from({ length: totalPages }, (_, index) => {
              const pageNumber = index + 1;
              const isActive = pageNumber === currentPage;

              return (
                <button
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`min-w-9 h-9 px-3 rounded-lg text-[13px] font-medium border transition-colors ${
                    isActive
                      ? 'bg-[#155DFC] text-white border-[#155DFC]'
                      : 'bg-white text-[#344054] border-[#E5E7EB] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#344054] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#F9FAFB]"
            >
              Next
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
      />

      {/* Modals */}
      {selectedTaskId !== null && (
        <TaskCardModal
          taskId={selectedTaskId}
          onClose={(wasModified) => { setSelectedTaskId(null); if (wasModified) void loadTasks(); }}
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


