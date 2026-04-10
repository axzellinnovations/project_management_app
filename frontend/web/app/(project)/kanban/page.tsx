'use client';
export const dynamic = 'force-dynamic';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import DragDropProvider from './components/DragDropProvider';
import KanbanColumn from './components/KanbanColumn';
import CreateTaskModal from './components/CreateTaskModal';
import EditTaskModal from './components/EditTaskModal';
import { AlertCircle, Loader, CheckCircle2, Plus } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import { useKanbanBoard } from './useKanbanBoard';

// wrapper to make a column draggable
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SortableColumn({ column, children, width = '350px' }: { column: any; children: React.ReactNode; width?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: column.status,
    data: { type: 'column' },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, width }}
      {...attributes}
      {...listeners}
      className="flex-shrink-0"
      suppressHydrationWarning={true}
    >
      {children}
    </div>
  );
}

export default function KanbanPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  const {
    tasks, loading, error, searchTerm, columnConfigs, columns, updatingTaskId,
    isCreateModalOpen, setIsCreateModalOpen,
    selectedColumnStatus, setSelectedColumnStatus,
    isCreatingTask, completeSuccess, createSuccess,
    isEditModalOpen, setIsEditModalOpen,
    editingTask, setEditingTask,
    isUpdatingTask, selectedTaskIdForModal, setSelectedTaskIdForModal,
    usersMap, activeMobileColumn, setActiveMobileColumn,
    loadTasks, handleAddColumn, handleDragEnd, handleDeleteTask,
    handleSearchChange, handleCreateTaskClick, handleCreateTask,
    handleEditTaskClick, handleUpdateTask, handleCompleteBoard,
  } = useKanbanBoard(projectId);

  if (!projectId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Missing Project ID
          </h1>
          <p className="text-gray-600">
            Please provide a project ID in the URL: <code className="bg-gray-100 px-2 py-1 rounded">/kanban?projectId=1</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-gray-100 overflow-y-auto p-3 md:p-6">
        <div className="mb-4 md:mb-6">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-gray-800">Kanban Board</h1>
              <p className="text-xs md:text-sm text-gray-600 mt-0.5 md:mt-1">Organize and track your project tasks</p>
              {createSuccess && (
                <div className="mt-2 text-green-600 text-sm">{createSuccess}</div>
              )}
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <input
                type="text"
                placeholder="Search board..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="hidden sm:block px-4 py-2 border border-gray-200 rounded-lg text-sm w-48 md:w-64"
              />
              <button
                onClick={handleCompleteBoard}
                className="px-3 md:px-6 py-2 bg-blue-600 text-white rounded-lg font-medium text-xs md:text-sm hover:bg-blue-700 transition-colors flex items-center gap-1.5 md:gap-2 whitespace-nowrap"
              >
                <CheckCircle2 size={16} />
                <span className="hidden sm:inline">Complete Board</span>
                <span className="sm:hidden">Done</span>
              </button>
            </div>
          </div>

          {/* Mobile search */}
          <div className="sm:hidden mb-3">
            <input
              type="text"
              placeholder="Search board..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          {completeSuccess && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 mb-4">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">Board marked as complete!</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Error</p>
                <p className="text-xs">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Column Switcher Tab Bar */}
        <div className="md:hidden flex overflow-x-auto no-scrollbar gap-1 mb-3 bg-white rounded-xl p-1 border border-gray-100 shadow-sm">
          {columnConfigs.map((col) => (
            <button
              key={col.status}
              onClick={() => setActiveMobileColumn(col.status)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${activeMobileColumn === col.status
                  ? 'bg-[#155DFC] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
                }`}
            >
              {col.title}
              <span className={`ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 ${activeMobileColumn === col.status ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                {columns.find(c => c.status === col.status)?.tasks.length ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Loading tasks...</p>
            </div>
          </div>
        ) : (
          <DragDropProvider tasks={tasks} onDragEnd={handleDragEnd}>
            {/* Desktop: all columns side-by-side */}
            <SortableContext items={columnConfigs.map((c) => c.status)} strategy={horizontalListSortingStrategy}>
              <div className="hidden md:flex gap-6 overflow-x-auto pb-6 h-[calc(50vh+94px)]">
                {columns.map((column) => (
                  <SortableColumn key={column.status} column={column} width="350px">
                    <KanbanColumn
                      column={column}
                      onDeleteTask={handleDeleteTask}
                      onCreateTask={handleCreateTaskClick}
                      onEditTask={handleEditTaskClick}
                      onOpenTask={setSelectedTaskIdForModal}
                      usersMap={usersMap}
                    />
                  </SortableColumn>
                ))}
                <div className="flex-shrink-0 w-24 flex items-center justify-center">
                  <button onClick={handleAddColumn} className="px-3 py-3 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300">
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </SortableContext>

            {/* Mobile: single active column */}
            <div className="md:hidden h-[calc(100vh-280px)] overflow-y-auto">
              {columns
                .filter(col => col.status === activeMobileColumn)
                .map(column => (
                  <KanbanColumn
                    key={column.status}
                    column={column}
                    onDeleteTask={handleDeleteTask}
                    onCreateTask={handleCreateTaskClick}
                    onEditTask={handleEditTaskClick}
                    onOpenTask={setSelectedTaskIdForModal}
                    usersMap={usersMap}
                  />
                ))}
            </div>

            {updatingTaskId && (
              <div className="fixed bottom-20 right-4 md:bottom-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
                <Loader className="w-4 h-4 animate-spin" />
                <span className="text-sm">Updating task...</span>
              </div>
            )}
          </DragDropProvider>
        )}

        {/* Floating Action Button — Quick Create Task (mobile) */}
        <button
          onClick={() => {
            setSelectedColumnStatus(activeMobileColumn || columnConfigs[0]?.status || 'TODO');
            setIsCreateModalOpen(true);
          }}
          className="md:hidden fixed bottom-20 right-4 z-[105] w-14 h-14 bg-[#155DFC] text-white rounded-full shadow-xl flex items-center justify-center hover:bg-[#0042a3] active:scale-95 transition-all"
          aria-label="Quick create task"
        >
          <Plus size={26} />
        </button>

        {projectId && (
          <CreateTaskModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onCreateTask={handleCreateTask}
            columnStatus={selectedColumnStatus}
            projectId={parseInt(projectId as string)}
            loading={isCreatingTask}
          />
        )}

        {projectId && (
          <EditTaskModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setEditingTask(null);
            }}
            onUpdateTask={handleUpdateTask}
            task={editingTask}
            loading={isUpdatingTask}
          />
        )}

        {selectedTaskIdForModal !== null && (
          <TaskCardModal
            taskId={selectedTaskIdForModal}
            onClose={() => { setSelectedTaskIdForModal(null); void loadTasks(); }}
          />
        )}
      </div>
    );
  }
