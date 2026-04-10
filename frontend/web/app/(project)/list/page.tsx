'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Plus, Search } from 'lucide-react';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import CreateTaskModal from '@/components/shared/CreateTaskModal';
import TaskTableHeader from './components/TaskTableHeader';
import TaskRow from './components/TaskRow';
import { useListTasks } from './hooks/useListTasks';

// ── Main Page ─────────────────────────────────────────────────────────────

export default function ListPage() {
  const searchParams = useSearchParams();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  // Initialise from URL so no setState call is needed inside an effect
  const [showCreateModal, setShowCreateModal] = useState(
    () => searchParams.get('action') === 'add-task',
  );

  const {
    projectId,
    loading,
    error,
    search,
    setSearch,
    sortedTasks,
    handleStatusChange,
    handleDelete,
    handleAddTask,
  } = useListTasks();

  // Clean ?action= query param from URL on mount — no setState here
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('action')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

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
      <div className="mobile-page-padding max-w-[1100px] mx-auto w-full py-6">

        {/* Header */}
        <div className="sticky-section-header -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 mb-4 flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-[18px] sm:text-xl font-bold text-[#101828]">Task List</h1>
            <p className="text-[12px] text-[#6A7282] mt-0.5 hidden sm:block">
              {sortedTasks.length} task{sortedTasks.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-2 bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 shadow-sm">
              <Search size={14} className="text-[#9CA3AF] shrink-0" />
              <input
                type="text"
                placeholder="Search tasks…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
            <TaskTableHeader />
            {sortedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search size={32} className="text-[#D1D5DB] mb-3" />
                <p className="text-[14px] font-medium text-[#374151]">
                  {search ? 'No tasks match your search' : 'No tasks yet'}
                </p>
                <p className="text-[12px] text-[#9CA3AF] mt-1">
                  {search ? 'Try a different search term' : 'Create a task to get started'}
                </p>
              </div>
            ) : (
              sortedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onOpenModal={setSelectedTaskId}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedTaskId !== null && (
        <TaskCardModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
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


